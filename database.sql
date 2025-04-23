-- database schema for the Aardvark Games Tournament Platform
CREATE DATABASE TournamentDB;
USE TournamentDB;

-- Users table to store all user accounts

CREATE TABLE Users (
    UserID INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(255) NOT NULL,
    Email VARCHAR(255) UNIQUE NOT NULL,
    Password VARCHAR(255) NOT NULL,
    Role VARCHAR(50) NOT NULL, -- User, Player, CollegeRep, Moderator, Admin, SuperAdmin
    CreateDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- University table to store college information

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

CREATE TABLE CollegeReps (
    ModeratorID INT PRIMARY KEY AUTO_INCREMENT,
    UserID INT UNIQUE,
    UniversityID INT UNIQUE,
    AssignedDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
    FOREIGN KEY (UniversityID) REFERENCES University(UniversityID) ON DELETE CASCADE
);


CREATE TABLE SuperAdmins (
    SuperAdminID INT PRIMARY KEY AUTO_INCREMENT,
    UserID INT UNIQUE,
    FOREIGN KEY (UserID) REFERENCES Users(UserID)
);


CREATE TABLE Admins (
    AdminID INT PRIMARY KEY AUTO_INCREMENT,
    UserID INT UNIQUE,
    FOREIGN KEY (UserID) REFERENCES Users(UserID)
);


CREATE TABLE Moderators (
    ModeratorID INT PRIMARY KEY AUTO_INCREMENT,
    UserID INT UNIQUE,
    FOREIGN KEY (UserID) REFERENCES Users(UserID)
);


CREATE TABLE Schedules (
    ScheduleID INT PRIMARY KEY AUTO_INCREMENT,
    MatchID INT,
    ScheduledDate DATETIME NOT NULL,
    FOREIGN KEY (MatchID) REFERENCES Matches(MatchID)
);


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


CREATE TABLE Registrations (
        RegistrationID INT PRIMARY KEY AUTO_INCREMENT,
        UserID INT,
        TournamentID INT,
        TeamID INT,
        NewTeamName VARCHAR(255),
        Message TEXT,
        Status VARCHAR(50) DEFAULT 'Pending',
        RegistrationDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
        FOREIGN KEY (TournamentID) REFERENCES Tournaments(TournamentID) ON DELETE CASCADE,
        FOREIGN KEY (TeamID) REFERENCES Teams(TeamID) ON DELETE SET NULL
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
    Status VARCHAR(50) DEFAULT 'Planned', -- Planned, Completed
    FOREIGN KEY (TournamentID) REFERENCES Tournaments(TournamentID) ON DELETE CASCADE,
    FOREIGN KEY (Team1ID) REFERENCES Teams(TeamID) ON DELETE SET NULL,
    FOREIGN KEY (Team2ID) REFERENCES Teams(TeamID) ON DELETE SET NULL,
    FOREIGN KEY (WinnerID) REFERENCES Teams(TeamID) ON DELETE SET NULL
);

-- Payments table to store payment information

CREATE TABLE Payments (
  PaymentID INT PRIMARY KEY AUTO_INCREMENT,
  RegistrationID INT NOT NULL,
  UserID INT,
  TeamID INT,
  TournamentID INT,
  Amount DECIMAL(10, 2),
  Status VARCHAR(50),
  SuccessPageViewed BOOLEAN DEFAULT FALSE,
  PaymentDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (UserID) REFERENCES Users(UserID),
  FOREIGN KEY (TeamID) REFERENCES Teams(TeamID),
  FOREIGN KEY (TournamentID) REFERENCES Tournaments(TournamentID),
  FOREIGN KEY (RegistrationID) REFERENCES Registrations(RegistrationID)
);

-- News/blog posts table

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