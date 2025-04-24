document.addEventListener("DOMContentLoaded", function () {
    // Create a loading indicator
    const loadingIndicator = document.createElement("div");
    loadingIndicator.className = "loading-indicator";
    loadingIndicator.textContent = "Loading college details...";
    document.body.appendChild(loadingIndicator);

    // Create a container for all content
    const contentContainer = document.createElement("div");
    contentContainer.className = "content-container";
    document.body.appendChild(contentContainer);

    // Start fetching data
    fetchCollegeData();
});

async function fetchCollegeData() {
    const urlParams = new URLSearchParams(window.location.search);
    const collegeName = urlParams.get("name");

    if (!collegeName) {
        console.error("No college name provided in URL.");
        window.location.href = "/colleges";
        return;
    }

    try {
        // Fetch college data and teams in parallel
        const [collegeResponse, teamsResponse] = await Promise.all([
            fetch(`/university?name=${collegeName}`),
            fetch(`/teams-for-college?name=${collegeName}`)
        ]);

        if (!collegeResponse.ok) {
            throw new Error(`HTTP error! Status: ${collegeResponse.status}`);
        }

        if (!teamsResponse.ok) {
            throw new Error(`HTTP error! Status: ${teamsResponse.status}`);
        }

        const collegeData = await collegeResponse.json();
        const teams = await teamsResponse.json();

        if (!collegeData || !collegeData.Name || !collegeData.Location || !collegeData.Founded) {
            console.error("Invalid college data received.");
            return;
        }

        // Preload images
        await preloadImages(collegeData, teams);

        // Render the content
        renderCollegeDetails(collegeData, teams);

    } catch (error) {
        console.error("Error fetching data:", error);
        const loadingIndicator = document.querySelector(".loading-indicator");
        if (loadingIndicator) {
            loadingIndicator.textContent = "Error loading college details. Please try again later.";
        }
    }
}

async function preloadImages(collegeData, teams) {
    const imagesToPreload = [];

    // Add college images
    if (collegeData.Emblem) {
        imagesToPreload.push(collegeData.Emblem);
    }

    if (collegeData.ImageURL) {
        imagesToPreload.push(collegeData.ImageURL);
    }

    // Add team player images
    const teamMap = {};
    teams.forEach(team => {
        if (!teamMap[team.TeamID]) {
            teamMap[team.TeamID] = {
                name: team.Name,
                players: []
            };
        }

        if (team.PlayerName && team.ImageURL) {
            teamMap[team.TeamID].players.push({
                name: team.PlayerName,
                imageURL: team.ImageURL,
                role: team.Role
            });

            imagesToPreload.push(team.ImageURL);
        }
    });

    // Preload all images
    const preloadPromises = imagesToPreload.map(src => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve(); // Continue even if image fails to load
            img.src = src;
        });
    });

    return Promise.all(preloadPromises);
}

