const express = require("express"); // import express
const path = require("path"); // to resolve file and dir paths
const mysql = require("mysql2"); // database
const bcrypt = require("bcryptjs"); // safe password encryption
const session = require("express-session");
require("dotenv").config(); // safe config
const { verifyRole } = require("./assets/js/auth.js"); // user authorization
const errorHandler = require('./assets/js/errorhandler'); // error handling
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const fs = require('fs');

const VALID_ROLES = ["User", "Player", "CollegeRep", "Moderator", "Admin", "SuperAdmin"]; // list of all valid roles

const app = express();
const port = 3000;

// secure database connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});

// middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// redirect .html URLs to clean URLs
app.use((req, res, next) => {
    if (req.path.endsWith('.html')) {
        const cleanPath = req.path.slice(0, -5); // remove .html extension
        const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
        return res.redirect(301, cleanPath + queryString); // 301 is permanent redirect, preserve query string
    } else {
        next(); // only proceed if not redirecting
    }
});

function preventDirectAccess(req, res, next) {
    // define allowed paths that should not be blocked
    const allowedPaths = [
        '/teams'  // allow the teams page
    ];

    // check if the path is explicitly allowed
    if (allowedPaths.some(path => req.path === path || req.path.startsWith(path + '/'))) {
        return next(); // this is an allowed path, proceed normally
    }

    // define patterns for protected endpoints
    const protectedPatterns = [
        /^\/payment-details($|\?|\/)/,
        /^\/user-info-tournament($|\?|\/)/,
        /^\/teams-for-college($|\?|\/)/,
        /^\/teams-for-college-tournament($|\?|\/)/,
        /^\/stripe-key($|\?|\/)/,
        /^\/universities($|\?|\/)/,
        /^\/check-session($|\?|\/)/,
        /^\/fetchColleges($|\?|\/)/,
        /^\/university($|\?|\/)/,
        /^\/api\/teams($|\?|\/)/,
        /^\/team($|\?|\/)/,
        /^\/search-teams($|\?|\/)/,
        /^\/team-members($|\?|\/)/,
        /^\/user-info($|\?|\/)/,
        /^\/player($|\?|\/)/,
        /^\/api\/reports\/college-signups($|\?|\/)/,
        /^\/api\/reports\/tournament-status($|\?|\/)/,
        /^\/news-articles($|\?|\/)/
    ];

    // check if this path matches any protected pattern
    const isProtectedPath = protectedPatterns.some(pattern =>
        pattern.test(req.path)
    );

    if (!isProtectedPath) {
        return next(); // not a protected path, proceed normally
    }

    // check if this is a browser request vs. an AJAX request
    const acceptHeader = req.headers.accept || '';
    const isXHR = req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest';
    const referer = req.headers.referer || '';
    const isDirectBrowserAccess = acceptHeader.includes('text/html') && !isXHR;

    if (isDirectBrowserAccess) {
        // return HTML not found page instead of JSON data
        return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
    }

    // if it's an AJAX request, proceed normally
    next();
}

// apply middleware globally
app.use(preventDirectAccess);

app.use(express.static("assets")); // serve static files from assets folder
app.use(express.static(path.join(__dirname, "public"))); // serve static files from public folder (pages)
app.use(errorHandler); // error handling

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,     // ensure cookie is only accessible by the server
        secure: false,      // set to true for HTTPS
        maxAge: 86400000,   // cookie expires in 1 day
        sameSite: 'lax'     // helps avoid issues with cross-origin cookies
    }
}));

// ======================== SERVE PAGES & SESSION CHECKING ========================

// serve home page endpoint
app.get("/", (req, res) => {
    if (req.session.userId) {
        return res.sendFile(path.join(__dirname, "public", "index.html"));
    }
});

// serve about page endpoint
app.get("/about", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "about.html"));
});

// serve reports page endpoint
app.get("/reports", verifyRole(["SuperAdmin", "Admin"]), (req, res) => {
    res.sendFile(path.join(__dirname, "public", "reports.html"));
});

// serve account page endpoint  |  maybe use same route to transfer to profile page if not staff?
app.get("/account", verifyRole(["SuperAdmin", "Admin"]), (req, res) => {
    res.sendFile(path.join(__dirname, "public", "account.html"));
});

// serve colleges page endpoint
app.get("/colleges", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "colleges.html"));
});

// serve teams page endpoint
app.get('/teams', async (req, res) => {
    try {
        const searchQuery = req.query.q || '';
        const searchBy = req.query.by || 'all';

        const [teams] = await db.promise().execute(`
            SELECT 
                t.TeamID, 
                t.Name, 
                t.ImageURL AS TeamImage,
                u.Name AS UniversityName,
                u.ImageURL AS UniversityImage
            FROM Teams t
            LEFT JOIN University u ON t.UniversityID = u.UniversityID
            ${searchQuery ? `WHERE ${searchBy === 'name' ? 't.Name' : 'u.Name'} LIKE ?` : ''}
            ORDER BY t.Name
        `, searchQuery ? [`%${searchQuery}%`] : []);

        const teamsHtml = teams.map(team => `
            <div class="col-md-4 mb-4">
                <div class="card h-100 shadow d-flex flex-row">
                    <!-- Team Image -->
                    ${team.TeamImage ? `
                        <div class="card-img-container p-3">
                            <img src="${team.TeamImage || "/media/img/placeholder-250x250.png"}" class="card-img-left" alt="${team.Name}">
                        </div>
                    ` : `
                        <div class="card-img-container p-3">
                            <img src="/media/img/placeholder-250x250.png" class="card-img-left" alt="${team.Name}">
                        </div>`}

                    <!-- Team Info -->
                    <div class="card-body d-flex flex-column justify-content-center">
                        <h5 class="card-title">${team.Name}</h5>
                        <p class="text-muted mb-3">From ${team.UniversityName}</p>
                        <a href="/teams/${encodeURIComponent(team.Name)}" class="btn btn-primary mt-auto">View Team</a>
                    </div>
                </div>
            </div>
        `).join('');

        const html = (await fs.promises.readFile('public/teams.html', 'utf8'))
            .replace('{{TEAMS_LIST}}', teamsHtml)
            .replace('{{SEARCH_QUERY}}', searchQuery);

        res.send(html);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server error');
    }
});

// brackets page endpoint
app.get('/brackets', async (req, res) => {
    try {
        // fetch all tournaments for the dropdown
        const [tournaments] = await db.promise().execute(`SELECT TournamentID, Name FROM Tournaments ORDER BY Name`);

        // check if tournament ID 1 exists in the list
        const defaultTournament = tournaments.find(t => t.TournamentID === 1) || tournaments[0];
        const selectedTournamentName = req.query.tournament || defaultTournament.Name;

        // find the tournament ID based on the name
        const selectedTournament = tournaments.find(t => t.Name === selectedTournamentName) || defaultTournament;
        const tournamentId = selectedTournament.TournamentID;

        // generate tournament dropdown HTML with Bootstrap styling
        const tournamentDropdownHtml = `
            <div class="form-group mb-4">
                <select id="tournament-select" class="form-select" style="max-width: 300px; border-radius: 8px; border: 1px solid #134c5b;" onchange="changeTournament(this.value)">
                    ${tournaments.map(t => `
                        <option value="${t.Name}" ${t.Name === selectedTournamentName ? 'selected' : ''}>
                            ${t.Name}
                        </option>
                    `).join('')}
                </select>
            </div>
        `;

        // fetch matches for the selected tournament
        const [matches] = await db.promise().execute(`
            SELECT 
                m.MatchID, m.RoundNumber, m.MatchDate,
                m.Team1ID, m.Team2ID, m.ScoreTeam1, m.ScoreTeam2, m.WinnerID,
                t1.Name AS Team1Name, t2.Name AS Team2Name, 
                wt.Name AS WinnerName
            FROM Matches m
            LEFT JOIN Teams t1 ON m.Team1ID = t1.TeamID
            LEFT JOIN Teams t2 ON m.Team2ID = t2.TeamID
            LEFT JOIN Teams wt ON m.WinnerID = wt.TeamID
            WHERE m.TournamentID = ? AND m.RoundNumber BETWEEN 3 AND 4
            ORDER BY m.RoundNumber, m.MatchDate
        `, [tournamentId]);

        // organize matches by round
        const semifinalMatches = matches.filter(m => m.RoundNumber === 3);
        const finalMatch = matches.find(m => m.RoundNumber === 4);

        // generate HTML for semifinals
        const semifinalHtml = semifinalMatches.map((m, index) =>
            generateSemifinalCardHTML(m, index === 0 ? 'left' : 'right')
        ).join('');

        // generate placeholders for missing semifinal matches
        const semifinalPlaceholders = Array.from({ length: Math.max(0, 2 - semifinalMatches.length) })
            .map((_, index) => generateSemifinalCardHTML(null, semifinalMatches.length === 1 ? 'right' : (index === 0 ? 'left' : 'right')))
            .join('');

        // generate HTML for final match
        const finalHtml = generateFinalCardHTML(finalMatch);

        // read template file and replace placeholders
        const templatePath = path.join(__dirname, 'public', 'brackets.html');
        const template = await fs.promises.readFile(templatePath, 'utf8');

        const html = template
            .replace('{{TOURNAMENT_DROPDOWN}}', tournamentDropdownHtml)
            .replace('{{SEMIFINAL_MATCHES}}', semifinalHtml)
            .replace('{{SEMIFINAL_PLACEHOLDERS}}', semifinalPlaceholders)
            .replace('{{FINAL_MATCH}}', finalHtml);

        res.send(html);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server error');
    }
});

