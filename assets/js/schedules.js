document.addEventListener("DOMContentLoaded", function() {
    const container = document.querySelector('.container');
    const classes = ['teal', 'aqua', 'green'];
    
    fetch('/api/matches/planned')
        .then(response => response.json())
        .then(matches => {
            // Group matches by tournament
            const tournaments = {};
            matches.forEach(match => {
                const tournamentId = match.TournamentID;
                if (!tournaments[tournamentId]) {
                    tournaments[tournamentId] = {
                        name: match.TournamentName,
                        matches: []
                    };
                }
                tournaments[tournamentId].matches.push(match);
            });

            // Clear existing placeholder content
            container.innerHTML = '<h1>Schedules</h1>';

            if(matches.length === 0) {
                let noMatches = document.createElement("p");
                noMatches.setAttribute("id","no-matches");
                noMatches.textContent = "No matches to show.";
                container.appendChild(noMatches);
                return;
            }
            
            // Convert to array and maintain order
            const tournamentEntries = Object.values(tournaments);
            
            // Create tournament sections with cycling classes
            tournamentEntries.forEach((tournament, index) => {
                const tournamentDiv = document.createElement('div');
                tournamentDiv.className = `tournament ${classes[index % classes.length]}`;
                
                const title = document.createElement('h2');
                title.className = 'tournament-name';
                title.textContent = tournament.name;

                const matchList = document.createElement('ul');
                matchList.className = 'matches';

                tournament.matches.forEach(match => {
                    const matchItem = document.createElement('li');
                    const team1 = match.Team1Name || 'TBD';
                    const team2 = match.Team2Name || 'TBD';
                    const matchDate = new Date(match.MatchDate).toLocaleString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                    });
                    
                    matchItem.textContent = `${team1} vs ${team2} - ${matchDate}`;
                    matchList.appendChild(matchItem);
                });

                tournamentDiv.appendChild(title);
                tournamentDiv.appendChild(matchList);
                container.appendChild(tournamentDiv);
            });
        })
        .catch(error => {
            console.error('Error loading schedules:', error);
            container.innerHTML = '<p class="text-white">Error loading upcoming matches</p>';
        });
});