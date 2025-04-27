const express = require("express"); // import express
const path = require("path"); // to resolve file and dir paths
const mysql = require("mysql2"); // database
const bcrypt = require("bcryptjs"); // safe password encryption
const session = require("express-session");
require("dotenv").config(); // safe config
const { verifyRole } = require("./assets/js/auth.js"); // user authorization
const errorHandler = require('./assets/js/errorhandler'); // error handling
const Stripe = require('stripe'); // stripe payment
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const fs = require('fs'); // page templating
const multer = require('multer'); // file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

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
    // allowed paths that should not be blocked
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
        /^\/news-articles($|\?|\/)/,
        /^\/matches($|\?|\/)/,
        /^\/match($|\?|\/)/,
        /^\/tournament($|\?|\/)/,
        /^\/api\/tournaments($|\?|\/)/,
        /^\/api\/matches($|\?|\/)/,
        /^\/tournaments($|\?|\/)/,
        /^\/api\/registrations($|\?|\/)/,
        /^\/api\/payments($|\?|\/)/
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

// One-time setup flag (stored in memory)
let setupComplete = false;

// Check if admin exists already
async function checkAdminExists() {
    try {
        const [admins] = await db.promise().execute(
            "SELECT COUNT(*) as count FROM Users WHERE Role = 'SuperAdmin'"
        );
        return admins[0].count > 0;
    } catch (error) {
        console.error("Error checking for existing admin:", error);
        return false;
    }
}

// initial setup route - only accessible once
app.get('/setup', async (req, res) => {
    // check if setup was already completed
    if (setupComplete) {
        return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
    }

    // Check if admin already exists in database
    const adminExists = await checkAdminExists();
    if (adminExists) {
        setupComplete = true;
        return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
    }

    // if no admin exists, serve the setup page
    res.sendFile(path.join(__dirname, 'public', 'setup.html'));
});

// process setup form
app.post('/setup', async (req, res) => {
    // check if setup was already completed
    if (setupComplete) {
        return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
    }

    // check if admin already exists in database
    const adminExists = await checkAdminExists();
    if (adminExists) {
        setupComplete = true;
        return res.status(403).json({ message: 'Setup already completed. Admin account already exists.' });
    }

    const { firstName, lastName, email, password } = req.body;

    // validate inputs
    if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    // validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
    }

    // validate password strength
    const passwordRegex = /^(?=.*[a-zA-Z]).{8,}$/;
    if (!passwordRegex.test(password)) {
        return res.status(400).json({ message: 'Password must be at least 8 characters and contain a letter' });
    }

    try {
        // hash the password
        const hashedPassword = await bcrypt.hash(password, 10);
        const fullName = `${firstName} ${lastName}`;

        // begin transaction
        await db.promise().beginTransaction();

        // create SuperAdmin user
        const [result] = await db.promise().execute(
            "INSERT INTO Users (Name, Email, Password, Role) VALUES (?, ?, ?, ?)",
            [fullName, email, hashedPassword, 'SuperAdmin']
        );

        const userId = result.insertId;

        // add to SuperAdmins table
        await db.promise().execute(
            "INSERT INTO SuperAdmins (UserID) VALUES (?)",
            [userId]
        );

        // commit transaction
        await db.promise().commit();

        // mark setup as complete
        setupComplete = true;

        // return success
        res.status(201).json({
            message: "SuperAdmin account created successfully. You can now log in.",
            setupComplete: true
        });

    } catch (error) {
        // rollback transaction on error
        await db.promise().rollback();
        console.error("Error creating SuperAdmin:", error);
        res.status(500).json({ message: "Failed to create SuperAdmin account" });
    }
});


// ======================== QUICK UPLOAD, SERVE PAGES & SESSION CHECKING ========================

// quick upload
app.post('/quick-upload', upload.single('file'), (req, res) => {
    res.json({
        filePath: `/uploads/${req.file.filename}`
    });
});

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
app.get("/reports", verifyRole(["SuperAdmin", "Admin", "CollegeRep", "Moderator"]), (req, res) => {
    res.sendFile(path.join(__dirname, "public", "reports.html"));
});

// serve account page endpoint 
app.get("/account", verifyRole(["SuperAdmin", "Admin", "Moderator", "CollegeRep"]), (req, res) => {
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

        let whereClause = '';
        let params = [];

        if (searchQuery) {
            switch (searchBy) {
                case 'name':
                    whereClause = 'WHERE t.Name LIKE ?';
                    params.push(`%${searchQuery}%`);
                    break;

                case 'college':
                    // only show teams with matching university (exclude unaffiliated)
                    whereClause = 'WHERE u.Name LIKE ?';
                    params.push(`%${searchQuery}%`);
                    break;

                case 'all':
                    // show teams where name OR university matches (unaffiliated only via name)
                    whereClause = 'WHERE (t.Name LIKE ? OR u.Name LIKE ?)';
                    params.push(`%${searchQuery}%`, `%${searchQuery}%`);
                    break;
            }
        }

        const [teams] = await db.promise().execute(`
            SELECT 
                t.TeamID, 
                t.Name, 
                t.ImageURL AS TeamImage,
                u.Name AS UniversityName,
                u.ImageURL AS UniversityImage
            FROM Teams t
            LEFT JOIN University u ON t.UniversityID = u.UniversityID
            ${whereClause}
            ORDER BY t.Name
        `, params);

        const teamsHtml = teams.map(team => `
            <div class="col-md-4 mb-4">
                <div class="card h-100 shadow d-flex flex-row">
                    <!-- Team Image -->
                    <div class="card-img-container p-3">
                        <img src="${team.TeamImage || "/media/img/placeholder-250x250.png"}" class="card-img-left" alt="${team.Name}">
                    </div>
        
                    <!-- Team Info -->
                    <div class="card-body d-flex flex-column justify-content-center">
                        <h5 class="card-title">${team.Name}</h5>
                        <p class="text-muted mb-3">From ${team.UniversityName || 'New World'}</p>
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

        // fetch matches
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
    WHERE m.TournamentID = ? AND m.RoundNumber BETWEEN 2 AND 3
    ORDER BY m.RoundNumber DESC, m.MatchDate
`, [tournamentId]);

        // Update round filtering logic
        const semifinalMatches = matches.filter(m => m.RoundNumber === 2);
        const finalMatch = matches.find(m => m.RoundNumber === 3);

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

// helper function to generate semifinal match card HTML
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

// serve profile page endpoint
app.get('/profile', verifyRole(["User", "Player", "Moderator", "CollegeRep", "Admin", "SuperAdmin"]), (req, res) => {
    if (!req.session.userId) return res.redirect('/login');

    res.sendFile(path.join(__dirname, "public", "profile.html"));
});

// serve payment page endpoint
app.get("/payment", verifyRole(["Player"]), (req, res) => {
    const registrationId = req.query.registrationId;

    if (!req.session.userId) {
        return res.redirect('/login');
    }

    if (!registrationId) {
        return res.redirect('/');
    }

    // check if this payment is for a valid registration by this user
    db.execute(`
        SELECT r.Status, p.PaymentID 
        FROM Registrations r
        LEFT JOIN Payments p ON p.RegistrationID = r.RegistrationID
        WHERE r.UserID = ? AND r.RegistrationID = ? AND r.Status = 'Verified'
    `, [req.session.userId, registrationId], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.redirect('/');
        }

        if (results.length === 0) {
            // either the registration doesn't exist, doesn't belong to this user,
            // or the user is not a verified student
            return res.redirect('/');
        }

        // user is authorized to access the payment page
        res.sendFile(path.join(__dirname, "public", "payment.html"));
    });
});