/// helper function to generate semifinal match card HTML
function generateSemifinalCardHTML(match, position) {
    if (!match) return `
        <div class="semifinal-card ${position}-semifinal">
            <h4 class="card-title">Semifinal</h4>
            <div class="match-card text-center">
                <p class="text-muted">Match not scheduled</p>
            </div>
            <div class="connector ${position}-connector"></div>
        </div>
    `;

    return `
        <div class="semifinal-card ${position}-semifinal">
            <h4 class="card-title">Semifinal</h4>
            <div class="match-card">
                <div class="team-row">
                    <span class="team-name ${match.WinnerID === match.Team1ID ? 'winner' : ''}">${match.Team1Name || 'TBD'}</span>
                    <span class="vs-text">vs</span>
                    <span class="team-name ${match.WinnerID === match.Team2ID ? 'winner' : ''}">${match.Team2Name || 'TBD'}</span>
                </div>
                <div class="score-row">
                    <span class="team-score">${match.ScoreTeam1 || 0}</span>
                    <span class="vs-text">vs</span>
                    <span class="team-score">${match.ScoreTeam2 || 0}</span>
                </div>
                <div class="match-date">${new Date(match.MatchDate).toLocaleDateString()}</div>
            </div>
            <div class="connector ${position}-connector"></div>
        </div>
    `;
}

// helper function to generate final match card HTML
function generateFinalCardHTML(match) {
    if (!match) return `
        <h3 class="final-title">Grand Final</h3>
        <div class="match-card text-center">
            <p class="text-muted">Match not scheduled</p>
        </div>
    `;

    return `
        <h3 class="final-title">Grand Final</h3>
        <div class="match-card">
            <div class="team-row">
                <span class="team-name ${match.WinnerID === match.Team1ID ? 'winner' : ''}">${match.Team1Name || 'TBD'}</span>
                <span class="vs-text">vs</span>
                <span class="team-name ${match.WinnerID === match.Team2ID ? 'winner' : ''}">${match.Team2Name || 'TBD'}</span>
            </div>
            <div class="score-row">
                <span class="team-score">${match.ScoreTeam1 || 0}</span>
                <span class="vs-text">vs</span>
                <span class="team-score">${match.ScoreTeam2 || 0}</span>
            </div>
            <div class="match-date">${new Date(match.MatchDate).toLocaleDateString()}</div>
        </div>
    `;
}

// serve schedule page endpoint
app.get("/schedules", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "schedules.html"));
});

// serve details page endpoint
app.get("/details", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "details.html"));
});

// serve payment page endpoint
app.get("/payment", verifyRole(["Player"]), (req, res) => {
    const registrationId = req.query.registrationId;

    if (!req.session.userId) {
        return res.redirect('/login?redirect=/payment');
    }

    if (!registrationId) {
        return res.redirect('/');
    }

    // Check if this payment is for a valid registration by this user
    db.execute(`
        SELECT r.Status, p.PaymentID 
        FROM Registrations r
        LEFT JOIN Payments p ON p.UserID = r.UserID AND p.TournamentID = r.TournamentID
        WHERE r.UserID = ? AND p.PaymentID = ? AND r.Status = 'Verified'
    `, [req.session.userId, registrationId], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.redirect('/');
        }

        if (results.length === 0) {
            // Either the registration doesn't exist, doesn't belong to this user,
            // or the user is not a verified student
            return res.redirect('/');
        }

        // User is authorized to access the payment page
        res.sendFile(path.join(__dirname, "public", "payment.html"));
    });
});

app.get('/payment-success', verifyRole(["Player"]), (req, res) => {
    const paymentIntentId = req.query.payment_intent;
    const registrationId = req.query.registration_id;

    if (!req.session.userId) {
        return res.redirect('/login');
    }

    if (!paymentIntentId || !registrationId) {
        return res.redirect('/');
    }

    // Verify this payment is legitimate and belongs to this user
    // Also check if the success page has already been viewed
    db.execute(`
      SELECT p.Status, p.PaymentID, p.SuccessPageViewed, r.Status AS RegistrationStatus, 
             t.Name AS TournamentName, tm.Name AS TeamName
      FROM Payments p
      JOIN Registrations r ON r.UserID = p.UserID AND r.TournamentID = p.TournamentID
      JOIN Teams tm ON p.TeamID = tm.TeamID
      JOIN Tournaments t ON p.TournamentID = t.TournamentID
      WHERE p.UserID = ? AND p.PaymentID = ? AND p.Status = 'Completed'
      AND r.Status = 'Verified'
    `, [req.session.userId, registrationId], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.redirect('/');
        }

        if (results.length === 0) {
            // Either the payment doesn't exist, doesn't belong to this user,
            // or hasn't been completed
            return res.redirect('/');
        }

        // Check if the success page has already been viewed
        if (results[0].SuccessPageViewed) {
            console.log("Payment success page already viewed for payment ID:", registrationId);
            return res.redirect('/schedules'); // Redirect to schedules or another appropriate page
        }

        // Mark this payment as viewed in the success page to prevent multiple views
        db.execute(`
        UPDATE Payments 
        SET SuccessPageViewed = TRUE 
        WHERE PaymentID = ? AND UserID = ?
      `, [registrationId, req.session.userId], (updateErr) => {
            if (updateErr) {
                console.error("Error updating payment record:", updateErr);
            }

            // Render a dynamic success page with transaction details
            // This is more secure than serving a static HTML file
            res.send(`
          <!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tournament Signup Success - A New World</title>
    
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;700&display=swap" rel="stylesheet">

    <!-- Bootstrap JS (Optional) -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>

    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">

    <!-- Custom CSS -->
    <link rel="stylesheet" href="/css/styles.css">
    
    <style>
        body {
            height: 100vw !important;
        }
        .container {
            margin-top: 4rem !important;
        }
    </style>
</head>

<body>
    <!-- Navbar -->
    <nav class="navbar">
        <a href="/" class="navbar-logo">Aardvark Games</a>
        <div class="navbar-links">
            <a href="/colleges" class="nav-link" draggable="false">Colleges</a>
            <a href="/teams" class="nav-link" draggable="false">Teams</a>
            <a href="/brackets" class="nav-link" draggable="false">Brackets</a>
            <a href="/schedules" class="nav-link" draggable="false">Schedules</a>
            <a href="/news" class="nav-link" draggable="false">News</a>
            <a href="/about" class="nav-link" draggable="false">About Us</a>
            <a href="/signup" class="nav-link" draggable="false">Account</a>
        </div>
    </nav>

    <!-- Main Content -->
    <main class="container text-center py-5">
        <h1 class="mb-4">Payment Successful!</h1>
        <p class="lead mb-4">Thank you for your payment. Your registration has been completed successfully.</p>
        <img src="/media/img/payment-success.png" alt="Payment Success" class="img-fluid mb-4"
            style="max-width: 250px;">
        <p>We look forward to seeing you participate in the tournament!</p>

        <!-- Button to redirect to home -->
        <a href="/" class="btn btn-primary mt-3">Return to Home</a>
    </main>

    <!-- External Scripts -->
    <script src="/js/handleacc.js" defer></script>
</body>

</html>
        `);
        });
    });
});



// serve news page endpoint
app.get("/news", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "news.html"));
});

