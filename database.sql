-- Clean and structured database schema for the Aardvark Games Tournament Platform
DROP DATABASE IF EXISTS TournamentDB;
CREATE DATABASE TournamentDB;
USE TournamentDB;

-- Users table to store all user accounts
DROP TABLE IF EXISTS Users;
CREATE TABLE Users (
    UserID INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(255) NOT NULL,
    Email VARCHAR(255) UNIQUE NOT NULL,
    Password VARCHAR(255) NOT NULL,
    Role VARCHAR(50) NOT NULL, -- User, Player, CollegeRep, Moderator, Admin, SuperAdmin
    CreateDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- University table to store college information
DROP TABLE IF EXISTS University;
CREATE TABLE University (
    UniversityID INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(255) NOT NULL,
    Location VARCHAR(255) NOT NULL,
    Founded VARCHAR(255),
    Emblem VARCHAR(255),
    ImageURL VARCHAR(255),
    Description TEXT,
    Link TEXT,
    HasPage BOOLEAN DEFAULT FALSE,
    DateAdded TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teams table to store team information
DROP TABLE IF EXISTS Teams;
CREATE TABLE Teams (
    TeamID INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(255) NOT NULL,
    UniversityID INT,
    Description TEXT,
    ImageURL VARCHAR(255),
    CreatedDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (UniversityID) REFERENCES University(UniversityID) ON DELETE CASCADE
);

-- Players table to store player information
DROP TABLE IF EXISTS Players;
CREATE TABLE Players (
    PlayerID INT PRIMARY KEY AUTO_INCREMENT,
    UserID INT,
    Role VARCHAR(50) NOT NULL, -- Leader, Member
    ImageURL VARCHAR(255),
    ValidStudent BOOLEAN DEFAULT FALSE,
    TeamID INT NULL,
    PayedFee BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE SET NULL,
    FOREIGN KEY (TeamID) REFERENCES Teams(TeamID) ON DELETE SET NULL
);

-- College moderators table to link users with colleges they moderate
DROP TABLE IF EXISTS CollegeModerators;
CREATE TABLE CollegeModerators (
    ModeratorID INT PRIMARY KEY AUTO_INCREMENT,
    UserID INT,
    UniversityID INT,
    AssignedDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
    FOREIGN KEY (UniversityID) REFERENCES University(UniversityID) ON DELETE CASCADE
);

-- Tournaments table to store tournament information
DROP TABLE IF EXISTS Tournaments;
CREATE TABLE Tournaments (
    TournamentID INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(255) NOT NULL,
    Description TEXT,
    StartDate DATE NOT NULL,
    EndDate DATE NOT NULL,
    NextRoundDate DATE,
    Location VARCHAR(255) NOT NULL,
    Status VARCHAR(50) NOT NULL, -- Upcoming, Ongoing, Completed
    UniversityID INT, -- Host university
    EliminationsComplete BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (UniversityID) REFERENCES University(UniversityID) ON DELETE SET NULL
);

-- Matches table to store match information
DROP TABLE IF EXISTS Matches;
CREATE TABLE Matches (
    MatchID INT PRIMARY KEY AUTO_INCREMENT,
    TournamentID INT,
    Team1ID INT,
    Team2ID INT,
    MatchDate DATETIME NOT NULL,
    RoundNumber INT NOT NULL DEFAULT 0,
    ScoreTeam1 INT DEFAULT 0,
    ScoreTeam2 INT DEFAULT 0,
    WinnerID INT,
    Status VARCHAR(50) DEFAULT 'Planned', -- Planned, Completed, Cancelled
    FOREIGN KEY (TournamentID) REFERENCES Tournaments(TournamentID) ON DELETE CASCADE,
    FOREIGN KEY (Team1ID) REFERENCES Teams(TeamID) ON DELETE SET NULL,
    FOREIGN KEY (Team2ID) REFERENCES Teams(TeamID) ON DELETE SET NULL,
    FOREIGN KEY (WinnerID) REFERENCES Teams(TeamID) ON DELETE SET NULL
);

-- Payments table to store payment information
DROP TABLE IF EXISTS Payments;
CREATE TABLE Payments (
    PaymentID INT PRIMARY KEY AUTO_INCREMENT,
    TeamID INT,
    TournamentID INT,
    Amount DECIMAL(10, 2) NOT NULL,
    Status VARCHAR(50) NOT NULL, -- Pending, Completed, Failed, Refunded
    PaymentMethod VARCHAR(50) NOT NULL, -- CreditCard, PayPal, etc.
    TransactionID VARCHAR(255),
    PaymentDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (TeamID) REFERENCES Teams(TeamID) ON DELETE SET NULL,
    FOREIGN KEY (TournamentID) REFERENCES Tournaments(TournamentID) ON DELETE SET NULL
);

-- News/blog posts table
DROP TABLE IF EXISTS Posts;
CREATE TABLE Posts (
    PostID INT AUTO_INCREMENT PRIMARY KEY,
    Title VARCHAR(255) NOT NULL,
    ImageURL VARCHAR(255),
    Content TEXT NOT NULL,
    Author VARCHAR(100) NOT NULL,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UserID INT,
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE SET NULL
);

-- Insert test data for development and testing purposes

-- Sample users with different roles
INSERT INTO Users (Name, Email, Password, Role) VALUES
('Admin User', 'admin@aardvarkgames.com', '$2a$10$JfKpgwmzABNJ65AtF6M3SuUXNMJqmRdwoALGS2QYnGpTFQYJEk5aq', 'SuperAdmin'), -- password: adminpass
('Moderator User', 'mod@aardvarkgames.com', '$2a$10$UGcjy7YYiJiKQvEJMTvR8OdRJMqT6BgZQRsuuCMG7ocNFqD7YJzJW', 'Moderator'), -- password: modpass
('College Rep', 'rep@kyoto.edu', '$2a$10$1v.gZLJF5Xz5qy2n8qJ6puS3mb3gHM/KFHYPXjAUdDKXLOghrdILa', 'CollegeRep'), -- password: reppass
('Player User', 'player@example.com', '$2a$10$r5HT9JG5nhA4LRfDafXcHeOy6RQjbHUFnLc7zdZQdA.PSvvJmQP6a', 'Player'), -- password: playerpass
('Regular User', 'user@example.com', '$2a$10$ZBRx7kgK2pyuPtUAKJ5UY.yFqgHOKizQEjzYU2e0Ku5MeN9BkfPSW', 'User'); -- password: userpass

-- Sample universities
INSERT INTO University (Name, Location, Founded, Emblem, ImageURL, Description, HasPage) VALUES
('Kyoto University', 'Kyoto, Japan', 'June 18, 1897', '/media/img/kyoto.png', '/media/img/kyoto-university.jpg', 'Kyoto University is one of Japan\'s premier research universities with a rich history of academic excellence and innovation in various fields.', TRUE),
('Pontificia Universidad Católica de Chile', 'Santiago, Chile', 'June 21, 1888', '/media/img/chile.png', '/media/img/chile-university.jpg', 'Pontificia Universidad Católica de Chile is consistently ranked as one of the best universities in Latin America, known for its strong programs in engineering, science, and arts.', TRUE),
('Indian Institute of Technology Delhi', 'Delhi, India', 'August 17, 1961', '/media/img/india.png', '/media/img/india-university.jpg', 'IIT Delhi is one of India\'s most prestigious engineering institutions, known for its cutting-edge research and distinguished faculty.', TRUE),
('Massachusetts Institute of Technology', 'Cambridge, USA', 'April 10, 1861', '/media/img/mit.png', '/media/img/mit-campus.jpg', 'MIT is a world-renowned private research university known for its programs in engineering, science, and technology.', FALSE),
('University of Oxford', 'Oxford, UK', 'c. 1096', '/media/img/oxford.png', '/media/img/oxford-campus.jpg', 'Oxford is the oldest university in the English-speaking world, with a rich tradition of academic excellence spanning nearly a millennium.', TRUE);

-- Link college moderator
INSERT INTO CollegeModerators (UserID, UniversityID) VALUES
(2, 1), -- Moderator for Kyoto
(3, 2); -- College Rep for Chile

-- Sample teams
INSERT INTO Teams (Name, UniversityID, Description, ImageURL) VALUES
('Team Kyoto', 1, 'The official strategy team from Kyoto University, focused on innovative gameplay and collaborative tactics.', '/media/img/team-kyoto.jpg'),
('Chile Strategists', 2, 'A team of dedicated players from Chile who excel at long-term strategic planning and adaptable gameplay.', '/media/img/team-chile.jpg'),
('Delhi Tacticians', 3, 'IIT Delhi\'s premier board game team with a strong foundation in mathematical approaches to gameplay.', '/media/img/team-india.jpg'),
('MIT Calculators', 4, 'MIT\'s team applies computational thinking to board game strategy with impressive results.', '/media/img/team-mit.jpg'),
('Oxford Scholars', 5, 'Drawing on centuries of strategic thinking, this team brings a scholarly approach to modern board gaming.', '/media/img/team-oxford.jpg'),
('Kyoto Sakura', 1, 'A second team from Kyoto University that specializes in aggressive opening strategies.', NULL);

-- Sample players
INSERT INTO Players (UserID, TeamID, Role, ImageURL, ValidStudent, PayedFee) VALUES
(4, 1, 'Leader', '/media/img/student black-male-ge3ccaa24c_1280.jpg', TRUE, TRUE),
(5, 1, 'Member', '/media/img/student student-g3ad8fc5db_1280.jpg', TRUE, TRUE),
(NULL, 2, 'Leader', '/media/img/student young-man-g13d37ca5c_1280.jpg', TRUE, TRUE),
(NULL, 2, 'Member', '/media/img/student woman-g39958ff5b_1280.jpg', TRUE, TRUE),
(NULL, 3, 'Leader', '/media/img/student woman-g7b42a69a8_1280.jpg', TRUE, TRUE),
(NULL, 3, 'Member', '/media/img/student boy-g2ba3e74a1_1280.jpg', TRUE, FALSE),
(NULL, 4, 'Leader', '/media/img/student1.jpg', TRUE, TRUE),
(NULL, 5, 'Leader', '/media/img/student2.jpg', TRUE, TRUE),
(NULL, 6, 'Leader', '/media/img/student3.jpg', TRUE, FALSE);

-- Sample tournaments
INSERT INTO Tournaments (Name, Description, StartDate, EndDate, NextRoundDate, Location, Status, UniversityID, EliminationsComplete) VALUES
('Spring Championship 2025', 'An international tournament featuring teams from universities worldwide.', '2025-04-01', '2025-04-20', '2025-04-12', 'Tokyo, Japan', 'Ongoing', 1, FALSE),
('Summer Invitational 2025', 'Elite invitation-only tournament with top-ranked university teams.', '2025-06-15', '2025-06-30', '2025-06-15', 'Berlin, Germany', 'Upcoming', NULL, FALSE),
('Fall Classic 2025', 'Annual fall tournament celebrating strategic gameplay and university rivalry.', '2025-09-10', '2025-09-25', '2025-09-10', 'Boston, USA', 'Upcoming', 4, FALSE),
('Winter Challenge 2025', 'Year-end championship featuring innovative gameplay and special rule variations.', '2025-12-05', '2025-12-20', '2025-12-05', 'Sydney, Australia', 'Upcoming', NULL, FALSE);

-- Sample matches
INSERT INTO Matches (TournamentID, Team1ID, Team2ID, MatchDate, RoundNumber, ScoreTeam1, ScoreTeam2, WinnerID, Status) VALUES
-- Spring Championship - Past matches
(1, 1, 2, '2025-04-01 18:00:00', 1, 3, 2, 1, 'Completed'),
(1, 3, 4, '2025-04-02 20:00:00', 1, 1, 4, 4, 'Completed'),
(1, 5, 6, '2025-04-03 16:00:00', 1, 5, 0, 5, 'Completed'),
-- Spring Championship - Upcoming matches
(1, 1, 4, '2025-04-12 18:00:00', 2, 0, 0, NULL, 'Planned'),
(1, 5, 3, '2025-04-13 20:00:00', 2, 0, 0, NULL, 'Planned'),
-- Summer Invitational - First round
(2, 2, 5, '2025-06-15 14:00:00', 1, 0, 0, NULL, 'Planned'),
(2, 3, 6, '2025-06-16 15:30:00', 1, 0, 0, NULL, 'Planned'),
(2, 1, 4, '2025-06-17 13:00:00', 1, 0, 0, NULL, 'Planned');

-- Sample payments
INSERT INTO Payments (TeamID, TournamentID, Amount, Status, PaymentMethod, TransactionID) VALUES
(1, 1, 50.00, 'Completed', 'CreditCard', 'txn_1234567890'),
(2, 1, 50.00, 'Completed', 'PayPal', 'PP-1234567890'),
(3, 1, 50.00, 'Completed', 'CreditCard', 'txn_0987654321'),
(4, 1, 50.00, 'Completed', 'CreditCard', 'txn_1122334455'),
(5, 1, 50.00, 'Completed', 'CreditCard', 'txn_5566778899'),
(1, 2, 75.00, 'Pending', 'CreditCard', NULL),
(3, 2, 75.00, 'Failed', 'PayPal', 'PP-FAILED12345');

-- Sample blog posts
INSERT INTO Posts (Title, ImageURL, Content, Author, CreatedAt, UserID) VALUES
('Announcing the 2025 International Tournament Series', '/media/img/tournament-announcement.jpg', 'Aardvark Games is proud to announce our 2025 International Tournament Series, featuring our newest strategy board game. Teams from top universities worldwide will compete for glory and prizes. Read on for more details about registration, venues, and schedules.', 'Aardvark Games Team', '2025-01-15 10:00:00', 1),
('Strategy Tips for New Players', '/media/img/strategy-tips.jpg', 'Thinking of forming a team for our upcoming tournaments? Here are some essential strategy tips for new players to get you started on your journey to tournament success.', 'Game Development Team', '2025-01-20 14:30:00', 1),
('Spotlight: Kyoto University\'s Board Game Club', '/media/img/kyoto-spotlight.jpg', 'We take a closer look at one of the tournament favorites: Kyoto University\'s renowned Board Game Club, with their history of strategic innovation and competitive excellence.', 'Tournament Committee', '2025-02-05 09:15:00', 2),
('Tournament Rules and Guidelines', NULL, 'Important information for all participating teams: detailed rules, match protocols, and competition guidelines for the 2025 Tournament Series.', 'Rules Committee', '2025-02-10 11:45:00', 1);
