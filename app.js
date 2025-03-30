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

/* DEPRECATED!
 require('express-async-errors');*/

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

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

/* DEPRECATED!
function requireAdminAuth(req, res) {
    if (!req.session.userId) {
        return res.sendFile(path.join(__dirname, "public", "login.html"));
    }
    if (req.session.role !== 'Admin' && req.session.role !== 'SuperAdmin') {
        return res.sendFile(path.join(__dirname, "public", "index.html"));
    }
}*/


// ======================== SERVE PAGES & SESSION CHECKING ========================

// serve home page
app.get("/", (req, res) => {
    if (req.session.userId) {
        return res.sendFile(path.join(__dirname, "public", "index.html"));
    }
});

// serve about page
app.get("/about", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "about.html"));
});

// serve colleges page
app.get("/colleges", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "colleges.html"));
});

// serve brackets page
app.get("/brackets", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "brackets.html"));
});

// serve schedule page
app.get("/schedule", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "schedule.html"));
});

// serve details page
app.get("/details", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "details.html"));
});

// serve payment page
app.get("/payment", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "payment.html"));
});

// serve news page
app.get("/news", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "news.html"));
});

// serve login page
app.get("/login", (req, res) => {
    if (req.session.userId) { // logged in check
        // user is already logged in, redirect to home page
        return res.redirect("/");
    }
    res.sendFile(path.join(__dirname, "public", "login.html")); // not logged in, redirect to login page
});

// serve sign up page
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

// session check
app.get("/check-session", (req, res) => {
    return res.json({
        loggedIn: !!req.session.userId,
        role: req.session.role || null
    });
});


// ======================== USER AUTHENTICATION ========================

// login route
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

// sign up route
app.post("/signup", async (req, res) => {
    const { username, email, password } = req.body;

    // check inputs
    if (!username || !email || !password) {
        return res.status(400).json({ message: "Please fill all of the fields." });
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
            if (copycat.email === email) {
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

// logout route
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

// route to fetch all colleges
app.get("/universities", (req, res) => {
    db.execute("SELECT * FROM University", (err, results) => {
        if (err) {
            console.error("Database query error:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.json(results);
    });
});

// get all or search colleges
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

// fetch college by id or name
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

// add college (Admins & SuperAdmins)
app.post("/add-college", verifyRole(["SuperAdmin", "Admin"]), (req, res) => {
    const { name, location, founded, description, logoURL, pictureURL } = req.body;
    db.execute("INSERT INTO University (Name, Location, Founded, Emblem, ImageURL, Description) VALUES (?, ?, ?, ?, ?, ?)", [name, location, founded, logoURL, pictureURL, description], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error. Please try again later." });
        res.status(201).json({ message: "College added successfully!" });
    });
});


// edit college (Admins & SuperAdmins)
app.put("/edit-college/:collegeId", verifyRole(["SuperAdmin", "Admin"]), (req, res) => {
    const { name, location, founded, description, logoURL, pictureURL } = req.body;
    const collegeId = req.params.collegeId;

    db.execute("UPDATE University SET Name = ?, Location = ?, Founded = ?, Emblem = ?, ImageURL = ?, Description = ? WHERE UniversityID = ?", [name, location, founded, logoURL, pictureURL, description, collegeId], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error. Please try again later." });

        res.json({ message: "College updated successfully!" });
    });
});

// delete college (Admins & SuperAdmins)
app.delete("/delete-college/:collegeId", verifyRole(["SuperAdmin", "Admin"]), (req, res) => {
    const collegeId = req.params.collegeId;
    db.execute("DELETE FROM University WHERE UniversityID = ?", [collegeId], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error. Please try again later." });
        res.json({ message: "College deleted successfully!" });
    });
});


// route to fetch all teams
app.get("/teams", (req, res) => {
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

// fetch teams and players for a college
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

// add team (Admins & SuperAdmins)
app.post("/add-team", verifyRole(["SuperAdmin", "Admin"]), (req, res) => {
    const { name, universityId } = req.body;

    db.execute("INSERT INTO Teams (Name, UniversityID) VALUES (?, ?)", [name, universityId], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error. Please try again later." });

        res.status(201).json({ message: "Team added successfully!" });
    });
});

// edit team (Admins & SuperAdmins)
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

// delete team (Admins & SuperAdmins)
app.delete("/delete-team/:teamId", verifyRole(["SuperAdmin", "Admin"]), (req, res) => {
    const teamId = req.params.teamId;
    db.execute("DELETE FROM Teams WHERE TeamID = ?", [teamId], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error. Please try again later." });
        res.json({ message: "Team deleted successfully!" });
    });
});

// fetch a team
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

// search teams
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
            res.json(results); // Always return results, even if empty
        }
    );
});