// serve tournament register page endpoint
app.get("/tournament-register", (req, res) => {
    // Check if user is logged in
    if (!req.session.userId) {
        // Not logged in, redirect to login page with return URL
        return res.redirect('/login?redirect=/tournament-register');
    } else {
        res.sendFile(path.join(__dirname, "public", "tournament-register.html"));
    }
});

// serve login page endpoint
app.get("/login", (req, res) => {
    if (req.session.userId) { // logged in check
        // user is already logged in, redirect to home page
        return res.redirect("/");
    }
    res.sendFile(path.join(__dirname, "public", "login.html")); // not logged in, redirect to login page
});

// serve sign up page endpoint
app.get("/signup", (req, res) => {
    if (req.session.userId) { // logged in check
        // user is already logged in, redirect
        if (req.session.role == "Admin" || req.session.role == "SuperAdmin") { // admins check
            return res.redirect("account.html"); // redirect to role management for admins
        } else {
            return res.redirect("/"); // redirect to home page for other users
        }
    }
    res.sendFile(path.join(__dirname, "public", "signup.html")); // not logged in, redirect to sign up page
});

// serve reports page endpoint
app.get("/reports", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "reports.html"));
});

// session check endpoint
app.get("/check-session", (req, res) => {
    return res.json({
        loggedIn: !!req.session.userId,
        role: req.session.role || null
    });
});


// ======================== USER AUTHENTICATION ========================

// login endpoint
app.post("/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Please fill all fields." });
    }

    db.execute("SELECT * FROM Users WHERE Email = ?", [email], async (err, results) => {
        if (err) throw err;

        if (results.length === 0) {
            return res.status(401).json({ message: "Invalid email or password. Please retry." });
        }

        const user = results[0];
        console.log(results[0]);

        // compare password with hashed password
        const isMatch = await bcrypt.compare(password, user.Password);

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password. Please retry." });
        }

        // store user info in session
        req.session.userId = user.UserID;
        req.session.username = user.Name;
        req.session.role = user.Role; // role saved to session for authorization purposes

        res.json({ message: "Login successful!" });
    });
});

// sign up endpoint
app.post("/signup", async (req, res) => {
    const { username, email, password } = req.body;

    // check inputs
    if (!username || !email || !password) {
        return res.status(400).json({ message: "Please fill all of the fields correctly." });
    }

    // validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format. Please retry." });
    }

    // validate password
    const passwordRegex = /^(?=.*[a-zA-Z]).{6,}$/;
    if (!passwordRegex.test(password)) {
        return res.status(400).json({ message: "Password must have 6 characters and contain a letter." });
    }

    // check for existing email in database
    db.execute("SELECT * FROM Users WHERE Email = ?", [email], async (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Database error. Please try again later." });
        }

        if (results.length > 0) {
            // check whether email exists already
            const copycat = results[0];
            if (copycat.Email === email) {
                return res.status(400).json({ message: "Email already in use. Try logging in." });
            }
        }

        // hash password using bcrypt before deploying to database
        const hashedPassword = await bcrypt.hash(password, 10);

        // insert new user into database (default role upon creation is 'User')
        const role = "User";
        db.execute(
            "INSERT INTO Users (Name, Email, Password, Role) VALUES (?, ?, ?, ?)",
            [username, email, hashedPassword, role],
            (err, results) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ message: "Database error. Please try again later." });
                }

                res.status(201).json({ message: "User registered successfully!" });
            }
        );
    });
});

// logout endpoint
app.get("/logout", (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/');
    }
    req.session.destroy((err) => {
        if (err) {
            console.error("Logout error:", err);
            return res.status(500).json({ success: false, message: "Logout failed" });
        }
        res.clearCookie("connect.sid", { path: "/" });
        res.redirect("/");
    });
});


// ======================== COLLEGE & TEAM MANAGEMENT ========================

// fetch all colleges endpoint
app.get("/universities", (req, res) => {
    db.execute("SELECT * FROM University", (err, results) => {
        if (err) {
            console.error("Database query error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json(results);
    });
});

// get all or search colleges endpoint
app.get("/fetchColleges", verifyRole(["SuperAdmin", "Admin"]), (req, res) => {
    const searchTerm = req.query.search;
    let query = "SELECT UniversityID, Name, Location, Founded, Description, Emblem, ImageURL FROM University";
    let params = [];
    if (searchTerm && searchTerm.trim() !== '') {
        query += " WHERE Name LIKE ?";
        params = [`%${searchTerm}%`];
    }
    db.execute(query, params, (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ message: "Internal server error" });
        }
        res.json(results);
    });
});

// fetch college by id or name endpoint
app.get("/university", (req, res) => {
    const { name, id } = req.query;

    if (!name && !id) {
        return res.status(400).json({ error: "Missing college name or ID" });
    }

    let query;
    if (name) {
        query = "SELECT * FROM University WHERE Name = ?";
        db.execute(query, [name], (err, results) => {
            handleResponse(err, results, res);
        });
    } else if (id) {
        query = "SELECT * FROM University WHERE UniversityID = ?";
        db.execute(query, [id], (err, results) => {
            handleResponse(err, results, res);
        });
    }
});

// helper function to handle response
function handleResponse(err, results, res) {
    if (err) {
        console.error("Database query error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }

    if (results.length === 0) {
        return res.status(404).json({ error: "College not found" });
    }

    res.json(results[0]);
}

// add college endpoint
app.post("/add-college", verifyRole(["SuperAdmin", "Admin"]), (req, res) => {
    const { name, location, founded, description, logoURL, pictureURL } = req.body;
    db.execute("INSERT INTO University (Name, Location, Founded, Emblem, ImageURL, Description) VALUES (?, ?, ?, ?, ?, ?)", [name, location, founded, logoURL, pictureURL, description], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error. Please try again later." });
        res.status(201).json({ message: "College added successfully!" });
    });
});


// edit college endpoint
app.put("/edit-college/:collegeId", verifyRole(["SuperAdmin", "Admin"]), (req, res) => {
    const { name, location, founded, description, logoURL, pictureURL } = req.body;
    const collegeId = req.params.collegeId;

    db.execute("UPDATE University SET Name = ?, Location = ?, Founded = ?, Emblem = ?, ImageURL = ?, Description = ? WHERE UniversityID = ?", [name, location, founded, logoURL, pictureURL, description, collegeId], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error. Please try again later." });

        res.json({ message: "College updated successfully!" });
    });
});

// delete college endpoint
app.delete("/delete-college/:collegeId", verifyRole(["SuperAdmin", "Admin"]), (req, res) => {
    const collegeId = req.params.collegeId;
    db.execute("DELETE FROM University WHERE UniversityID = ?", [collegeId], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error. Please try again later." });
        res.json({ message: "College deleted successfully!" });
    });
});


// fetch all teams endpoint
app.get("/api/teams", (req, res) => {
    db.execute(`
        SELECT t.TeamID, t.Name, t.UniversityID, u.Name AS UniversityName, t.CreatedDate
        FROM Teams t
        JOIN University u ON t.UniversityID = u.UniversityID
    `, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Database error." });
        }
        res.json(results);
    });
});

// fetch teams and players for a college endpoint
app.get("/teams-for-college", (req, res) => {
    const collegeName = req.query.name;
    db.execute(`
        SELECT t.Name, t.TeamID, p.UserID, u1.Name AS PlayerName, p.ImageURL, p.Role
        FROM Teams t
        JOIN University u2 ON t.UniversityID = u2.UniversityID
        LEFT JOIN Players p ON t.TeamID = p.TeamID
        LEFT JOIN Users u1 ON p.UserID = u1.UserID
        WHERE u2.Name = ?
        ORDER BY t.TeamID, p.Role DESC, u1.Name
    `, [collegeName], (err, results) => {
        if (err) {
            console.error("Database query error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json(results);
    });
});

// add team endpoint
app.post("/add-team", verifyRole(["SuperAdmin", "Admin"]), (req, res) => {
    const { name, universityId } = req.body;
    const desc = "";
    // add validation logging
    console.log("Team creation attempt:", { name, universityId });

    // check if required fields are provided
    if (!name || !universityId) {
        console.error("Missing required fields:", { name, universityId });
        return res.status(400).json({ message: "Missing required fields" });
    }

    db.execute("INSERT INTO Teams (Name, UniversityID, Description) VALUES (?, ?, ?)",
        [name, universityId, desc],
        (err, result) => {
            if (err) {
                // enhanced error logging
                console.error("Database error when adding team:", {
                    error: err.message,
                    code: err.code,
                    sqlState: err.sqlState,
                    sqlMessage: err.sqlMessage,
                    teamName: name,
                    universityId: universityId
                });

                // return more specific error messages
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ message: "Team name already exists" });
                } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
                    return res.status(400).json({ message: "Selected university doesn't exist" });
                }

                return res.status(500).json({ message: "Database error. Please try again later." });
            }

            console.log("Team created successfully:", {
                teamId: result.insertId,
                teamName: name,
                universityId: universityId
            });

            res.status(201).json({
                message: "Team added successfully!",
                teamId: result.insertId
            });
        }
    );
});