function renderCollegeDetails(collegeData, teams) {
    const contentContainer = document.querySelector(".content-container");
    
    // Create college info section
    const collegeInfoSection = document.createElement("div");
    collegeInfoSection.className = "college-info";
    
    // College info content
    const infoContent = document.createElement("div");
    infoContent.className = "college-info-content";
    
    // College header with name and emblem
    const header = document.createElement("div");
    header.className = "college-header";
    
    const collegeName = document.createElement("h1");
    collegeName.className = "college-name";
    collegeName.textContent = collegeData.Name.toUpperCase();
    
    const emblem = document.createElement("img");
    emblem.className = "college-emblem";
    emblem.src = collegeData.Emblem || '/media/img/placeholder-250x250.png';
    emblem.alt = `${collegeData.Name} Logo`;

    emblem.onerror = function() {
        this.src = '/media/img/placeholder-250x250.png';
        this.alt = `${collegeData.Name} Logo (Placeholder)`;
    };
    
    header.appendChild(collegeName);
    header.appendChild(emblem);
    
    // Location details
    const locationDetails = document.createElement("div");
    locationDetails.className = "location-details";
    
    const location = document.createElement("p");
    location.className = "location";
    location.textContent = `Location: ${collegeData.Location}`;
    
    const founded = document.createElement("p");
    founded.className = "founded";
    founded.textContent = `Founded: ${collegeData.Founded}`;
    
    locationDetails.appendChild(location);
    locationDetails.appendChild(founded);
    
    // Horizontal rule
    const hr = document.createElement("hr");
    
    // College description
    const description = document.createElement("div");
    description.className = "college-description";
    
    const descPara = document.createElement("p");
    descPara.textContent = collegeData.Description || 'No description available.';
    
    description.appendChild(descPara);
    
    // Assemble info content
    infoContent.appendChild(header);
    infoContent.appendChild(locationDetails);
    infoContent.appendChild(hr);
    infoContent.appendChild(description);
    
    // College image container
    const imageContainer = document.createElement("div");
    imageContainer.className = "college-image-container";
    
    const collegeImage = document.createElement("img");
    collegeImage.className = "college-image";
    collegeImage.src = collegeData.ImageURL || '/media/img/placeholder-uni.png';
    collegeImage.alt = `${collegeData.Name} Picture`;

    collegeImage.onerror = function() {
        this.src = '/media/img/placeholder-uni.png';
        this.alt = `${collegeData.Name} Picture (Placeholder)`;
    };
    
    imageContainer.appendChild(collegeImage);
    
    // Assemble college info section
    collegeInfoSection.appendChild(infoContent);
    collegeInfoSection.appendChild(imageContainer);
    
    // Add college info to content container
    contentContainer.appendChild(collegeInfoSection);
    
    // Create teams section
    if (teams.length <= 0) {
        const teamSection = document.createElement("div");
        teamSection.className = "team-section";
        teamSection.style.height = "30vh";
        
        const noTeamsMsg = document.createElement("p");
        noTeamsMsg.textContent = "No teams have applied for this college yet.";
        noTeamsMsg.style.color = "#F1FDFF";
        noTeamsMsg.style.marginTop = "1em";
        noTeamsMsg.style.textAlign = "center";
        noTeamsMsg.style.fontSize = "2em";
        noTeamsMsg.className = "text-center";
        
        const checkLaterMsg = document.createElement("p");
        checkLaterMsg.textContent = "Please check again later.";
        checkLaterMsg.style.color = "#F1FDFF";
        checkLaterMsg.style.textAlign = "center";
        checkLaterMsg.style.fontSize = "2em";
        checkLaterMsg.className = "text-center";
        
        teamSection.appendChild(noTeamsMsg);
        teamSection.appendChild(checkLaterMsg);
        
        contentContainer.appendChild(teamSection);
    } else {
        // Process teams data
        const teamMap = {};
        teams.forEach(team => {
            if (!teamMap[team.TeamID]) {
                teamMap[team.TeamID] = {
                    id: team.TeamID,
                    name: team.Name,
                    players: []
                };
            }
            
            if (team.PlayerName) {
                teamMap[team.TeamID].players.push({
                    name: team.PlayerName,
                    imageURL: team.ImageURL,
                    role: team.Role
                });
            }
        });
        
        // Create team section
        const teamSection = document.createElement("div");
        teamSection.className = "team-section";
        
        const teamTitle = document.createElement("h2");
        teamTitle.className = "team-title";
        teamTitle.textContent = "Teams from this College";
        
        teamSection.appendChild(teamTitle);
        
        // Create team cards
        Object.values(teamMap).forEach((team, index) => {
            // Sort players to have leader first
            team.players.sort((a, b) => (a.role === 'Leader' ? -1 : b.role === 'Leader' ? 1 : 0));
            
            const teamCard = document.createElement("div");
            teamCard.className = "team-card";
            teamCard.onclick = function() {
                window.location.href = `/teams/${encodeURIComponent(team.name)}`;
            };
            
            const teamName = document.createElement("h3");
            teamName.textContent = `${team.name}`;
            
            const viewButton = document.createElement("button");
            viewButton.className = "view-team-btn";
            viewButton.textContent = "View Team Details";
            viewButton.onclick = function(e) {
                e.stopPropagation();
                window.location.href = `/teams/${encodeURIComponent(team.name)}`;
            };
            
            teamCard.appendChild(teamName);
            teamCard.appendChild(viewButton);
            
            teamSection.appendChild(teamCard);
            
            // Create players section for this team
            const playersTitle = document.createElement("h3");
            playersTitle.className = "team-title";
            playersTitle.style.fontSize = "20px";
            playersTitle.textContent = `Team Members`;
            
            teamSection.appendChild(playersTitle);
            
            const playersContainer = document.createElement("div");
            playersContainer.className = "players-container";
            
            // check if team has players
            if (team.players.length === 0) {
                // display message when no team members exist
                const noPlayersMsg = document.createElement("p");
                noPlayersMsg.textContent = "This team currently has no members.";
                noPlayersMsg.style.color = "#F1FDFF";
                noPlayersMsg.style.textAlign = "center";
                noPlayersMsg.style.fontSize = "1.2em";
                noPlayersMsg.style.width = "100%";
                noPlayersMsg.style.margin = "25px 0";
                
                playersContainer.appendChild(noPlayersMsg);
            } else {
                // Display team members
                team.players.forEach((player, playerIndex) => {
                    const playerCard = document.createElement("div");
                    playerCard.className = "player-card";
                    
                    const playerImg = document.createElement("img");
                    playerImg.src = player.imageURL || '/media/img/profile-placeholder.png';
                    playerImg.alt = `${player.name} Photo`;

                    playerImg.onerror = function() {
                        this.src = '/media/img/profile-placeholder.png';
                        this.alt = `${player.name} Photo (Placeholder)`;
                    };
                    
                    const playerName = document.createElement("p");
                    playerName.textContent = `${player.name}${playerIndex === 0 ? ' (Leader)' : ''}`;
                    
                    playerCard.appendChild(playerImg);
                    playerCard.appendChild(playerName);
                    
                    playersContainer.appendChild(playerCard);
                });
            }
            
            teamSection.appendChild(playersContainer);
        });
        
        contentContainer.appendChild(teamSection);
    }
    
    setTimeout(() => {
        // Remove loading indicator
        const loadingIndicator = document.querySelector(".loading-indicator");
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
    }, 300);
    
    // Show content with a fade-in effect
    setTimeout(() => {
        contentContainer.classList.add('loaded');
    }, 200);
}