// fetch team members
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

// ======================== TOURNAMENT MANAGEMENT ========================

// sign up for a tournament
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

// cancel tournament sign up (only for the creator of the team)
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

// leave a team
app.delete("/leave-team", verifyRole(["Player"]), (req, res) => {
    const userId = req.session.userId;

    db.execute("UPDATE Users SET TeamID = NULL, Role = 'User' WHERE UserID = ?", [userId], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error." });

        res.json({ message: "You left the team successfully!" });
    });
});

// create a tournament (SuperAdmins & Admins)
app.post("/add-tournament", verifyRole(["SuperAdmin", "Admin"]), (req, res) => {
    const { name, startDate, location } = req.body;

    db.execute("INSERT INTO Tournaments (TournamentName, StartDate, Location) VALUES (?, ?, ?)", [name, startDate, location], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error." });

        res.status(201).json({ message: "Tournament created successfully!" });
    });
});

/* DEPRECATED!
// ======================== SEARCH FUNCTIONALITY ========================
app.get("/search-teams", async (req, res) => {
    const { query } = req.query;

    if (!query) {
        return res.status(400).json({ message: "Search query is required." });
    }

    db.execute(
        "SELECT * FROM Teams WHERE Name LIKE ? OR UniversityID IN (SELECT UniversityID FROM University WHERE Name LIKE ?)",
        [`%${query}%`, `%${query}%`],
        (err, results) => {
            if (err) return res.status(500).json({ message: "Database error. Please try again later." });
            if (results.length === 0) {
                return res.status(404).json({ message: "No teams found matching your search criteria." });
            }
            res.json(results);
        }
    );
});*/


// ======================== TOURNAMENT EXECUTION MANAGEMENT ========================

// fetch schedules route
app.get("/schedules", (req, res) => {
    const limit = req.query.limit || 6; // Default limit
    const offset = req.query.offset || 1; // Default offset

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

// add schedule
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

// post results
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


// ======================== REPORT GENERATION ========================

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

// handle management page
app.get("/account.html", (req, res) => {
    if (!req.session.userId) {
        return res.sendFile(path.join(__dirname, "public", "index.html"));
    }
    if (!['Admin', 'SuperAdmin'].includes(req.session.role)) {
        return res.sendFile(path.join(__dirname, "public", "index.html"));
    }
    res.sendFile(path.join(__dirname, "public", "account.html"));
});

// serve management page
app.get("/account", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "account.html"));
});

// get available roles based on current user admin privileges
app.get("/roles", verifyRole(["SuperAdmin", "Admin"]), (req, res) => {
    let roles = [];
    if (req.session.role === "Admin") {
        roles = VALID_ROLES.filter(role => !["Admin", "SuperAdmin"].includes(role));
    } else if (req.session.role === "SuperAdmin") {
        roles = VALID_ROLES.filter(role => role !== "SuperAdmin");
    }
    //res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json(roles);
});

// get user id, name, role
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

// get all or search users
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

// route to display all necessary information when editing user, including Player specific info
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

// add new user route
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