// edit team endpoint
app.put("/edit-team/:teamId", verifyRole(["SuperAdmin", "Admin"]), (req, res) => {
    const { name, universityId, newLeaderId, memberToDeleteId } = req.body;
    const teamId = req.params.teamId;

    db.beginTransaction(async (err) => {
        if (err) {
            return res.status(500).json({ message: "Database error. Please try again later." });
        }

        try {
            // update team name and university
            await db.promise().execute("UPDATE Teams SET Name = ?, UniversityID = ? WHERE TeamID = ?", [name, universityId, teamId]);

            if (newLeaderId) {
                // set all team members' role to 'Member'
                await db.promise().execute("UPDATE Players SET Role = 'Member' WHERE TeamID = ?", [teamId]);
                // set new leader
                await db.promise().execute("UPDATE Players SET Role = 'Leader' WHERE UserID = ? AND TeamID = ?", [newLeaderId, teamId]);
            }

            if (memberToDeleteId) {
                // remove member from team (delete from Players table)
                await db.promise().execute("DELETE FROM Players WHERE UserID = ? AND TeamID = ?", [memberToDeleteId, teamId]);
                // Update user role to 'User'
                await db.promise().execute("UPDATE Users SET Role = 'User' WHERE UserID = ?", [memberToDeleteId]);
            }

            await db.promise().commit();
            res.json({ message: "Team updated successfully!" });
        } catch (error) {
            await db.promise().rollback();
            console.error("Error updating team:", error);
            res.status(500).json({ message: "Database error. Please try again later." });
        }
    });
});

// delete team endpoint
app.delete("/delete-team/:teamId", verifyRole(["SuperAdmin", "Admin"]), (req, res) => {
    const teamId = req.params.teamId;
    db.execute("DELETE FROM Teams WHERE TeamID = ?", [teamId], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error. Please try again later." });
        res.json({ message: "Team deleted successfully!" });
    });
});

// fetch a team endpoint
app.get("/team", (req, res) => {
    const { id } = req.query;
    if (!id) {
        return res.status(400).json({ error: "Missing team ID" });
    }
    db.execute("SELECT * FROM Teams WHERE TeamID = ?", [id], (err, results) => {
        if (err) {
            console.error("Database query error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: "Team not found" });
        }
        res.json(results[0]);
    });
});

// search teams endpoint
app.get("/search-teams", (req, res) => {
    const { query } = req.query;
    if (!query) {
        return res.status(400).json({ message: "Search query is required." });
    }
    db.execute(
        "SELECT t.TeamID, t.Name, t.UniversityID, u.Name AS UniversityName, t.CreatedDate FROM Teams t JOIN University u ON t.UniversityID = u.UniversityID WHERE t.Name LIKE ? OR u.Name LIKE ?",
        [`%${query}%`, `%${query}%`],
        (err, results) => {
            if (err) return res.status(500).json({ message: "Database error. Please try again later." });
            res.json(results); // always return results, even if empty
        }
    );
});

// fetch team members endpoint
app.get("/team-members", (req, res) => {
    const { teamId } = req.query;
    if (!teamId) {
        return res.status(400).json({ error: "Missing team ID" });
    }
    db.execute(`
        SELECT u.UserID, u.Name, p.Role
        FROM Users u
        JOIN Players p ON u.UserID = p.UserID
        WHERE p.TeamID = ?
        ORDER BY p.Role DESC, u.Name
    `, [teamId], (err, results) => {
        if (err) {
            console.error("Database query error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json(results);
    });
});

// TEAMS

app.get('/teams/:teamName', async (req, res) => {
    try {
        const teamName = decodeURIComponent(req.params.teamName);
        const userId = req.session.userId; // undefined if not logged in

        // get team + university data
        const [team] = await db.promise().execute(`
            SELECT 
                t.*,
                u.Name AS UniversityName,
                u.ImageURL AS UniversityImage,
                u.Emblem AS UniversityEmblem
            FROM Teams t
            LEFT JOIN University u ON t.UniversityID = u.UniversityID
            WHERE t.Name = ?
        `, [teamName]);

        if (!team[0]) res.redirect("/teams"); //res.status(404).send('Team not found');

        let isMember = false;

        // check membership only if user is logged in
        if (userId) {
            [isMember] = await db.promise().execute(`
                SELECT 1 FROM Players 
                WHERE TeamID = ? AND UserID = ?
            `, [
                team[0].TeamID,
                userId
            ]);
        }

        // get team members (public info)
        const [players] = await db.promise().execute(`
            SELECT p.*, u.Name 
            FROM Players p
            JOIN Users u ON p.UserID = u.UserID
            WHERE p.TeamID = ?
        `, [team[0].TeamID]);

        // check if the team has members and create appropriate content
        let teamMembersHTML;
        if (players.length === 0) {
            teamMembersHTML = `
                <li class="list-group-item text-center">
                    <p class="mb-0 text-muted">This team currently has no members.</p>
                </li>
            `;
        } else {
            teamMembersHTML = players.map(p => `
                <li class="list-group-item d-flex align-items-center">
                    <span class="badge bg-primary me-2">${p.Role || 'Member'}</span>
                    ${p.Name}
                </li>
            `).join('');
        }

        // build template
        const html = (await fs.promises.readFile('public/team.html', 'utf8'))
            .replace(/{{TEAM_NAME}}/g, team[0].Name)
            .replace(/{{TEAM_IMAGE}}/g, team[0].ImageURL || team[0].UniversityEmblem)
            .replace(/{{TEAM_DESCRIPTION}}/g, team[0].Description || 'No description available.')
            .replace(/{{UNIVERSITY_NAME}}/g, team[0].UniversityName)
            .replace(/{{UNIVERSITY_IMAGE}}/g, team[0].UniversityImage || '/media/img/new-world.jpg')
            .replace('{{EDIT_BUTTON}}', isMember.length ? `
                <div class="mt-0 text-end p-1">
                    <a href="/teams/${team[0].TeamID}/edit" class="btn btn-primary">Edit Profile</a>
                </div>` : '')
            .replace('{{TEAM_MEMBERS}}', teamMembersHTML);

        res.send(html);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server error');
    }
});

// serve team edit page endpoint
app.get('/teams/:teamId/edit', async function (req, res) {
    try {
        const teamId = req.params.teamId;
        const userId = req.session.userId;

        // ensure the user is logged in
        if (!userId) {
            return res.redirect('/login'); // redirect to login if not authenticated
        }

        // Check if user is a member of the team
        const [userTeam] = await db.promise().execute(
            'SELECT * FROM Players WHERE UserID = ? AND TeamID = ?',
            [userId, teamId]
        );

        if (!userTeam[0] || userTeam[0].length === 0) {
            res.redirect("/teams");
            //return res.status(403).sendFile(path.join(__dirname, 'public', '403.html')); // Unauthorized
        }

        // get team details
        const [teamResults] = await db.promise().execute(
            'SELECT Name, ImageURL, Description FROM Teams WHERE TeamID = ?',
            [teamId]
        );

        if (!teamResults[0] || teamResults[0].length === 0) {
            res.redirect("/teams");
            //return res.status(404).sendFile(path.join(__dirname, 'public', '404.html')); // Not Found
        }

        // read the edit team template file
        fs.readFile(path.join(__dirname, 'public', 'edit-team.html'), 'utf8', function (err, data) {
            if (err) {
                console.error('Error reading edit team template:', err);
                return res.status(500).send('Server error');
            }

            // replace placeholders with actual data
            let html = data.replace('{{TEAM_NAME}}', teamResults[0].Name)
                .replace('{{TEAM_IMAGE_URL}}', teamResults[0].ImageURL || '')
                .replace('{{TEAM_DESCRIPTION}}', teamResults[0].Description || '');

            res.send(html);
        });
    } catch (error) {
        console.error('Error fetching team for editing:', error);
        res.status(500).send('Server error');
    }
});

// team update endpoint
app.post('/teams/:teamId/update', async function (req, res) {
    try {
        const teamId = req.params.teamId;
        const userId = req.session.userId;

        // ensure the user is logged in
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { imageURL, description } = req.body;

        // check if user is a member of the team
        const [userTeam] = await db.promise().execute(
            'SELECT * FROM Players WHERE UserID = ? AND TeamID = ?',
            [userId, teamId]
        );

        if (!userTeam[0] || userTeam[0].length === 0) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // update team profile
        await db.promise().execute(
            'UPDATE Teams SET ImageURL = ?, Description = ? WHERE TeamID = ?',
            [imageURL, description, teamId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating team profile:', error);
        res.status(500).json({ error: 'Server error' });
    }
});


// ======================== TOURNAMENT MANAGEMENT ========================

// sign up for a tournament endpoint  || NEEDS UPDATE !
app.post("/signup-tournament", (req, res) => {
    const { tournamentId, teamId } = req.body;
    const userId = req.session.userId;

    db.execute("SELECT TeamID FROM Users WHERE UserID = ?", [userId], (err, results) => {
        if (err) return res.status(500).json({ message: "Database error. Please try again later." });

        if (results[0]?.TeamID && !teamId) {
            return res.status(400).json({ message: "You are in a team and must sign up as a team. Please retry." });
        }

        db.execute("INSERT INTO Registrations (UserID, TournamentID, TeamID) VALUES (?, ?, ?)", [userId, tournamentId, teamId || null], (err, result) => {
            if (err) return res.status(500).json({ message: "Database error. Please try again later." });

            res.status(201).json({ message: "Successfully signed up for the tournament! Good luck!" });
        });
    });
});

// cancel tournament sign up endpoint (only for the creator of the team)
app.delete("/cancel-tournament-signup/:tournamentId", (req, res) => {
    const tournamentId = req.params.tournamentId;
    const userId = req.session.userId;

    if (!userId) {
        return res.status(401).json({ message: "Please log in first." });
    }

    // check if the user is the one who registered for the tournament
    db.execute(
        `SELECT * FROM Registrations 
         WHERE TournamentID = ? 
         AND (UserID = ? OR (TeamID IS NOT NULL AND UserID = (SELECT UserID FROM Registrations WHERE TournamentID = ? AND TeamID IN (SELECT TeamID FROM Users WHERE UserID = ?) LIMIT 1)))`,
        [tournamentId, userId, tournamentId, userId],
        (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: "Database error. Please try again later." });
            }

            if (results.length === 0) {
                return res.status(403).json({ message: "Sorry, you do not have permission to cancel this registration." });
            }

            // remove the registration
            db.execute(
                "DELETE FROM Registrations WHERE TournamentID = ? AND (UserID = ? OR (TeamID IS NOT NULL AND UserID = (SELECT UserID FROM Registrations WHERE TournamentID = ? AND TeamID IN (SELECT TeamID FROM Users WHERE UserID = ?) LIMIT 1)))",
                [tournamentId, userId, tournamentId, userId],
                (err, result) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ message: "Database error. Please try again later." });
                    }
                    res.json({ message: "Successfully cancelled tournament signup. Sorry to have you leave :(" });
                }
            );
        }
    );
});

