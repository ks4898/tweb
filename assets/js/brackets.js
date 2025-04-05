let teams = [];

async function loadTeams() {
    const res = await fetch('/api/teams');
    teams = await res.json();
}

function createTeamSelect() {
    const select = document.createElement('select');
    select.classList.add('team-select');
    teams.forEach(team => {
        const option = document.createElement('option');
        option.value = team.name;
        option.textContent = team.name;
        select.appendChild(option);
    });
    return select;
}

function createTeamDiv() {
    const teamDiv = document.createElement('div');
    teamDiv.className = 'team';

    /*
    const img = document.createElement('img');
    img.src = '/media/img/default-logo.jpg'; // Default image before team is selected
    img.alt = 'Team Logo';
    */

    const select = createTeamSelect();

    // Update image on team select
    /*
    select.addEventListener('change', () => {
        const selectedTeam = teams.find(t => t.name === select.value);
        img.src = selectedTeam?.logo_url || '/media/img/default-logo.jpg';
    });
    */

    //teamDiv.appendChild(img);
    teamDiv.appendChild(select);
    return teamDiv;
}

async function addMatch() {
    const teams = await fetch("/api/teams").then(res => res.json());

    const matchContainer = document.getElementById("matches");
    const match = document.createElement("div");
    match.className = "match";

    match.innerHTML = `
        <div class="team">
            <select class="team-select team1">
                ${teams.map(team => `<option value="${team.TeamID}">${team.Name}</option>`).join("")}
            </select>
        </div>
        <input type="number" class="score score1" value="0">
        <span>vs</span>
        <input type="number" class="score score2" value="0">
        <div class="team">
            <select class="team-select team2">
                ${teams.map(team => `<option value="${team.TeamID}">${team.Name}</option>`).join("")}
            </select>
        </div>
        <button class="confirm-btn">✅</button>
        <button class="cancel-btn">❌</button>
    `;

    matchContainer.appendChild(match);

    // Confirm button handler
    match.querySelector(".confirm-btn").addEventListener("click", async () => {
        const team1 = match.querySelector(".team1").value;
        const team2 = match.querySelector(".team2").value;
        const score1 = match.querySelector(".score1").value;
        const score2 = match.querySelector(".score2").value;
        console.log(team1 + "  " + team2);

        const winner = score1 > score2 ? team1 : score2 > score1 ? team2 : null;

        const matchData = {
            team1ID: team1,
            team2ID: team2,
            scoreTeam1: score1,
            scoreTeam2: score2,
            winnerID: winner,
            matchDate: new Date().toISOString().slice(0, 19).replace("T", " "), // MySQL DATETIME format
            tournamentID: 1 // <-- hardcoded for now, adjust if needed
        };

        try {
            const res = await fetch("/api/matches", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(matchData)
            });

            if (res.ok) {
                alert("Match saved!");
                match.querySelector(".confirm-btn").remove(); // hide confirm button
                match.querySelector(".cancel-btn").textContent = "Remove"; // turn cancel into "Remove"
            } else {
                alert("Failed to save match.");
            }
        } catch (err) {
            console.error(err);
            alert("Error connecting to server.");
        }
    });

    // Cancel button handler
    match.querySelector(".cancel-btn").addEventListener("click", () => {
        match.remove();
    });
}


// Load team data when the page loads
window.onload = async () => {
    await loadTeams();
    addMatch(); // Add initial match
};