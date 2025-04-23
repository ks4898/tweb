document.addEventListener("DOMContentLoaded", function() {
    let currentMatchId = null;
    let isEditMode = false;
    const matchModal = new bootstrap.Modal(document.getElementById('matchModal'));
    const deleteMatchModal = new bootstrap.Modal(document.getElementById('deleteMatchModal'));
    let tournaments = [];

    // Initial load
    fetchMatches();
    loadTournaments();

    // Event Listeners
    document.getElementById('addMatchBtn').addEventListener('click', showAddModal);
    document.getElementById('searchMatchesBtn').addEventListener('click', searchMatches);
    document.getElementById('editMatchBtn').addEventListener('click', prepareEdit);
    document.getElementById('deleteMatchBtn').addEventListener('click', prepareDelete);
    document.getElementById('saveMatchBtn').addEventListener('click', saveMatch);
    document.getElementById('confirmDeleteMatchBtn').addEventListener('click', confirmDelete);

    // Table row selection handler
    document.getElementById('matchesTableBody').addEventListener('click', function(e) {
        const row = e.target.closest('tr');
        if (!row) return;
        
        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        row.classList.add('selected');
        currentMatchId = row.dataset.matchId;
    });

    async function fetchMatches(searchTerm = '') {
        try {
            const url = `/api/matches?status=Planned,Cancelled${searchTerm ? `&q=${encodeURIComponent(searchTerm)}` : ''}`;
            const response = await fetch(url);
            const matches = await response.json();
            renderMatches(matches);
        } catch (error) {
            console.error('Error fetching matches:', error);
            alert('Failed to load matches');
        }
    }

    function renderMatches(matches) {
        const tbody = document.getElementById('matchesTableBody');
        tbody.innerHTML = matches.map(match => `
            <tr data-match-id="${match.MatchID}">
                <td>${match.MatchID}</td>
                <td>${match.TournamentName || 'N/A'}</td>
                <td>${match.Team1Name || 'TBD'}</td>
                <td>${match.Team2Name || 'TBD'}</td>
                <td>${new Date(match.MatchDate).toLocaleString()}</td>
                <td>${getRoundName(match.RoundNumber)}</td>
                <td>${match.Status}</td>
            </tr>
        `).join('');
    }

    function getRoundName(roundNumber) {
        switch(roundNumber) {
            case 4: return 'Quarterfinals';
            case 5: return 'Round of 16';
            default: return `Round ${roundNumber}`;
        }
    }

    async function loadTournaments() {
        try {
            const response = await fetch('/tournaments');
            tournaments = await response.json();
            const select = document.getElementById('tournamentSelect');
            select.innerHTML = '<option value="">Select Tournament</option>' + 
                tournaments.map(t => 
                    `<option value="${t.TournamentID}">${t.Name}</option>`
                ).join('');
        } catch (error) {
            console.error('Error loading tournaments:', error);
        }
    }

    function showAddModal() {
        isEditMode = false;
        currentMatchId = null;
        document.getElementById('matchForm').reset();
        document.getElementById('tournamentSelectContainer').style.display = 'block';
        document.getElementById('tournamentSelect').disabled = false;
        document.getElementById('matchModalLabel').textContent = 'Add New Match';
        matchModal.show();
    }

    async function prepareEdit() {
        if (!currentMatchId) {
            alert('Please select a match first');
            return;
        }

        try {
            const match = await fetch(`/api/matches/${currentMatchId}`).then(res => res.json());
            
            // Hide tournament selection for edits
            document.getElementById('tournamentSelectContainer').style.display = 'none';
            
            // Populate form fields
            document.getElementById('matchTeam1ID').value = match.Team1ID || '';
            document.getElementById('matchTeam2ID').value = match.Team2ID || '';
            document.getElementById('matchFirstTeamScore').value = match.ScoreTeam1 || 0;
            document.getElementById('matchSecondTeamScore').value = match.ScoreTeam2 || 0;
            document.getElementById('matchSelectWinner').value = match.WinnerID === match.Team1ID ? '1' : '2';
            document.getElementById('matchMatchDate').value = 
                new Date(match.MatchDate).toISOString().slice(0, 16);
            document.getElementById('matchRoundNumber').value = match.RoundNumber || 4;

            document.getElementById('matchModalLabel').textContent = `Edit Match #${currentMatchId}`;
            isEditMode = true;
            matchModal.show();
        } catch (error) {
            console.error('Error preparing edit:', error);
            alert('Failed to load match details');
        }
    }

    async function saveMatch() {
        const matchData = {
            Team1ID: parseInt(document.getElementById('matchTeam1ID').value),
            Team2ID: parseInt(document.getElementById('matchTeam2ID').value),
            ScoreTeam1: parseInt(document.getElementById('matchFirstTeamScore').value),
            ScoreTeam2: parseInt(document.getElementById('matchSecondTeamScore').value),
            WinnerID: document.getElementById('matchSelectWinner').value === '1' ? 
                parseInt(document.getElementById('matchTeam1ID').value) : 
                parseInt(document.getElementById('matchTeam2ID').value),
            MatchDate: document.getElementById('matchMatchDate').value,
            RoundNumber: parseInt(document.getElementById('matchRoundNumber').value),
            Status: 'Planned'
        };

        // Add TournamentID only for new matches
        if (!isEditMode) {
            matchData.TournamentID = parseInt(document.getElementById('tournamentSelect').value);
        }

        if (!validateMatch(matchData, isEditMode)) return;

        try {
            const method = isEditMode ? 'PUT' : 'POST';
            const url = isEditMode ? `/api/matches/${currentMatchId}` : '/api/matches';
            
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(matchData)
            });

            if (!response.ok) throw new Error('Save failed');
            
            alert(`Match ${isEditMode ? 'updated' : 'created'} successfully!`);
            matchModal.hide();
            fetchMatches();
            currentMatchId = null;
        } catch (error) {
            console.error('Error saving match:', error);
            alert('Failed to save match');
        }
    }

    function validateMatch(match, isEdit) {
        document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
        let isValid = true;

        if (!isEdit && !match.TournamentID) {
            document.getElementById('tournamentSelect').classList.add('is-invalid');
            alert('Please select a tournament');
            isValid = false;
        }

        if (match.Team1ID === match.Team2ID) {
            alert('Team 1 and Team 2 cannot be the same');
            isValid = false;
        }

        if (match.RoundNumber < 4 || match.RoundNumber > 5) {
            document.getElementById('matchRoundNumber').classList.add('is-invalid');
            isValid = false;
        }

        if (new Date(match.MatchDate) < new Date()) {
            document.getElementById('matchMatchDate').classList.add('is-invalid');
            isValid = false;
        }

        if (!match.Team1ID || !match.Team2ID) {
            alert('Both teams must be selected');
            isValid = false;
        }

        return isValid;
    }

    async function prepareDelete() {
        if (!currentMatchId) {
            alert('Please select a match first');
            return;
        }

        try {
            deleteMatchModal.show();
        } catch (error) {
            console.error('Error preparing delete:', error);
            alert('Failed to load match details');
        }
    }

    async function confirmDelete() {
        try {
            const response = await fetch(`/api/matches/${currentMatchId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Delete failed');
            
            alert('Match deleted successfully');
            deleteMatchModal.hide();
            fetchMatches();
            currentMatchId = null;
        } catch (error) {
            console.error('Error deleting match:', error);
            alert('Failed to delete match');
        }
    }

    function searchMatches() {
        const searchTerm = document.getElementById('searchMatches').value.trim();
        fetchMatches(searchTerm);
    }
});