// leave a team endpoint  ||  NEEDS TO CHECK IF LEADER AND IF LEADER CAN BE ASSIGNED, AND DELETE TEAM IF LAST MEMBER !
app.delete("/leave-team", verifyRole(["Player"]), (req, res) => {
    const userId = req.session.userId;

    db.execute("UPDATE Users SET TeamID = NULL, Role = 'User' WHERE UserID = ?", [userId], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error." });

        res.json({ message: "You left the team successfully!" });
    });
});

// create a tournament endpoint
app.post("/add-tournament", verifyRole(["SuperAdmin", "Admin"]), (req, res) => {
    const { name, startDate, location } = req.body;

    db.execute("INSERT INTO Tournaments (TournamentName, StartDate, Location) VALUES (?, ?, ?)", [name, startDate, location], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error." });

        res.status(201).json({ message: "Tournament created successfully!" });
    });
});

// ======================== TOURNAMENT EXECUTION MANAGEMENT ========================

// fetch schedules route endpoint  || NEEDS UPDATE !
app.get("/schedules", (req, res) => {
    const limit = req.query.limit || 6; // default limit
    const offset = req.query.offset || 1; // default offset

    db.execute(`
        SELECT s.ScheduleID, m.MatchID, m.Team1ID, m.Team2ID, t1.Name AS Team1Name, t2.Name AS Team2Name, s.ScheduledDate
        FROM Schedule s
        JOIN Matches m ON s.MatchID = m.MatchID
        JOIN Teams t1 ON m.Team1ID = t1.TeamID
        JOIN Teams t2 ON m.Team2ID = t2.TeamID
        ORDER BY s.ScheduledDate ASC
        LIMIT ? OFFSET ?`, [limit, offset], (err, results) => {
        if (err) {
            console.error("Database query error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json(results);
    });
});

// add schedule endpoint  || NEEDS UPDATE !
app.post("/add-schedule", verifyRole(["SuperAdmin", "Admin"]), async (req, res) => {
    const { tournamentId, matchDate } = req.body;

    db.execute(
        "INSERT INTO Schedule (TournamentID, ScheduledDate) VALUES (?, ?)",
        [tournamentId, matchDate],
        (err, result) => {
            if (err) return res.status(500).json({ message: "Database error." });
            res.status(201).json({ message: "Schedule added successfully!" });
        }
    );
});

// post results endpoint  || NEEDS UPDATE !
app.post("/post-results", verifyRole(["SuperAdmin", "Admin"]), async (req, res) => {
    const { matchId, scoreTeam1, scoreTeam2 } = req.body;

    const winnerId =
        scoreTeam1 > scoreTeam2
            ? `(SELECT Team1ID FROM Matches WHERE MatchID = ?)`
            : `(SELECT Team2ID FROM Matches WHERE MatchID = ?)`;

    db.execute(
        `UPDATE Matches SET ScoreTeam1 = ?, ScoreTeam2 = ?, WinnerID = ${winnerId} WHERE MatchID = ?`,
        [scoreTeam1, scoreTeam2, matchId],
        (err, result) => {
            if (err) return res.status(500).json({ message: "Database error." });
            res.json({ message: "Results posted successfully!" });
        }
    );
});


// ======================== REPORT GENERATION ========================  ||  NEEDS UPDATE !

app.get("/generate-report", verifyRole(["SuperAdmin", "Admin"]), async (req, res) => {
    db.execute(
        `SELECT t.Name AS TeamName, u.Name AS UniversityName
       FROM Teams t
       JOIN University u ON t.UniversityID = u.UniversityID`,
        [],
        async (err, results) => {
            if (err) return res.status(500).json({ message: "Database error." });

            // generate CSV report
            let csvContent =
                "Team Name,University Name\n" +
                results.map(row => `${row.TeamName},${row.UniversityName}`).join("\n");

            // send as downloadable file
            res.setHeader("Content-Type", "text/csv");
            res.setHeader(
                "Content-Disposition",
                'attachment; filename="team-university-report.csv"'
            );
            res.send(csvContent);
        }
    );
});


// ======================== ADMIN MANAGEMENT ========================

// fetch available roles based on current user admin privileges endpoint
app.get("/roles", verifyRole(["SuperAdmin", "Admin"]), (req, res) => {
    let roles = [];
    if (req.session.role === "Admin") {
        roles = VALID_ROLES.filter(role => !["Admin", "SuperAdmin"].includes(role));
    } else if (req.session.role === "SuperAdmin") {
        roles = VALID_ROLES.filter(role => role !== "SuperAdmin");
    }
    res.json(roles);
});

// get user id, name, role endpoint
app.get('/user-info', (req, res) => {
    if (req.session.userId) {
        res.json({
            userId: req.session.userId,
            name: req.session.username,
            role: req.session.role
        });
    } else {
        res.status(401).json({ message: 'Not authenticated' });
    }
});

// Get user info for tournament endpoint
app.get("/user-info-tournament", (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: "Not logged in" });
    }

    db.execute(`
        SELECT UserID, Name 
        FROM Users
        WHERE UserID = ?
    `, [req.session.userId], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json(results[0]);
    });
});