// edit user route
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

        /*// NOT WORKING NEEDS FIXING
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

// delete user
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

// route to check if player has paid the fee
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

// Create payment intent
app.post('/create-payment-intent', verifyRole(["Player"]), async (req, res) => {
    try {
        const userId = req.session.userId;
        
        // Fixed database query destructuring
        const player = await db.execute(
            'SELECT PayedFee FROM Players WHERE UserID = ?',
            [userId]
        );

        if (!player || player.length === 0) {
            return res.status(404).json({ error: "Player account not found" });
        }
        if (player.payedFee === 1) {
            return res.status(400).json({ error: "Payment already completed" });
        }

        // Create payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: 1000,
            currency: 'usd',
            payment_method_types: ['card'],
            metadata: { userId }
        });

        res.json({ clientSecret: paymentIntent.client_secret });

    } catch (error) {
        console.error('Payment Intent Error:', error);
        res.status(500).json({ error: "Payment system error - contact support" });
    }
});

// Payment confirmation
app.post('/confirm-payment', verifyRole(["Player"]), async (req, res) => {
    try {
        const { paymentIntentId } = req.body;
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        
        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ error: 'Payment not completed' });
        }

        // Use TRUE for boolean column
        await db.execute(
            'UPDATE Players SET PayedFee = TRUE WHERE UserID = ?',
            [paymentIntent.metadata.userId]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Payment confirmation error:', error);
        res.status(500).json({ error: 'Payment verification failed' });
    }
});

app.get('/payment-success', verifyRole(["Player"]), async (req, res) => {
    try {
        const [player] = await db.promise().query(
            'SELECT PayedFee FROM Players WHERE UserID = ?',
            [req.session.userId]
        );
        console.log(player[0].PayedFee);

        // Check for boolean TRUE (1 in MySQL)
        if (player[0].PayedFee !== 1) {
            return res.redirect('/payment');
        }
        
        res.sendFile(path.join(__dirname, 'public', 'payment-success.html'));
    } catch (error) {
        console.error('Payment verification error:', error);
        res.redirect('/');
    }
});


/*// payment processing route
app.post('/create-payment-intent', verifyRole(["Player"]), async (req, res) => {
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: 1000, // $10 in cents
            currency: 'usd',
            metadata: { userId: req.session.userId }
        });

        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});*/

/*app.post('/create-payment-intent', /*verifyRole(["Player"]), async (req, res) => {
    // mock implementation
    res.json({ clientSecret: 'mock_client_secret' });
});*/

/*// confirm payment
app.post('/confirm-payment', verifyRole(["Player"]), async (req, res) => {
    const { paymentIntentId } = req.body;
    const userId = req.session.userId;

    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.metadata.userId !== userId.toString()) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (paymentIntent.status === 'succeeded') {
            // update the database to mark the player as paid
            db.execute('UPDATE Players SET PayedFee = TRUE WHERE UserID = ?', [userId], (err, result) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Failed to update payment status' });
                }
                res.json({ success: true, message: 'Payment confirmed and recorded' });
            });
        } else {
            res.status(400).json({ error: 'Payment not successful' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});*/

/* mock payment confirm
app.post('/confirm-payment', /*verifyRole(["Player"]), async (req, res) => {
    const userId = req.session.userId;

    try {
        db.execute('UPDATE Players SET PayedFee = TRUE WHERE UserID = ?', [userId], (err, result) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to update payment status' });
            }
            res.json({ success: true, message: 'Payment confirmed and recorded' });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});*/


// tournament signup route
app.post('/tournament-signup', verifyRole(["Player"]), async (req, res) => {
    const { tournamentId } = req.body;
    const userId = req.session.userId;

    try {
        const userResult = await db.promise().query('SELECT TeamID FROM Players WHERE UserID = ?', [userId]);
        if (userResult[0].length === 0 || !userResult[0][0].TeamID) {
            return res.status(400).json({ success: false, message: "You must be part of a team to sign up for a tournament." });
        }

        const teamId = userResult[0][0].TeamID;

        const registrationResult = await db.promise().query('SELECT * FROM Registrations WHERE UserID = ? AND TournamentID = ?', [userId, tournamentId]);
        if (registrationResult[0].length > 0) {
            return res.status(400).json({ success: false, message: "You have already signed up for this tournament." });
        }

        await db.promise().query('INSERT INTO Registrations (UserID, TournamentID, TeamID, PaymentStatus) VALUES (?, ?, ?, ?)', [userId, tournamentId, teamId, 'Pending']);

        res.json({ success: true, message: "Registration successful. Please proceed to payment." });
    } catch (error) {
        console.error('Error during tournament signup:', error);
        res.status(500).json({ success: false, message: "An error occurred during signup. Please try again." });
    }
});

// Fetch all news articles
app.get('/news-articles', async (req, res) => {
    try {
        const [posts] = await db.promise().query('SELECT * FROM Posts ORDER BY CreatedAt DESC');
        res.json(posts);
    } catch (error) {
        console.error('Error fetching news:', error);
        res.status(500).json({ message: 'Error fetching news' });
    }
});

// Create a new news article
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

// Update a news article
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

// Delete a news article
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


// start the server
app.listen(port);

/*app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});*/
