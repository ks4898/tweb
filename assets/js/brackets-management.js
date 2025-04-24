document.addEventListener("DOMContentLoaded", function () {
    let currentTournamentId = null;
    let currentMatches = [];

    const editBracketModal = new bootstrap.Modal(
        document.getElementById('editBracketModal')
    );
    const deleteBracketModal = new bootstrap.Modal(
        document.getElementById('deleteBracketModal')
    );

    document.getElementById('searchTournamentsBtn').addEventListener('click', function () {
        const searchTerm = document.getElementById('searchTournaments').value.trim();
        fetchTournaments(searchTerm);
    });

    // initialize tournaments table
    fetchTournaments();

    // tournament selection handler
    document.getElementById('bracketsTableBody').addEventListener('click', function (e) {
        const row = e.target.closest('tr');
        if (!row) return;
        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        row.classList.add('selected');
        currentTournamentId = row.dataset.tournamentId;
    });

    // edit Bracket button handler
    document.getElementById('editBracketBtn').addEventListener('click', async () => {
        if (!currentTournamentId) {
            alert('Please select a tournament first');
            return;
        }

        try {
            currentMatches = await fetch(`/matches?tournamentId=${currentTournamentId}&rounds=2,3`)
                .then(res => res.json());

            // initialize form state
            const bracketTypeSelect = document.getElementById('editBracketSelectBracket');
            bracketTypeSelect.innerHTML = `
                <option value="2">Semifinal</option>
                <option value="3">Final</option>
            `;

            // set default state
            bracketTypeSelect.value = '2';
            document.getElementById('editBracketSelectSemiFinal').parentElement.style.display = 'block';

            // load first available match
            loadBracketData();

            editBracketModal.show();
        } catch (error) {
            console.error('Error loading bracket data:', error);
            alert('Failed to load bracket data');
        }
    });

    // bracket type change handler
    document.getElementById('editBracketSelectBracket').addEventListener('change', function () {
        document.getElementById('editBracketSelectSemiFinal').parentElement.style.display =
            this.value === '2' ? 'block' : 'none';
        loadBracketData();
    });

    // semifinal match change handler
    document.getElementById('editBracketSelectSemiFinal').addEventListener('change', loadBracketData);

    // load match data based on selections
    function loadBracketData() {
        const bracketType = document.getElementById('editBracketSelectBracket').value;
        const semifinalIndex = document.getElementById('editBracketSelectSemiFinal').value;

        let targetMatch;
        if (bracketType === '2') { // Semifinal
            const semifinals = currentMatches.filter(m => m.RoundNumber === 2);
            targetMatch = semifinals[semifinalIndex];
        } else { // Final
            targetMatch = currentMatches.find(m => m.RoundNumber === 3);
        }

        if (targetMatch) {
            populateFormFields(targetMatch);
        } else {
            resetFormFields();
        }
    }

    function populateFormFields(match) {
        const winnerSelect = document.getElementById('editBracketSelectWinner');

        // always reset options first
        winnerSelect.innerHTML = `
            <option value="1">Team 1</option>
            <option value="2">Team 2</option>
        `;

        if (match) {
            document.getElementById('editBracketFirstTeamName').value = match.Team1Name || '';
            document.getElementById('editBracketFirstTeamScore').value = match.ScoreTeam1 || 0;
            document.getElementById('editBracketSecondTeamName').value = match.Team2Name || '';
            document.getElementById('editBracketSecondTeamScore').value = match.ScoreTeam2 || 0;
            document.getElementById('editBracketMatchDate').value =
                match.MatchDate ? new Date(match.MatchDate).toISOString().slice(0, 16) : '';

            // set winner selection
            if (match.WinnerID === match.Team1ID) winnerSelect.value = '1';
            if (match.WinnerID === match.Team2ID) winnerSelect.value = '2';
        }
    }


    function resetFormFields() {
        const winnerSelect = document.getElementById('editBracketSelectWinner');

        // clear all fields
        document.getElementById('editBracketFirstTeamName').value = '';
        document.getElementById('editBracketFirstTeamScore').value = '';
        document.getElementById('editBracketSecondTeamName').value = '';
        document.getElementById('editBracketSecondTeamScore').value = '';
        document.getElementById('editBracketMatchDate').value = '';

        // initialize winner select with default options
        winnerSelect.innerHTML = `
            <option value="1">Team 1</option>
            <option value="2">Team 2</option>
        `;
    }


    // save bracket handler
    document.getElementById('saveBracketBtn').addEventListener('click', async () => {
        const bracketType = document.getElementById('editBracketSelectBracket').value;
        const semifinalIndex = document.getElementById('editBracketSelectSemiFinal').value;

        try {
            // get team names from inputs
            const team1Name = document.getElementById('editBracketFirstTeamName').value.trim();
            const team2Name = document.getElementById('editBracketSecondTeamName').value.trim();

            // get/create teams with EXACT name matches
            const [team1Id, team2Id] = await Promise.all([
                getOrCreateTeamExact(team1Name),
                getOrCreateTeamExact(team2Name)
            ]);

            // determine winner ID based on dropdown value (1/2)
            const winnerValue = document.getElementById('editBracketSelectWinner').value;
            const winnerId = winnerValue === '1' ? team1Id : team2Id;

            // prepare match data
            const matchData = {
                TournamentID: currentTournamentId,
                Team1ID: team1Id,
                Team2ID: team2Id,
                ScoreTeam1: parseInt(document.getElementById('editBracketFirstTeamScore').value),
                ScoreTeam2: parseInt(document.getElementById('editBracketSecondTeamScore').value),
                WinnerID: winnerId,
                MatchDate: document.getElementById('editBracketMatchDate').value,
                RoundNumber: parseInt(bracketType),
                Status: 'Completed'
            };

            let matchId;

            // get the current match being edited based on the form selections
            if (bracketType === '2') {
                // for semifinals, get the specific match based on the semifinal index
                const semifinals = currentMatches.filter(m => m.RoundNumber === 2);
                matchId = semifinals[semifinalIndex]?.MatchID;
            } else {
                // for finals, get the final match
                const final = currentMatches.find(m => m.RoundNumber === 3);
                matchId = final?.MatchID;
            }

            // 6. API call
            const endpoint = matchId ? `/match/${matchId}` : '/matches';
            const method = matchId ? 'PUT' : 'POST';

            const response = await fetch(endpoint, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(matchData)
            });

            if (!response.ok) throw new Error(matchId ? 'Update failed' : 'Creation failed');

            editBracketModal.hide();
            alert(`Bracket ${matchId ? 'updated' : 'created'} successfully!`);
            fetchTournaments();
        } catch (error) {
            console.error('Error saving bracket:', error);
            alert(`Failed to save bracket: ${error.message}`);
        }
    });

    // strict team handling with exact name matching
    async function getOrCreateTeamExact(teamName) {
        if (!teamName) throw new Error('Team name is required');

        // check existing team with exact name match
        const existingTeam = await fetch(`/team/exact?name=${encodeURIComponent(teamName)}`)
            .then(res => res.json());

        if (existingTeam?.TeamID) return existingTeam.TeamID;

        // create new team if doesn't exist
        const newTeam = await fetch('/teams', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ Name: teamName })
        }).then(res => {
            if (!res.ok) throw new Error('Team creation failed');
            return res.json();
        });

        return newTeam.TeamID;
    }

    // delete bracket handler
    document.getElementById('deleteBracketBtn').addEventListener('click', async () => {
        if (!currentTournamentId) {
            alert('Please select a tournament first');
            return;
        }

        const tournament = await fetch(`/tournament/${currentTournamentId}`).then(res => res.json());
        document.getElementById('bracketDetails').textContent =
            `Delete all semifinal and final matches for ${tournament.Name}?`;
        deleteBracketModal.show();
    });

    // confirm delete handler
    document.getElementById('confirmDeleteBracketBtn').addEventListener('click', async () => {
        try {
            const response = await fetch(`/tournament/${currentTournamentId}/brackets`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Deletion failed');

            deleteBracketModal.hide();
            alert('Bracket matches deleted successfully!');
            fetchTournaments();
        } catch (error) {
            console.error('Error deleting brackets:', error);
            alert('Failed to delete brackets');
        }
    });

    // fetch tournaments for table
    async function fetchTournaments(searchTerm = '') {
        try {
            const url = `/api/tournaments/brackets${searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : ''}`;
            const tournaments = await fetch(url).then(res => res.json());
            renderTournaments(tournaments);
        } catch (error) {
            console.error('Error fetching tournaments:', error);
            alert('Failed to load tournaments');
        }
    }

    // render tournaments in table
    function renderTournaments(tournaments) {
        const tbody = document.getElementById('bracketsTableBody');
        tbody.innerHTML = tournaments.map(t => `
            <tr data-tournament-id="${t.TournamentID}">
                <td>${t.TournamentID}</td>
                <td>${t.Name}</td>
            </tr>
        `).join('');
    }
});