// get all or search users endpoint
app.get("/users", verifyRole(["SuperAdmin", "Admin"]), (req, res) => {
    const searchTerm = req.query.search;
    let query = "SELECT UserID, Name, Email, Role FROM Users";
    let params = [];
    if (searchTerm && searchTerm.trim() !== '') {
        query += " WHERE Name LIKE ? OR Email LIKE ?";
        params = [`%${searchTerm}%`, `%${searchTerm}%`];
    }
    db.execute(query, params, (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ message: "Internal server error" });
        }
        res.json(results);
    });
});

// display all necessary information when editing user, including Player specific info endpoint
app.get("/user/:userId", verifyRole(["SuperAdmin", "Admin"]), async (req, res) => {
    const userId = req.params.userId;
    try {
        const [user] = await db.promise().query(
            `SELECT u.*, p.ImageURL, p.ValidStudent, p.TeamID 
             FROM Users u 
             LEFT JOIN Players p ON u.UserID = p.UserID 
             WHERE u.UserID = ?`,
            [userId]
        );
        if (user.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json(user[0]);
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// add user endpoint  ||  MISSING CHECK FOR EXISTING EMAIL !
app.post("/add-user", verifyRole(["SuperAdmin", "Admin"]), async (req, res) => {
    const { firstName, lastName, email, password, role, imageURL, validStudent, teamId } = req.body;
    const fullName = `${firstName} ${lastName}`;
    const currentRole = req.session.role;

    if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
    }

    // validate allowed roles
    if (currentRole === "Admin" && ["Admin", "SuperAdmin"].includes(role)) {
        return res.status(403).json({ message: "Admin cannot create admin users" });
    }
    if (currentRole === "SuperAdmin" && role === "SuperAdmin") {
        return res.status(403).json({ message: "Cannot create SuperAdmin users" });
    }

    // validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
    }

    // validate password
    const passwordRegex = /^(?=.*[a-zA-Z]).{6,}$/;
    if (!passwordRegex.test(password)) {
        return res.status(400).json({ message: "Password must have 6 characters and contain a letter" });
    }

    const hashedPassword = await bcrypt.hash(password, 10); // hash password

    db.beginTransaction(async (err) => {
        if (err) {
            return res.status(500).json({ message: "Database error. Please try again later." });
        }

        try {
            const [result] = await db.promise().execute(
                "INSERT INTO Users (Name, Email, Password, Role) VALUES (?, ?, ?, ?)",
                [fullName, email, hashedPassword, role]
            );

            const userId = result.insertId;

            // add user to role-specific table
            switch (role) {
                case 'Player':
                    await db.promise().execute(
                        "INSERT INTO Players (UserID, Role, ImageURL, ValidStudent, TeamID) VALUES (?, ?, ?, ?, ?)",
                        [userId, 'Member', imageURL, validStudent, teamId]
                    );
                    break;
                case 'CollegeRep':
                    await db.promise().execute("INSERT INTO CollegeRep (UserID) VALUES (?)", [userId]);
                    break;
                case 'Moderator':
                    await db.promise().execute("INSERT INTO Moderators (UserID) VALUES (?)", [userId]);
                    break;
                case 'Admin':
                    await db.promise().execute("INSERT INTO Admins (UserID) VALUES (?)", [userId]);
                    break;
            }

            await db.promise().commit();
            res.status(201).json({ message: "User added successfully!" });
        } catch (error) {
            await db.promise().rollback();
            console.error("User creation error:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    });
});

// edit user endpoint
app.put("/edit-user/:userId", verifyRole(["SuperAdmin", "Admin"]), async (req, res) => {
    const { name, email, role, imageURL, validStudent, teamId } = req.body;
    const userId = req.params.userId;
    const currentUserRole = req.session.role;
    const currentUserId = req.session.userId;

    try {
        const [targetUser] = await db.promise().query('SELECT Role FROM Users WHERE UserID = ?', [userId]);
        if (targetUser.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        // prevent any modifications to SuperAdmin users
        if (targetUser[0].Role === "SuperAdmin") {
            return res.status(403).json({ message: "Cannot modify SuperAdmin users" });
        }

        // prevent Admins from modifying other Admins
        if (currentUserRole === "Admin" && targetUser[0].Role === "Admin") {
            if (currentUserId === parseInt(userId)) {
                return res.status(403).json({ message: "Cannot change your own role" });
            } else {
                return res.status(403).json({ message: "Admins cannot modify other Admins" });
            }
        }

        // prevent assigning SuperAdmin role
        if (role === "SuperAdmin") {
            return res.status(403).json({ message: "Cannot assign SuperAdmin role" });
        }

        // authorization checks for Admin
        if (currentUserRole === "Admin") {
            if (["Admin", "SuperAdmin"].includes(role)) {
                return res.status(403).json({ message: "Admin cannot assign admin roles" });
            }
            if (currentUserId === parseInt(userId)) {
                return res.status(403).json({ message: "Cannot change your own role" });
            }
        }

        /*//  ||  NOT WORKING NEEDS FIXING !
        if(teamId < 0 && !teamId === null) {
            return res.status(400).json({ message: "Invalid TeamID it cannot be less than zero" });
        }

        if(validStudent !== (0 || 1)) {
            return res.status(400).json({ message: "Invalid ValidStudent must be 0 if not and 1 if yes" });
        }*/

        await db.promise().beginTransaction();

        // update user information
        await db.promise().execute(
            "UPDATE Users SET Name = ?, Email = ?, Role = ? WHERE UserID = ?",
            [name, email, role, userId]
        );

        // delete from role specific table
        switch (targetUser[0].Role) {
            case "Player":
                await db.promise().execute("DELETE FROM Players WHERE UserID = ?", [userId]);
                break;
            case "CollegeRep":
                await db.promise().execute("DELETE FROM CollegeRep WHERE UserID = ?", [userId]);
                break;
            case "Moderator":
                await db.promise().execute("DELETE FROM Moderators WHERE UserID = ?", [userId]);
                break;
            case "Admin":
                await db.promise().execute("DELETE FROM Admins WHERE UserID = ?", [userId]);
                break;
        }

        // add to the appropriate role-specific table
        switch (role) {
            case 'Player':
                await db.promise().execute(
                    "INSERT INTO Players (UserID, Role, ImageURL, ValidStudent, TeamID) VALUES (?, ?, ?, ?, ?)",
                    [userId, 'Member', imageURL, validStudent || 0, teamId || null]
                );
                break;
            case 'CollegeRep':
                await db.promise().execute("INSERT INTO CollegeRep (UserID) VALUES (?)", [userId]);
                break;
            case 'Moderator':
                await db.promise().execute("INSERT INTO Moderators (UserID) VALUES (?)", [userId]);
                break;
            case 'Admin':
                await db.promise().execute("INSERT INTO Admins (UserID) VALUES (?)", [userId]);
                break;
        }

        await db.promise().commit();
        res.json({ message: "User updated successfully" });
    } catch (error) {
        await db.promise().rollback();
        console.error("User update error:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
});

// delete user endpoint
app.delete("/delete-user/:userId", verifyRole(["SuperAdmin", "Admin"]), async (req, res) => {
    const userId = req.params.userId;
    const currentUserId = req.session.userId;

    try {
        const [targetUser] = await db.promise().query('SELECT Role FROM Users WHERE UserID = ?', [userId]);

        if (targetUser.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        // prevent deletion of SuperAdmin users
        if (targetUser[0].Role === "SuperAdmin") {
            return res.status(403).json({ message: "Cannot delete SuperAdmin users" });
        }

        // prevent Admins from deleting other Admins
        if (req.session.role === "Admin" && targetUser[0].Role === "Admin") {
            if (currentUserId === userId) {
                return res.status(403).json({ message: "Cannot delete yourself" });
            } else {
                return res.status(403).json({ message: "Admins cannot delete other Admins" });
            }
        }

        // prevent deleting yourself
        if (currentUserId === userId) {
            return res.status(403).json({ message: "Cannot delete yourself" });
        }

        await db.promise().beginTransaction();

        // delete from role specific table
        switch (targetUser[0].Role) {
            case "Player":
                await db.promise().execute("DELETE FROM Players WHERE UserID = ?", [userId]);
                break;
            case "CollegeRep":
                await db.promise().execute("DELETE FROM CollegeRep WHERE UserID = ?", [userId]);
                break;
            case "Moderator":
                await db.promise().execute("DELETE FROM Moderators WHERE UserID = ?", [userId]);
                break;
            case "Admin":
                await db.promise().execute("DELETE FROM Admins WHERE UserID = ?", [userId]);
                break;
        }

        // delete from Users table
        await db.promise().execute("DELETE FROM Users WHERE UserID = ?", [userId]);

        await db.promise().commit();
        res.json({ message: "User deleted successfully!" });
    } catch (error) {
        await db.promise().rollback();
        console.error("User deletion error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// fetch a player by UserID endpoint
app.get("/player/:userId", async (req, res) => {
    const userId = req.params.userId;
    try {
        const [player] = await db.promise().query(
            `SELECT * FROM Players WHERE UserID = ?`,
            [userId]
        );
        if (player.length === 0) {
            return res.status(404).json({ message: "Player not found" });
        }
        res.json(player[0]);
    } catch (error) {
        console.error("Error fetching player:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post('/create-payment-intent', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const { registrationId } = req.body;

    if (!registrationId) {
        return res.status(400).json({ error: 'Registration ID is required' });
    }

    try {
        // First get the registration details
        const [registrationDetails] = await db.promise().execute(
            `SELECT TournamentID, TeamID FROM Registrations 
             WHERE RegistrationID = ? AND UserID = ? AND Status = 'Verified'`,
            [registrationId, req.session.userId]
        );

        if (registrationDetails.length === 0) {
            return res.status(404).json({ error: 'Registration not found or not verified' });
        }

        // Then get or create a payment record
        const [paymentDetails] = await db.promise().execute(
            `SELECT PaymentID, Amount FROM Payments 
             WHERE UserID = ? AND TeamID = ? AND TournamentID = ? AND Status = 'Pending'`,
            [req.session.userId, registrationDetails[0].TeamID, registrationDetails[0].TournamentID]
        );

        let amount;
        let paymentId;

        if (paymentDetails.length === 0) {
            // No payment record exists yet, create one
            const tournamentFee = 10.00; // Default fee, could be fetched from tournament settings

            const [insertResult] = await db.promise().execute(
                `INSERT INTO Payments (UserID, TeamID, TournamentID, Amount, Status) 
                 VALUES (?, ?, ?, ?, 'Pending')`,
                [req.session.userId, registrationDetails[0].TeamID, registrationDetails[0].TournamentID, tournamentFee]
            );

            amount = tournamentFee;
            paymentId = insertResult.insertId;
        } else {
            // Payment record exists
            amount = paymentDetails[0].Amount;
            paymentId = paymentDetails[0].PaymentID;
        }

        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount * 100, // Convert to cents for Stripe
            currency: 'usd',
            metadata: {
                userId: req.session.userId,
                registrationId: registrationId,
                paymentId: paymentId
            }
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentId: paymentId
        });
    } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).json({ error: 'Failed to create payment intent' });
    }
});



/*// payment confirmation endpoint
app.post('/confirm-payment', verifyRole(["Player"]), async (req, res) => {
    try {
        const { paymentIntentId } = req.body;
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ error: 'Payment not completed' });
        }

        // ue TRUE for boolean column
        await db.execute(
            'UPDATE Players SET PayedFee = TRUE WHERE UserID = ?',
            [paymentIntent.metadata.userId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Payment confirmation error:', error);
        res.status(500).json({ error: 'Payment verification failed' });
    }
});*/

// Route to serve Stripe publishable key
app.get('/stripe-key', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

app.post('/confirm-payment', async (req, res) => {
    try {
        const { paymentIntentId } = req.body;

        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ error: 'Payment not completed' });
        }

        // Get the payment ID from the metadata
        const paymentId = paymentIntent.metadata.paymentId;
        const registrationId = paymentIntent.metadata.registrationId;

        if (!paymentId) {
            return res.status(400).json({ error: 'Payment ID not found in metadata' });
        }

        // Begin transaction to ensure all updates are atomic
        await db.promise().beginTransaction();

        try {
            // Update player's PayedFee status
            await db.promise().execute(
                'UPDATE Players SET PayedFee = TRUE WHERE UserID = ?',
                [req.session.userId]
            );

            // Update payment status in the Payments table
            await db.promise().execute(
                "UPDATE Payments SET Status = 'Completed' WHERE PaymentID = ? AND UserID = ?",
                [paymentId, req.session.userId]
            );

            // Commit the transaction
            await db.promise().commit();

            res.json({
                success: true,
                paymentIntentId: paymentIntentId,
                registrationId: registrationId,
                paymentId: paymentId
            });
        } catch (error) {
            // Rollback in case of error
            await db.promise().rollback();
            throw error;
        }
    } catch (error) {
        console.error('Payment confirmation error:', error);
        res.status(500).json({ error: 'Payment verification failed' });
    }
});

// Get payment details endpoint
app.get("/payment-details", (req, res) => {
    const registrationId = req.query.registrationId;

    if (!req.session.userId) {
        return res.status(401).json({ error: "Not logged in" });
    }

    if (!registrationId) {
        return res.status(400).json({ error: "Registration ID is required" });
    }

    db.execute(`
        SELECT p.PaymentID, p.Amount, p.Status,
               t.TeamID, t.Name AS TeamName,
               tour.TournamentID, tour.Name AS TournamentName
        FROM Payments p
        JOIN Teams t ON p.TeamID = t.TeamID
        JOIN Tournaments tour ON p.TournamentID = tour.TournamentID
        WHERE p.PaymentID = ? AND p.UserID = ?
    `, [registrationId, req.session.userId], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: "Payment not found" });
        }

        res.json(results[0]);
    });
});

// Get active tournaments endpoint
app.get("/tournaments", (req, res) => {
    db.execute(`
        SELECT TournamentID, Name, Description, StartDate, EndDate, Location, Status
        FROM Tournaments
        WHERE Status IN ('Upcoming', 'Ongoing')
        ORDER BY StartDate
    `, (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        res.json(results);
    });
});

// Tournament signup endpoint
app.post("/tournament-signup", (req, res) => {
    const userId = req.session.userId;
    const { tournamentId, teamId, newTeamName, collegeId, message } = req.body;

    if (!userId) {
        return res.status(401).json({ message: "You must be logged in to register for tournaments." });
    }

    if (!tournamentId) {
        return res.status(400).json({ message: "Tournament selection is required" });
    }

    if (!teamId && !newTeamName) {
        return res.status(400).json({ message: "Either team selection or new team name is required" });
    }

    // Begin transaction
    db.beginTransaction(async (err) => {
        if (err) {
            return res.status(500).json({ message: "Database error. Please try again later." });
        }

        try {
            // Check if user already has a registration for this tournament
            const [existingRegistration] = await db.promise().execute(
                "SELECT RegistrationID FROM Registrations WHERE UserID = ? AND TournamentID = ?",
                [userId, tournamentId]
            );

            if (existingRegistration.length > 0) {
                await db.promise().rollback();
                return res.status(400).json({
                    message: "You have already registered for this tournament. Please check your registration status."
                });
            }

            // Get user info to check role
            const [userResults] = await db.promise().execute(
                "SELECT Role FROM Users WHERE UserID = ?",
                [userId]
            );

            if (userResults.length === 0) {
                await db.promise().rollback();
                return res.status(404).json({ message: "User not found" });
            }

            const userRole = userResults[0].Role;

            // If user is not a Player, convert them to Player
            if (userRole === "User") {
                await db.promise().execute(
                    "UPDATE Users SET Role = 'Player' WHERE UserID = ?",
                    [userId]
                );
            } else if (userRole !== "Player") {
                await db.promise().rollback();
                return res.status(403).json({
                    message: "Only Users and Players can register for tournaments."
                });
            }

            // Get player info or create a new player record
            const [playerResults] = await db.promise().execute(
                "SELECT PlayerID, TeamID, ValidStudent FROM Players WHERE UserID = ?",
                [userId]
            );

            let playerId, isValidStudent;

            if (playerResults.length === 0) {
                // Create player record if not exists
                const [insertResult] = await db.promise().execute(
                    "INSERT INTO Players (UserID, Role, ValidStudent) VALUES (?, 'Member', FALSE)",
                    [userId]
                );
                playerId = insertResult.insertId;
                isValidStudent = false;
            } else {
                playerId = playerResults[0].PlayerID;
                isValidStudent = playerResults[0].ValidStudent;

                // Check if player is already in a team for this tournament
                if (playerResults[0].TeamID) {
                    const [existingReg] = await db.promise().execute(
                        `SELECT p.PaymentID FROM Payments p 
                         WHERE p.UserID = ? AND p.TournamentID = ? AND p.Status = 'Completed'`,
                        [userId, tournamentId]
                    );

                    if (existingReg.length > 0) {
                        await db.promise().rollback();
                        return res.status(400).json({
                            message: "You are already registered for this tournament"
                        });
                    }
                }
            }

            // Handle team creation or selection
            let finalTeamId;

            if (newTeamName) {
                // Create new team
                const [teamResult] = await db.promise().execute(
                    "INSERT INTO Teams (Name, UniversityID, Description) VALUES (?, ?, ?)",
                    [newTeamName, collegeId, `Team created for tournament registration on ${new Date().toISOString().split('T')[0]}`]
                );

                finalTeamId = teamResult.insertId;

                // Update player as team leader
                await db.promise().execute(
                    "UPDATE Players SET TeamID = ?, Role = 'Leader' WHERE PlayerID = ?",
                    [finalTeamId, playerId]
                );
            } else {
                finalTeamId = teamId;

                // Update player's team if different
                if (!playerResults[0].TeamID || playerResults[0].TeamID != teamId) {
                    await db.promise().execute(
                        "UPDATE Players SET TeamID = ?, Role = 'Member' WHERE PlayerID = ?",
                        [teamId, playerId]
                    );
                }
            }

            // Add to registrations table with appropriate status
            const regStatus = isValidStudent ? 'Verified' : 'Pending';

            const [regResult] = await db.promise().execute(
                `INSERT INTO Registrations (UserID, TournamentID, TeamID, NewTeamName, Message, Status) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [userId, tournamentId, finalTeamId, newTeamName, message, regStatus]
            );

            // If student is not validated, return now
            if (!isValidStudent) {
                await db.promise().commit();

                return res.json({
                    success: true,
                    pendingVerification: true,
                    message: "Your registration is pending verification of your student status."
                });
            }

            // For validated students, create payment record
            const tournamentFee = 10.00; // Default fee, could be fetched from tournament settings

            const [paymentResult] = await db.promise().execute(
                `INSERT INTO Payments (UserID, TeamID, TournamentID, Amount, Status) 
                 VALUES (?, ?, ?, ?, 'Pending')`,
                [userId, finalTeamId, tournamentId, tournamentFee]
            );

            // Commit transaction
            await db.promise().commit();

            // Return success with payment ID for redirect
            res.json({
                success: true,
                message: "Registration initiated successfully",
                registrationId: paymentResult.insertId
            });

        } catch (error) {
            await db.promise().rollback();
            console.error("Error in tournament registration:", error);
            res.status(500).json({
                message: "An error occurred during registration. Please try again."
            });
        }
    });
});

// Get teams for a college endpoint
app.get("/teams-for-college-tournament", (req, res) => {
    const collegeId = req.query.collegeId;

    if (!collegeId) {
        return res.status(400).json({ error: "College ID is required" });
    }

    db.execute(`
        SELECT TeamID, Name, Description
        FROM Teams
        WHERE UniversityID = ?
    `, [collegeId], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        res.json(results);
    });
});


// fetch all news articles endpoint
app.get('/news-articles', async (req, res) => {
    try {
        const [posts] = await db.promise().query('SELECT * FROM Posts ORDER BY CreatedAt DESC');
        console.log(posts);
        res.json(posts);
    } catch (error) {
        console.error('Error fetching news:', error);
        res.status(500).json({ message: 'Error fetching news' });
    }
});

// create a news article endpoint
app.post('/create-news', verifyRole(['Admin', 'SuperAdmin']), async (req, res) => {
    const { Author, Title, ImageURL, Content } = req.body;
    try {
        const [result] = await db.promise().execute(
            'INSERT INTO Posts (Author, Title, ImageURL, Content) VALUES (?, ?, ?, ?)',
            [Author, Title, ImageURL || '', Content]
        );
        res.json({ PostID: result.insertId, message: 'News article created successfully' });
    } catch (error) {
        console.error('Error creating news article:', error);
        res.status(500).json({ message: 'Error creating news article' });
    }
});

// update a news article endpoint
app.put('/update-news/:PostID', verifyRole(['Admin', 'SuperAdmin']), async (req, res) => {
    const { PostID } = req.params;
    const { Title, ImageURL, Content } = req.body;
    try {
        await db.promise().execute(
            'UPDATE Posts SET Title = ?, ImageURL = ?, Content = ? WHERE PostID = ?',
            [Title, ImageURL || '', Content, PostID]
        );
        res.json({ message: 'News article updated successfully' });
    } catch (error) {
        console.error('Error updating news article:', error);
        res.status(500).json({ message: 'Error updating news article' });
    }
});

// delete a news article endpoint
app.delete('/delete-news/:PostID', verifyRole(['Admin', 'SuperAdmin']), async (req, res) => {
    const { PostID } = req.params;
    try {
        await db.promise().execute('DELETE FROM Posts WHERE PostID = ?', [PostID]);
        res.json({ message: 'News article deleted successfully' });
    } catch (error) {
        console.error('Error deleting news article:', error);
        res.status(500).json({ message: 'Error deleting news article' });
    }
});

// create match endpoint
app.post("/api/matches", (req, res) => {
    const { tournamentID, team1ID, team2ID, matchDate, scoreTeam1, scoreTeam2 } = req.body;

    const query = `
        INSERT INTO Matches (TournamentID, Team1ID, Team2ID, MatchDate, ScoreTeam1, ScoreTeam2)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(query, [tournamentID, team1ID, team2ID, matchDate, scoreTeam1, scoreTeam2], (err, result) => {
        if (err) {
            console.error("Error inserting match:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.status(200).json({ message: "Match inserted", matchID: result.insertId });
    });
});

// fetch teams by name endpoint
app.get("/api/teams", (req, res) => {
    const query = "SELECT name FROM teams"; // adjust column names as per your DB
    db.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching teams:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});

// college signup report endpoint
app.get('/api/reports/college-signups', (req, res) => {
    const { startDate, endDate } = req.query;

    // create a query with proper date handling
    const query = `
      SELECT 
        DATE(u.DateAdded) AS DateAdded,
        u.Name AS collegeName,
        u.Location AS country,
        COUNT(DISTINCT t.TeamID) AS teamCount,
        COUNT(DISTINCT p.PlayerID) AS memberCount,
        EXISTS(SELECT 1 FROM CollegeModerators WHERE UniversityID = u.UniversityID) AS hasModerator,
        u.HasPage
      FROM University u
      LEFT JOIN Teams t ON u.UniversityID = t.UniversityID
      LEFT JOIN Players p ON t.TeamID = p.TeamID
      WHERE (? IS NULL OR ? = '' OR DATE(u.DateAdded) >= DATE(?))
        AND (? IS NULL OR ? = '' OR DATE(u.DateAdded) <= DATE(?))
      GROUP BY u.UniversityID
      ORDER BY u.DateAdded DESC
    `;

    // use parameters twice to handle the OR conditions
    db.execute(query, [
        startDate, startDate, startDate,
        endDate, endDate, endDate
    ], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// tournament status report endpoint
app.get('/api/reports/tournament-status', (req, res) => {
    const { startDate, endDate } = req.query;

    const query = `
      SELECT 
        t.NextRoundDate,
        u.Name AS collegeName,
        u.Location AS country,
        SUM(CASE WHEN m.Status = 'Planned' THEN 1 ELSE 0 END) AS plannedMatches,
        SUM(CASE WHEN m.Status = 'Completed' THEN 1 ELSE 0 END) AS completedMatches,
        t.EliminationsComplete
      FROM Tournaments t
      LEFT JOIN University u ON t.UniversityID = u.UniversityID
      LEFT JOIN Matches m ON t.TournamentID = m.TournamentID
      WHERE (? IS NULL OR ? = '' OR DATE(t.NextRoundDate) >= DATE(?))
        AND (? IS NULL OR ? = '' OR DATE(t.NextRoundDate) <= DATE(?))
      GROUP BY t.TournamentID
      ORDER BY t.NextRoundDate DESC
    `;

    db.execute(query, [
        startDate, startDate, startDate,
        endDate, endDate, endDate
    ], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

app.use((req, res, next) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});


// start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

/*app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});*/