// serve successful tournament sign up endpoint
app.get('/payment-success', verifyRole(["Player"]), (req, res) => {
    const paymentIntentId = req.query.payment_intent;
    const registrationId = req.query.registration_id;

    if (!req.session.userId) {
        return res.redirect('/login');
    }

    if (!paymentIntentId || !registrationId) {
        return res.redirect('/');
    }

    // verify this payment is legitimate and belongs to this user
    // also check if the success page has already been viewed
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
            // either the payment doesn't exist, doesn't belong to this user,
            // or hasn't been completed
            return res.redirect('/');
        }

        // check if the success page has already been viewed
        if (results[0].SuccessPageViewed) {
            return res.redirect('/'); // redirect to home
        }

        // mark this payment as viewed in the success page to prevent multiple views
        db.execute(`
        UPDATE Payments 
        SET SuccessPageViewed = TRUE 
        WHERE PaymentID = ? AND UserID = ?
      `, [registrationId, req.session.userId], (updateErr) => {
            if (updateErr) {
                console.error("Error updating payment record:", updateErr);
            }

            // render a dynamic success page with transaction details
            // more secure than serving a static HTML file
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

// serve analytics page endpoint
app.get("/stats", verifyRole(["SuperAdmin", "Admin", "Moderator"]), (req, res) => {
    res.sendFile(path.join(__dirname, "public", "stats.html"));
});

// serve tournament register page endpoint
app.get("/tournament-register", (req, res) => {
    // check if user is logged in
    if (!req.session.userId) {
        // not logged in, redirect to login
        return res.redirect('/login');
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
        if (req.session.role === "Admin" || req.session.role === "SuperAdmin" || req.session.role === "CollegeRep" || req.session.role === "Moderator") { // admins check
            return res.redirect("account.html"); // redirect to role management for admins
        } else {
            return res.redirect("/"); // redirect to home page for other users
        }
    }
    res.sendFile(path.join(__dirname, "public", "signup.html")); // not logged in, redirect to sign up page
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

        // get the user from results
        const user = results[0];

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
app.get("/fetchColleges", (req, res) => {
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
app.post("/add-college", verifyRole(["SuperAdmin", "Admin", "CollegeRep"]), (req, res) => {
    const { name, location, founded, description, logoURL, pictureURL } = req.body;
    db.execute("INSERT INTO University (Name, Location, Founded, Emblem, ImageURL, Description) VALUES (?, ?, ?, ?, ?, ?)", [name, location, founded, logoURL, pictureURL, description], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error. Please try again later." });
        res.status(201).json({ message: "College added successfully!" });
    });
});


// edit college endpoint
app.put("/edit-college/:collegeId", verifyRole(["SuperAdmin", "Admin", "CollegeRep"]), (req, res) => {
    const { name, location, founded, description, logoURL, pictureURL, hasPage } = req.body;
    const collegeId = req.params.collegeId;

    db.execute("UPDATE University SET Name = ?, Location = ?, Founded = ?, Emblem = ?, ImageURL = ?, Description = ?, HasPage = ? WHERE UniversityID = ?", [name, location, founded, logoURL, pictureURL, description, hasPage, collegeId], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error. Please try again later." });

        res.json({ message: "College updated successfully!" });
    });
});

// delete college endpoint
app.delete("/delete-college/:collegeId", verifyRole(["SuperAdmin", "Admin", "CollegeRep"]), (req, res) => {
    const collegeId = req.params.collegeId;
    db.execute("DELETE FROM University WHERE UniversityID = ?", [collegeId], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error. Please try again later." });
        res.json({ message: "College deleted successfully!" });
    });
});

// fetch all teams endpoint
app.get("/api/teams", (req, res) => {
    db.execute(`
        SELECT 
            t.TeamID, 
            t.Name,
            t.UniversityID,
            COALESCE(u.Name, 'N/A') AS UniversityName,
            t.CreatedDate
        FROM Teams t
        LEFT JOIN University u 
            ON t.UniversityID = u.UniversityID
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
app.post("/add-team", verifyRole(["SuperAdmin", "Admin", "CollegeRep"]), (req, res) => {
    const { name, universityId } = req.body;
    const desc = "";

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

            res.status(201).json({
                message: "Team added successfully!",
                teamId: result.insertId
            });
        }
    );
});

// edit team endpoint
app.put("/edit-team/:teamId", verifyRole(["SuperAdmin", "Admin", "CollegeRep"]), (req, res) => {
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
app.delete("/delete-team/:teamId", verifyRole(["SuperAdmin", "Admin", "CollegeRep"]), (req, res) => {
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

// serve team-specific page endpoint
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

        if (!team[0]) res.redirect("/teams");

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
        if (players[0] == "" || players.length === 0) {
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
            .replace(/{{TEAM_IMAGE}}/g, team[0].ImageURL || team[0].UniversityEmblem || '/media/img/placeholder-250x250.png')
            .replace(/{{TEAM_DESCRIPTION}}/g, team[0].Description || 'No description available.')
            .replace(/{{UNIVERSITY_NAME}}/g, team[0].UniversityName || 'New World')
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


// ======================== ADMIN MANAGEMENT ========================

// fetch available roles based on current user admin privileges endpoint
app.get("/roles", verifyRole(["SuperAdmin", "Admin", "Moderator", "CollegeRep"]), (req, res) => {
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
app.get("/users", verifyRole(["SuperAdmin", "Admin", "Moderator", "CollegeRep"]), (req, res) => {
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
app.get("/user/:userId", verifyRole(["SuperAdmin", "Admin", "Moderator", "CollegeRep"]), async (req, res) => {
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

// add user endpoint
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
                    await db.promise().execute("INSERT INTO CollegeReps (UserID) VALUES (?)", [userId]);
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

// create a payment intent endpoint
app.post('/create-payment-intent', async (req, res) => {
    try {
        const { registrationId } = req.body;

        // get payment via registration ID
        const [paymentDetails] = await db.promise().execute(
            `SELECT PaymentID, Amount FROM Payments 
             WHERE PaymentID = ? AND Status = 'Pending'`,
            [registrationId]
        );

        let amount, paymentId;

        // handle missing payment record
        if (paymentDetails[0].length === 0) {

            return res.status(404).json({ error: 'Payment record not found' });
        } else {
            amount = paymentDetails[0].Amount;
            paymentId = paymentDetails[0].PaymentID;
        }

        // create a Stripe payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount * 100,
            currency: 'usd',
            metadata: {
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


// Route to serve Stripe publishable key
app.get('/stripe-key', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

// confirm payment endpoint
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

// fetch all tournaments
app.get('/api/tournaments/brackets', async (req, res) => {
    try {
        const searchTerm = req.query.q || '';
        let query = `SELECT * FROM Tournaments`;
        let params = [];

        if (searchTerm) {
            query += ' WHERE Name LIKE ?';
            params.push(`%${searchTerm}%`);
        }

        query += ' ORDER BY StartDate DESC';

        const [tournaments] = await db.promise().execute(query, params);
        res.json(tournaments);
    } catch (error) {
        console.error('Error fetching tournaments:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// tournament sign up endpoint
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

    // begin transaction
    db.beginTransaction(async (err) => {
        if (err) {
            return res.status(500).json({ message: "Database error. Please try again later." });
        }

        try {
            // get user info to check role
            const [userResults] = await db.promise().execute(
                "SELECT Role FROM Users WHERE UserID = ?",
                [userId]
            );

            if (userResults.length === 0) {
                await db.promise().rollback();
                return res.status(404).json({ message: "User not found" });
            }

            const userRole = userResults[0].Role;

            // if user is not a Player, convert them to Player
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

            // get player info or create a new player record
            const [playerResults] = await db.promise().execute(
                "SELECT PlayerID, TeamID, ValidStudent FROM Players WHERE UserID = ?",
                [userId]
            );

            let playerId, isValidStudent;

            if (playerResults.length === 0) {
                // create player record if not exists
                const [insertResult] = await db.promise().execute(
                    "INSERT INTO Players (UserID, Role, ValidStudent) VALUES (?, 'Member', FALSE)",
                    [userId]
                );
                playerId = insertResult.insertId;
                isValidStudent = false;
            } else {
                playerId = playerResults[0].PlayerID;
                isValidStudent = playerResults[0].ValidStudent;

                // check if player is already in a team for this tournament
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

            // handle team creation or selection
            let finalTeamId;

            if (newTeamName) {
                // create new team
                const [teamResult] = await db.promise().execute(
                    "INSERT INTO Teams (Name, UniversityID, Description) VALUES (?, ?, ?)",
                    [newTeamName, collegeId, `Team created for tournament registration on ${new Date().toISOString().split('T')[0]}`]
                );

                finalTeamId = teamResult.insertId;

                // update player as team leader
                await db.promise().execute(
                    "UPDATE Players SET TeamID = ?, Role = 'Leader' WHERE PlayerID = ?",
                    [finalTeamId, playerId]
                );
            } else {
                finalTeamId = teamId;

                // update player's team if different
                if (playerResults.length > 0 && (!playerResults[0].TeamID || playerResults[0].TeamID != teamId)) {
                    await db.promise().execute(
                        "UPDATE Players SET TeamID = ?, Role = 'Member' WHERE PlayerID = ?",
                        [teamId, playerId]
                    );
                }
            }

            // check for existing registration
            const [existingRegistration] = await db.promise().execute(
                "SELECT RegistrationID FROM Registrations WHERE UserID = ? AND TournamentID = ?",
                [userId, tournamentId]
            );

            let registrationId;
            const regStatus = isValidStudent ? 'Verified' : 'Pending';

            if (existingRegistration.length > 0) {
                // update existing registration
                await db.promise().execute(
                    `UPDATE Registrations SET
                        TeamID = ?,
                        NewTeamName = ?,
                        Message = ?,
                        Status = ?
                     WHERE RegistrationID = ?`,
                    [finalTeamId, newTeamName || null, message || '', regStatus, existingRegistration[0].RegistrationID]
                );
                registrationId = existingRegistration[0].RegistrationID;
            } else {
                // create new registration
                const [regResult] = await db.promise().execute(
                    `INSERT INTO Registrations (UserID, TournamentID, TeamID, NewTeamName, Message, Status) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [userId, tournamentId, finalTeamId, newTeamName || null, message || '', regStatus]
                );
                registrationId = regResult.insertId;
            }

            // if student is not validated, return now
            if (!isValidStudent) {
                await db.promise().commit();
                return res.json({
                    success: true,
                    pendingVerification: true,
                    message: "Your registration is pending verification of your student status."
                });
            }

            // for validated students, create/update payment record
            const tournamentFee = 10.00;

            // UPSERT payment
            await db.promise().execute(
                `INSERT INTO Payments (
                    RegistrationID,
                    UserID, 
                    TeamID, 
                    TournamentID, 
                    Amount, 
                    Status
                ) VALUES (?, ?, ?, ?, ?, 'Pending')
                ON DUPLICATE KEY UPDATE
                    TeamID = VALUES(TeamID),
                    TournamentID = VALUES(TournamentID),
                    Amount = VALUES(Amount),
                    Status = VALUES(Status)`,
                [
                    registrationId,
                    userId,
                    finalTeamId,
                    tournamentId,
                    tournamentFee
                ]
            );

            // commit transaction
            await db.promise().commit();

            // return success with registration ID
            res.json({
                success: true,
                message: "Registration initiated successfully",
                registrationId: registrationId
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
        res.json(posts);
    } catch (error) {
        console.error('Error fetching news:', error);
        res.status(500).json({ message: 'Error fetching news' });
    }
});

// create a news article endpoint
app.post('/create-news', verifyRole(['SuperAdmin', 'Admin', 'Moderator']), async (req, res) => {
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
app.put('/update-news/:PostID', verifyRole(['SuperAdmin', 'Admin', 'Moderator']), async (req, res) => {
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
app.delete('/delete-news/:PostID', verifyRole(['SuperAdmin', 'Admin', 'Moderator']), async (req, res) => {
    const { PostID } = req.params;
    try {
        await db.promise().execute('DELETE FROM Posts WHERE PostID = ?', [PostID]);
        res.json({ message: 'News article deleted successfully' });
    } catch (error) {
        console.error('Error deleting news article:', error);
        res.status(500).json({ message: 'Error deleting news article' });
    }
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
    const { startDate, endDate, sort } = req.query;

    const validSortColumns = {
        date: 'u.DateAdded',
        name: 'u.Name',
        country: 'u.Location',
        teams: 'teamCount',
        members: 'memberCount',
        moderator: 'hasModerator',
        page: 'u.HasPage'
    };

    const query = `
        SELECT 
            DATE(u.DateAdded) AS DateAdded,
            u.Name AS collegeName,
            u.Location AS country,
            COUNT(DISTINCT t.TeamID) AS teamCount,
            COUNT(DISTINCT p.PlayerID) AS memberCount,
            EXISTS(SELECT 1 FROM CollegeReps WHERE UniversityID = u.UniversityID) AS hasModerator,
            u.HasPage
        FROM University u
        LEFT JOIN Teams t ON u.UniversityID = t.UniversityID
        LEFT JOIN Players p ON t.TeamID = p.TeamID
        WHERE 
            (DATE(u.DateAdded) >= ? OR ? IS NULL) AND
            (DATE(u.DateAdded) <= ? OR ? IS NULL)
        GROUP BY u.UniversityID
        ORDER BY ${validSortColumns[sort] || 'u.DateAdded'} DESC
    `;

    // pass parameters twice for each placeholder
    db.execute(query, [
        startDate || null, startDate || null,
        endDate || null, endDate || null
    ], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results.map(row => ({
            ...row,
            hasModerator: Boolean(row.hasModerator),
            HasPage: Boolean(row.HasPage),
            country: row.country.includes(',') ?
                row.country.split(',').pop().trim() :
                row.country
        })));
    });
});

// tournament status report endpoint
app.get('/api/reports/tournament-status', (req, res) => {
    const { startDate, endDate, sort } = req.query;

    const validSortColumns = {
        date: 't.NextRoundDate',
        name: 'u.Name',
        country: 'u.Location',
        planned: 'plannedMatches',
        completed: 'completedMatches',
        eliminations: 't.EliminationsComplete'
    };

    const query = `
    SELECT 
        t.TournamentID,
        t.Name AS tournamentName,
        t.NextRoundDate,
        COALESCE(u.Name, 'No College') AS collegeName,
        COALESCE(
            CASE 
                WHEN u.Location LIKE '%,%' THEN SUBSTRING_INDEX(u.Location, ',', -1) 
                ELSE u.Location 
            END, 
            'N/A'
        ) AS country,
        COUNT(CASE WHEN m.Status = 'Planned' THEN 1 END) AS plannedMatches,
        COUNT(CASE WHEN m.Status = 'Completed' THEN 1 END) AS completedMatches,
        t.EliminationsComplete
    FROM Tournaments t
    LEFT JOIN University u ON t.UniversityID = u.UniversityID
    LEFT JOIN Matches m ON t.TournamentID = m.TournamentID
    WHERE 
        (t.NextRoundDate >= ? OR ? IS NULL) AND
        (t.NextRoundDate <= ? OR ? IS NULL)
    GROUP BY t.TournamentID
    ORDER BY ${validSortColumns[sort] || 't.NextRoundDate'} DESC
`;


    db.execute(query, [
        startDate || null, startDate || null,
        endDate || null, endDate || null
    ], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results.map(row => ({
            ...row,
            EliminationsComplete: Boolean(row.EliminationsComplete)
        })));
    });
});

// get single match details endpoint
app.get('/match/:id', async (req, res) => {
    try {
        const [match] = await db.promise().execute(`
            SELECT m.*, t1.Name AS Team1Name, t2.Name AS Team2Name
            FROM Matches m
            LEFT JOIN Teams t1 ON m.Team1ID = t1.TeamID
            LEFT JOIN Teams t2 ON m.Team2ID = t2.TeamID
            WHERE m.MatchID = ?
        `, [req.params.id]);

        res.json(match[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// update match endpoint
app.put('/match/:id', verifyRole(['Admin', 'SuperAdmin']), async (req, res) => {
    try {
        const { ScoreTeam1, ScoreTeam2, WinnerID, MatchDate } = req.body;

        await db.promise().execute(`
            UPDATE Matches 
            SET ScoreTeam1 = ?, ScoreTeam2 = ?, WinnerID = ?, MatchDate = ?
            WHERE MatchID = ?
        `, [ScoreTeam1, ScoreTeam2, WinnerID, MatchDate, req.params.id]);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// get all matches endpoint
app.get('/matches', async (req, res) => {
    try {
        const { tournamentId, rounds } = req.query;
        const roundNumbers = rounds ? rounds.split(',').map(Number) : [2, 3];

        // dynamic placeholders for IN clause
        const placeholders = roundNumbers.map(() => '?').join(',');

        const [matches] = await db.promise().execute(`
            SELECT m.*, t1.Name AS Team1Name, t2.Name AS Team2Name
            FROM Matches m
            LEFT JOIN Teams t1 ON m.Team1ID = t1.TeamID
            LEFT JOIN Teams t2 ON m.Team2ID = t2.TeamID
            WHERE m.TournamentID = ? 
            AND m.RoundNumber IN (${placeholders})
            ORDER BY m.RoundNumber, m.MatchDate
        `, [tournamentId, ...roundNumbers]); // spread operator for multiple values

        res.json(matches);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// create a new match endpoint
app.post('/matches', verifyRole(['Admin', 'SuperAdmin']), async (req, res) => {
    try {
        const { TournamentID, RoundNumber, Team1ID, Team2ID, MatchDate, ScoreTeam1, ScoreTeam2, WinnerID, Status } = req.body;

        const [result] = await db.promise().execute(`
            INSERT INTO Matches 
            (TournamentID, RoundNumber, Team1ID, Team2ID, MatchDate, ScoreTeam1, ScoreTeam2, WinnerID, Status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [TournamentID, RoundNumber, Team1ID, Team2ID, MatchDate, ScoreTeam1, ScoreTeam2, WinnerID, Status]);

        res.json({ success: true, matchId: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// get single tournament by ID endpoint
app.get('/tournament/:id', (req, res) => {
    const tournamentId = req.params.id;

    db.execute(
        `SELECT * FROM Tournaments 
         WHERE TournamentID = ?`,
        [tournamentId],
        (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to fetch tournament' });
            }
            if (results.length === 0) {
                return res.status(404).json({ error: 'Tournament not found' });
            }
            res.json(results[0]);
        }
    );
});

// delete all bracket matches for tournament endpoint
app.delete('/tournament/:id/brackets', verifyRole(['Admin', 'SuperAdmin']), async (req, res) => {
    try {
        await db.promise().execute(`
            DELETE FROM Matches 
            WHERE TournamentID = ? AND RoundNumber IN (2, 3)
        `, [req.params.id]);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// exact team search endpoint
app.get('/team/exact', async (req, res) => {
    try {
        const [team] = await db.promise().execute(
            'SELECT TeamID FROM Teams WHERE Name = ? LIMIT 1',
            [req.query.name]
        );
        res.json(team[0] || null);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// create a team endpoint
app.post('/teams', verifyRole(['Admin', 'SuperAdmin']), async (req, res) => {
    try {
        const { Name } = req.body;
        const [result] = await db.promise().execute(
            'INSERT INTO Teams (Name) VALUES (?)',
            [Name]
        );
        res.json({ TeamID: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// get matches by round endpoint
app.get('/matches', async (req, res) => {
    try {
        const { tournamentId, rounds } = req.query;
        const [matches] = await db.promise().execute(
            `SELECT * FROM Matches 
            WHERE TournamentID = ? AND RoundNumber = ?
            ORDER BY MatchDate`,
            [tournamentId, rounds]
        );
        res.json(matches);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// get profile data endpoint
app.get('/profile/data', async (req, res) => {
    try {
        const [user] = await db.promise().query(`
            SELECT u.*, p.ImageURL 
            FROM Users u
            LEFT JOIN Players p ON u.UserID = p.UserID
            WHERE u.UserID = ?
        `, [req.session.userId]);

        res.json({
            email: user[0].Email,
            role: user[0].Role,
            image: user[0].ImageURL
        });
    } catch (error) {
        console.error('Profile data error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// update profile endpoint
app.post('/profile', upload.single('profileImage'), async (req, res) => {
    try {
        const { email, currentPassword, newPassword } = req.body;
        const userId = req.session.userId;
        const role = req.session.role;

        // check required fields
        if (!email || !currentPassword) {
            return res.status(400).json({ error: 'Email and current password are required' });
        }

        // validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // validate new password if provided
        if (newPassword) {
            const passwordRegex = /^(?=.*[a-zA-Z]).{6,}$/;
            if (!passwordRegex.test(newPassword)) {
                return res.status(400).json({
                    error: 'Password must have 6 characters and contain at least one letter'
                });
            }
        }

        // verify current password
        const [user] = await db.promise().query(
            'SELECT * FROM Users WHERE UserID = ?',
            [userId]
        );

        if (!bcrypt.compareSync(currentPassword, user[0].Password)) {
            return res.status(400).json({ error: 'Invalid current password' });
        }

        // prepare updates
        const updates = {};
        const playerUpdates = {};

        // email update check
        if (email !== user[0].Email) {
            const [existing] = await db.promise().query(
                'SELECT UserID FROM Users WHERE Email = ? AND UserID != ?',
                [email, userId]
            );
            if (existing.length > 0) {
                return res.status(400).json({ error: 'Email already exists' });
            }
            updates.Email = email;
        }

        // password update check
        if (newPassword) {
            if (bcrypt.compareSync(newPassword, user[0].Password)) {
                return res.status(400).json({ error: 'New password must be different' });
            }
            updates.Password = bcrypt.hashSync(newPassword, 10);
        }

        // handle image upload for Players
        if (role === 'Player' && req.file) {
            const imagePath = '/uploads/' + req.file.filename;

            // get previous image path
            const [previousData] = await db.promise().query(`
                SELECT p.ImageURL 
                FROM Players p
                WHERE p.UserID = ?
            `, [userId]);

            // delete old image file
            if (previousData[0]?.ImageURL) {
                const oldImagePath = path.join(__dirname, 'public', previousData[0].ImageURL);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            playerUpdates.ImageURL = imagePath;
        }

        // update Users table
        if (Object.keys(updates).length > 0) {
            await db.promise().query(
                'UPDATE Users SET ? WHERE UserID = ?',
                [updates, userId]
            );
        }

        // update Players table if needed
        if (role === 'Player' && Object.keys(playerUpdates).length > 0) {
            await db.promise().query(
                'UPDATE Players SET ? WHERE UserID = ?',
                [playerUpdates, userId]
            );
        }

        res.json({
            success: true,
            newEmail: updates.Email || user[0].Email,
            newImage: updates.ProfileImage || user[0].ProfileImage
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Error updating profile' });
    }
});

// fetch matches with status filter endpoint
app.get('/api/matches', async (req, res) => {
    try {
        const statusFilter = req.query.status ? req.query.status.split(',') : ['Planned', 'Cancelled'];
        const searchTerm = req.query.q || '';

        const query = `
            SELECT m.*, t.Name AS TournamentName, 
                   t1.Name AS Team1Name, t2.Name AS Team2Name
            FROM Matches m
            LEFT JOIN Tournaments t ON m.TournamentID = t.TournamentID
            LEFT JOIN Teams t1 ON m.Team1ID = t1.TeamID
            LEFT JOIN Teams t2 ON m.Team2ID = t2.TeamID
            WHERE m.Status IN (?)
            ${searchTerm ? `AND (t1.Name LIKE ? OR t2.Name LIKE ? OR t.Name LIKE ?)` : ''}
            ORDER BY m.MatchDate DESC
        `;

        const params = searchTerm ?
            [statusFilter, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`] :
            [statusFilter];

        const [matches] = await db.promise().query(query, params);
        res.json(matches);
    } catch (error) {
        console.error('Error fetching matches:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// fetch planned matches endpoint
app.get('/api/matches/planned', async (req, res) => {
    try {
        const [matches] = await db.promise().execute(`
            SELECT m.*, t.Name AS TournamentName,
                   t1.Name AS Team1Name, t2.Name AS Team2Name
            FROM Matches m
            LEFT JOIN Tournaments t ON m.TournamentID = t.TournamentID
            LEFT JOIN Teams t1 ON m.Team1ID = t1.TeamID
            LEFT JOIN Teams t2 ON m.Team2ID = t2.TeamID
            WHERE m.Status = 'Planned'
            ORDER BY m.MatchDate ASC
        `);
        res.json(matches);
    } catch (error) {
        console.error('Error fetching planned matches:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// fetch a single match endpoint
app.get('/api/matches/:id', async (req, res) => {
    try {
        const [match] = await db.promise().query(`
            SELECT * FROM Matches WHERE MatchID = ?
        `, [req.params.id]);

        if (match.length === 0) return res.status(404).json({ error: 'Match not found' });
        res.json(match[0]);
    } catch (error) {
        console.error('Error fetching match:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// insert a single match endpoint
app.post('/api/matches', verifyRole(["SuperAdmin", "Admin"]), async (req, res) => {
    try {
        const { TournamentID, Team1ID, Team2ID, MatchDate, RoundNumber, Status } = req.body;

        const [result] = await db.promise().query(`
            INSERT INTO Matches SET ?
        `, {
            TournamentID,
            Team1ID,
            Team2ID,
            MatchDate,
            RoundNumber,
            Status: 'Planned'
        });

        res.json({ id: result.insertId });
    } catch (error) {
        console.error('Error creating match:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// update a single match endpoint
app.put('/api/matches/:id', verifyRole(["SuperAdmin", "Admin"]), async (req, res) => {
    try {
        const { Team1ID, Team2ID, MatchDate, RoundNumber, ScoreTeam1, ScoreTeam2, WinnerID } = req.body;

        await db.promise().query(`
            UPDATE Matches SET ?
            WHERE MatchID = ?
        `, [{
            Team1ID,
            Team2ID,
            MatchDate,
            RoundNumber,
            ScoreTeam1: ScoreTeam1 || 0,
            ScoreTeam2: ScoreTeam2 || 0,
            WinnerID: WinnerID || null,
            Status: 'Planned'
        }, req.params.id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating match:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// delete a single match endpoint
app.delete('/api/matches/:id', verifyRole(["SuperAdmin", "Admin"]), async (req, res) => {
    try {
        await db.promise().query(`DELETE FROM Matches WHERE MatchID = ?`, [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting match:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// get all tournaments endpoint
app.get('/api/tournaments', async (req, res) => {
    try {
        const searchTerm = req.query.q || '';
        const query = `
            SELECT * FROM Tournaments
            WHERE Name LIKE ?
            ORDER BY StartDate DESC
        `;
        const [tournaments] = await db.promise().execute(query, [`%${searchTerm}%`]);
        res.json(tournaments);
    } catch (error) {
        console.error('Error fetching tournaments:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// get a single tournament endpoint
app.get('/api/tournaments/:id', async (req, res) => {
    try {
        const [tournament] = await db.promise().execute(
            'SELECT * FROM Tournaments WHERE TournamentID = ?',
            [req.params.id]
        );
        if (tournament.length === 0) return res.status(404).json({ error: 'Tournament not found' });
        res.json(tournament[0]);
    } catch (error) {
        console.error('Error fetching tournament:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// create a tournament endpoint
app.post('/api/tournaments', verifyRole(["SuperAdmin", "Admin"]), async (req, res) => {
    try {
        const {
            Name,
            Description,
            UniversityID,
            StartDate,
            EndDate,
            NextRoundDate,
            Location,
            Status,
            EliminationsComplete
        } = req.body;

        const [result] = await db.promise().execute(`
            INSERT INTO Tournaments 
            (Name, Description, UniversityID, StartDate, EndDate, NextRoundDate, Location, Status, EliminationsComplete)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            Name,
            Description || null,
            UniversityID || null,
            StartDate,
            EndDate,
            NextRoundDate || null,
            Location,
            Status,
            EliminationsComplete
        ]);

        res.json({ id: result.insertId });
    } catch (error) {
        console.error('Error creating tournament:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// update a tournament endpoint
app.put('/api/tournaments/:id', verifyRole(["SuperAdmin", "Admin"]), async (req, res) => {
    try {
        const {
            Name,
            Description,
            UniversityID,
            StartDate,
            EndDate,
            NextRoundDate,
            Location,
            Status,
            EliminationsComplete
        } = req.body;

        await db.promise().execute(`
            UPDATE Tournaments 
            SET 
                Name = ?,
                Description = ?,
                UniversityID = ?,
                StartDate = ?,
                EndDate = ?,
                NextRoundDate = ?,
                Location = ?,
                Status = ?,
                EliminationsComplete = ?
            WHERE TournamentID = ?
        `, [
            Name,
            Description || null,
            UniversityID || null,
            StartDate,
            EndDate,
            NextRoundDate || null,
            Location,
            Status,
            EliminationsComplete,
            req.params.id
        ]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating tournament:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// delete a tournament endpoint
app.delete('/api/tournaments/:id', verifyRole(["SuperAdmin", "Admin"]), async (req, res) => {
    try {
        await db.promise().execute(
            'DELETE FROM Tournaments WHERE TournamentID = ?',
            [req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting tournament:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// fetch registrations with search endpoint
app.get('/api/registrations', async (req, res) => {
    try {
        const searchTerm = req.query.q || '';
        const query = `
            SELECT r.*, u.Name AS UserName 
            FROM Registrations r
            JOIN Users u ON r.UserID = u.UserID
            WHERE u.Name LIKE ?
            ORDER BY r.RegistrationDate DESC
        `;
        const [results] = await db.promise().execute(query, [`%${searchTerm}%`]);
        res.json(results);
    } catch (error) {
        console.error('Error fetching registrations:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// fetch a single registration endpoint
app.get('/api/registrations/:id', async (req, res) => {
    try {
        const [results] = await db.promise().execute(
            'SELECT * FROM Registrations WHERE RegistrationID = ?',
            [req.params.id]
        );
        if (results.length === 0) return res.status(404).json({ error: 'Registration not found' });
        res.json(results[0]);
    } catch (error) {
        console.error('Error fetching registration:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// update a registration endpoint
app.put('/api/registrations/:id', verifyRole(["SuperAdmin", "Admin", "Moderator"]), async (req, res) => {
    try {
        const { TournamentID, TeamID, Status } = req.body;
        await db.promise().execute(
            'UPDATE Registrations SET TournamentID = ?, TeamID = ?, Status = ? WHERE RegistrationID = ?',
            [TournamentID, TeamID, Status, req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating registration:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// verify student endpoint
app.post('/api/registrations/:id/verify', verifyRole(["SuperAdmin", "Admin", "Moderator"]), async (req, res) => {
    try {
        const [registration] = await db.promise().execute(
            'SELECT UserID FROM Registrations WHERE RegistrationID = ?',
            [req.params.id]
        );

        if (registration.length === 0) return res.status(404).json({ error: 'Registration not found' });

        // Update player validation
        await db.promise().execute(
            'UPDATE Players SET ValidStudent = TRUE WHERE UserID = ?',
            [registration[0].UserID]
        );

        // Update registration status
        await db.promise().execute(
            'UPDATE Registrations SET Status = "Verified" WHERE RegistrationID = ?',
            [req.params.id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error verifying player:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// delete a registration endpoint
app.delete('/api/registrations/:id', verifyRole(["SuperAdmin", "Admin", "Moderator"]), async (req, res) => {
    try {
        await db.promise().execute(
            'DELETE FROM Registrations WHERE RegistrationID = ?',
            [req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting registration:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// get payments with optional search by user name endpoint
app.get('/api/payments', async (req, res) => {
    try {
        const searchTerm = req.query.q || '';
        const query = `
            SELECT p.*, u.Name AS UserName 
            FROM Payments p
            JOIN Users u ON p.UserID = u.UserID
            WHERE u.Name LIKE ?
            ORDER BY p.PaymentDate DESC
        `;
        const [results] = await db.promise().execute(query, [`%${searchTerm}%`]);
        res.json(results);
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// get a single payment endpoint
app.get('/api/payments/:id', async (req, res) => {
    try {
        const [results] = await db.promise().execute(
            'SELECT * FROM Payments WHERE PaymentID = ?',
            [req.params.id]
        );
        if (results.length === 0) return res.status(404).json({ error: 'Payment not found' });
        res.json(results[0]);
    } catch (error) {
        console.error('Error fetching payment:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// fetch analytics data endpoint
app.get('/api/analytics', verifyRole(["SuperAdmin", "Admin", "Moderator"]), async (req, res) => {
    try {
        // get database stats
        const [universities] = await db.promise().execute('SELECT COUNT(*) as count FROM University');
        const [teams] = await db.promise().execute('SELECT COUNT(*) as count FROM Teams');
        const [tournaments] = await db.promise().execute('SELECT COUNT(*) as count FROM Tournaments');
        const [registrations] = await db.promise().execute('SELECT COUNT(*) as count FROM Registrations');

        // in the future, this will be replaced with real Google Analytics data
        res.json({
            users: 123456,
            sessions: 234567,
            bounceRate: '47.8%',
            avgSessionDuration: '3m 25s',
            topPage: {
                name: '/homepage',
                views: 12345
            },
            dbStats: {
                universities: universities[0].count,
                teams: teams[0].count,
                tournaments: tournaments[0].count,
                registrations: registrations[0].count || 0
            }
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics data' });
    }
});

// 404 page endpoint
app.use((req, res, next) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// sample data, activated only once
async function seedSampleData() {
    try {
        // check if data already exists
        const [universities] = await db.promise().execute(
            "SELECT COUNT(*) as count FROM University"
        );

        // if data exists, skip seeding
        if (universities[0].count > 0) {
            console.log("Sample data already exists, skipping seeding");
            return;
        }

        console.log("Seeding database with sample data...");

        // Begin transaction
        await db.promise().beginTransaction();

        // insert universities
        await db.promise().execute(`
        INSERT INTO University (Name, Location, Founded, Emblem, ImageURL, Description, HasPage) VALUES 
        ("Kyoto University", "Kyoto, Japan", "June 18, 1897", "/media/img/kyoto.png", "/media/img/kyoto-university.jpg", "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.", TRUE),
        ("U Pontificia Universidad Catolica de Chile", "Santiago, Chile", "June 21, 1888", "/media/img/chile.png", "/media/img/chile-university.jpg", "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.", TRUE),
        ("Indian Institute of Technology", "Delhi, India", "August 17, 1961", "/media/img/india.png", "/media/img/india-university.jpg", "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.", TRUE),
        ("Massachusetts Institute of Technology", "Cambridge, USA", "April 10, 1861", "/media/img/mit.png", "/media/img/mit-university.jpg", "MIT is a private research university known for its scientific and technological training and research.", TRUE),
        ("University of Oxford", "Oxford, UK", "1096", "/media/img/oxford.png", "/media/img/oxford-university.jpg", "Oxford is the oldest university in the English-speaking world and the world's second-oldest university in continuous operation.", TRUE),
        ("Stanford University", "Stanford, CA, USA", "October 1, 1891", "/media/img/stanford.png", "/media/img/stanford-university.jpg", "Stanford University is a private research university in Stanford, California known for its academic achievements and wealth.", TRUE),
        ("University of Tokyo", "Tokyo, Japan", "April 12, 1877", "/media/img/tokyo.png", "/media/img/tokyo-university.jpg", "The University of Tokyo is a public research university located in Tokyo, Japan. It is the first imperial university.", TRUE)
      `);

        // insert teams
        await db.promise().execute(`
        INSERT INTO Teams (Name, UniversityID, Description, ImageURL) VALUES
        ("Team Kyoto", 1, "Official team representing Kyoto University", "/media/img/team-kyoto.jpg"),
        ("Team Chile", 2, "Official team representing Universidad Catolica de Chile", "/media/img/team-chile.jpg"),
        ("Team India", 3, "Official team representing Indian Institute of Technology", "/media/img/team-india.jpg"),
        ("MIT Beavers", 4, "Official esports team of Massachusetts Institute of Technology", "/media/img/mit-team.jpg"),
        ("Oxford Lions", 5, "Championship team from University of Oxford", "/media/img/oxford-team.jpg"),
        ("Kyoto Dragons", 1, "Secondary team from Kyoto University", "/media/img/kyoto-dragons.jpg"),
        ("Chile Condors", 2, "Elite squad from Universidad Catolica de Chile", "/media/img/chile-condors.jpg"),
        ("Delhi Tigers", 3, "Top-ranked team from IIT Delhi", "/media/img/delhi-tigers.jpg"),
        ("Stanford Cardinals", 6, "Stanford University's premier team", "/media/img/stanford-team.jpg"),
        ("Tokyo Titans", 7, "University of Tokyo's competitive squad", "/media/img/tokyo-team.jpg")
      `);

        // insert tournaments
        await db.promise().execute(`
        INSERT INTO Tournaments (Name, Description, StartDate, EndDate, NextRoundDate, Location, Status, UniversityID, EliminationsComplete) VALUES
        ('Kyoto Student Festival 2025', 'Annual student-led festival featuring sports competitions, cultural events, and international exchanges.', '2025-10-13', '2025-10-20', '2025-10-16', 'Kyoto, Japan', 'Upcoming', 1, FALSE),
        ('PUCV International Sports Cup', 'Premier Latin American university tournament combining football, basketball, and cultural activities.', '2025-03-15', '2025-03-22', '2025-03-18', 'Santiago, Chile', 'Completed', 2, TRUE),
        ('58th Inter IIT Sports Meet', 'National championship between 23 IITs featuring 14 sports including cricket, football, and aquatics.', '2025-12-10', '2025-12-19', NULL, 'Delhi, India', 'Upcoming', 3, FALSE),
        ('Global University Championship', 'Prestigious international tournament featuring top university teams from around the world', '2025-06-15', '2025-06-30', '2025-06-20', 'Cambridge, USA', 'Upcoming', 4, FALSE),
        ('Oxford Invitational', 'Annual tournament hosted by Oxford University featuring elite academic institutions', '2025-02-10', '2025-02-15', NULL, 'Oxford, UK', 'Completed', 5, TRUE),
        ('Asia-Pacific University Games', 'Regional competition for universities across the Asia-Pacific region', '2025-09-05', '2025-09-15', '2025-09-10', 'Tokyo, Japan', 'Upcoming', 7, FALSE),
        ('Stanford Summer Series', 'Summer tournament featuring teams from top universities worldwide', '2025-07-10', '2025-07-20', NULL, 'Stanford, CA', 'Upcoming', 6, FALSE),
        ('Winter Collegiate Challenge', 'Winter tournament for university teams focusing on indoor sports', '2025-01-15', '2025-01-25', NULL, 'Cambridge, USA', 'Completed', 4, TRUE)
      `);

        // insert matches
        await db.promise().execute(`
        INSERT INTO Matches (TournamentID, Team1ID, Team2ID, MatchDate, RoundNumber, ScoreTeam1, ScoreTeam2, WinnerID, Status) VALUES
        (1, 1, 2, '2025-10-14 15:00:00', 1, 0, 0, NULL, 'Planned'),
        (1, 3, 1, '2025-10-16 18:00:00', 2, 0, 0, NULL, 'Planned'),
        (2, 2, 3, '2025-03-16 14:00:00', 1, 3, 1, 2, 'Completed'),
        (2, 7, 8, '2025-03-17 16:00:00', 1, 2, 4, 8, 'Completed'),
        (3, 3, 1, '2025-12-12 12:00:00', 1, 0, 0, NULL, 'Planned'),
        (4, 4, 5, '2025-06-16 13:00:00', 1, 0, 0, NULL, 'Planned'),
        (5, 5, 1, '2025-02-12 11:00:00', 1, 3, 1, 5, 'Completed'),
        (6, 6, 7, '2025-09-07 15:30:00', 1, 0, 0, NULL, 'Planned'),
        (7, 9, 10, '2025-07-12 13:00:00', 1, 0, 0, NULL, 'Planned'),
        (8, 4, 9, '2025-01-17 14:00:00', 1, 2, 3, 9, 'Completed')
      `);

        // insert schedules
        await db.promise().execute(`
        INSERT INTO Schedules (MatchID, ScheduledDate) VALUES
        (1, '2025-10-14 15:00:00'),
        (2, '2025-10-16 18:00:00'),
        (3, '2025-03-16 14:00:00'),
        (4, '2025-03-17 16:00:00'),
        (5, '2025-12-12 12:00:00'),
        (6, '2025-06-16 13:00:00'),
        (7, '2025-02-12 11:00:00'),
        (8, '2025-09-07 15:30:00'),
        (9, '2025-07-12 13:00:00'),
        (10, '2025-01-17 14:00:00')
      `);

        // insert posts
        await db.promise().execute(`
        INSERT INTO Posts (Title, ImageURL, Content, Author, CreatedAt) VALUES
        ('Welcome to the Tournament Platform', '/media/img/tournament-welcome.jpg', 'We are excited to announce the upcoming tournaments! Join us for a season of competition, sportsmanship, and academic excellence.', 'Admin', '2025-01-01 10:00:00'),
        ('Team Chile Wins PUCV Cup', '/media/img/chile-win.jpg', 'Team Chile has won the PUCV International Sports Cup with outstanding performance. Congratulations to all participants for their dedication and sportsmanship.', 'Moderator', '2025-03-22 18:00:00'),
        ('New Teams Joining for Summer Series', '/media/img/new-teams.jpg', 'Several new teams have registered for the Stanford Summer Series. We look forward to seeing fresh talent and exciting matches.', 'Admin', '2025-04-15 14:30:00'),
        ('Global University Championship Registration Now Open', '/media/img/registration-open.jpg', 'Registration for the Global University Championship is now open. Early bird discounts available until May 1st.', 'Tournament Director', '2025-04-20 09:00:00'),
        ('Oxford Invitational Results', '/media/img/oxford-results.jpg', 'The Oxford Invitational has concluded with Oxford Lions taking the championship. See the full results and highlights on our website.', 'Event Coordinator', '2025-02-16 11:15:00')
      `);

        await db.promise().commit();
        console.log("Sample data seeded successfully");

    } catch (error) {
        // rollback on error
        await db.promise().rollback();
        console.error("Error seeding sample data:", error);
    }
}

// start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    seedSampleData().catch(err => console.error("Failed to seed data:", err));
});