document.addEventListener("DOMContentLoaded", function() {
    let currentTournamentId = null;
    const tournamentModal = new bootstrap.Modal(document.getElementById('tournamentModal'));
    const deleteTournamentModal = new bootstrap.Modal(document.getElementById('deleteTournamentModal'));
    
    // Initial load
    fetchTournaments();

    // Event Listeners
    document.getElementById('searchTournamentBtn').addEventListener('click', searchTournaments);
    document.getElementById('addTournamentBtn').addEventListener('click', showAddModal);
    document.getElementById('editTournamentBtn').addEventListener('click', prepareEdit);
    document.getElementById('deleteTournamentBtn').addEventListener('click', prepareDelete);
    document.getElementById('confirmDeleteTournamentBtn').addEventListener('click', confirmDelete);
    document.getElementById('saveTournamentBtn').addEventListener('click', saveTournament);

    // Table row selection handler
    document.getElementById('tournamentTableBody').addEventListener('click', function(e) {
        const row = e.target.closest('tr');
        if (!row) return;
        
        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        row.classList.add('selected');
        currentTournamentId = row.dataset.tournamentId;
    });

    async function fetchTournaments(searchTerm = '') {
        try {
            const url = `/api/tournaments${searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : ''}`;
            const tournaments = await fetch(url).then(res => res.json());
            renderTournaments(tournaments);
        } catch (error) {
            console.error('Error fetching tournaments:', error);
            alert('Failed to load tournaments');
        }
    }

    function renderTournaments(tournaments) {
        const tbody = document.getElementById('tournamentTableBody');
        tbody.innerHTML = tournaments.map(tournament => `
            <tr data-tournament-id="${tournament.TournamentID}">
                <td>${tournament.TournamentID}</td>
                <td>${tournament.UniversityID || 'N/A'}</td>
                <td>${tournament.Name}</td>
                <td>${tournament.Description?.substring(0, 50) || 'No description'}</td>
                <td>${new Date(tournament.StartDate).toLocaleDateString()}</td>
                <td>${new Date(tournament.EndDate).toLocaleDateString()}</td>
                <td>${tournament.NextRoundDate ? new Date(tournament.NextRoundDate).toLocaleDateString() : 'N/A'}</td>
                <td>${tournament.Location}</td>
                <td>${tournament.Status}</td>
                <td>${tournament.EliminationsComplete ? 'Yes' : 'No'}</td>
            </tr>
        `).join('');
    }

    function showAddModal() {
        document.getElementById('tournamentModalLabel').textContent = 'Add New Tournament';
        document.getElementById('tournamentForm').reset();
        document.getElementById('tournamentHostID').disabled = false;
        tournamentModal.show();
    }

    async function prepareEdit() {
        if (!currentTournamentId) {
            alert('Please select a tournament first');
            return;
        }

        try {
            const tournament = await fetch(`/api/tournaments/${currentTournamentId}`).then(res => res.json());
            
            document.getElementById('tournamentName').value = tournament.Name;
            document.getElementById('tournamentDescription').value = tournament.Description || '';
            document.getElementById('tournamentHostID').value = tournament.UniversityID || '';
            document.getElementById('tournamentStartDate').value = formatDateTimeLocal(tournament.StartDate);
            document.getElementById('tournamentEndDate').value = formatDateTimeLocal(tournament.EndDate);
            document.getElementById('tournamentNextRoundDate').value = tournament.NextRoundDate ? formatDateTimeLocal(tournament.NextRoundDate) : '';
            document.getElementById('tournamentLocation').value = tournament.Location;
            document.getElementById('tournamentSelectStatus').value = tournament.Status;
            document.getElementById('tournamentSelectEliminationsComplete').value = tournament.EliminationsComplete ? '1' : '0';

            document.getElementById('tournamentModalLabel').textContent = `Edit Tournament #${currentTournamentId}`;
            document.getElementById('tournamentHostID').disabled = true;
            tournamentModal.show();
        } catch (error) {
            console.error('Error preparing edit:', error);
            alert('Failed to load tournament details');
        }
    }

    function formatDateTimeLocal(dateString) {
        const date = new Date(dateString);
        return date.toISOString().slice(0, 16);
    }

    async function saveTournament() {
        const tournamentData = {
            Name: document.getElementById('tournamentName').value.trim(),
            Description: document.getElementById('tournamentDescription').value.trim(),
            UniversityID: parseInt(document.getElementById('tournamentHostID').value),
            StartDate: document.getElementById('tournamentStartDate').value,
            EndDate: document.getElementById('tournamentEndDate').value,
            NextRoundDate: document.getElementById('tournamentNextRoundDate').value || null,
            Location: document.getElementById('tournamentLocation').value.trim(),
            Status: document.getElementById('tournamentSelectStatus').value,
            EliminationsComplete: document.getElementById('tournamentSelectEliminationsComplete').value === '1'
        };

        if (!validateTournament(tournamentData)) return;

        try {
            const method = currentTournamentId ? 'PUT' : 'POST';
            const url = currentTournamentId ? `/api/tournaments/${currentTournamentId}` : '/api/tournaments';
            
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tournamentData)
            });

            if (!response.ok) throw new Error('Save failed');
            
            alert(`Tournament ${currentTournamentId ? 'updated' : 'created'} successfully!`);
            tournamentModal.hide();
            fetchTournaments();
            currentTournamentId = null;
        } catch (error) {
            console.error('Error saving tournament:', error);
            alert('Failed to save tournament');
        }
    }

    function validateTournament(data) {
        // Clear previous errors
        document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
        let isValid = true;

        if (!data.Name) {
            document.getElementById('tournamentName').classList.add('is-invalid');
            isValid = false;
        }

        if (!data.UniversityID || isNaN(data.UniversityID)) {
            document.getElementById('tournamentHostID').classList.add('is-invalid');
            isValid = false;
        }

        if (!data.StartDate) {
            document.getElementById('tournamentStartDate').classList.add('is-invalid');
            isValid = false;
        }

        if (!data.EndDate) {
            document.getElementById('tournamentEndDate').classList.add('is-invalid');
            isValid = false;
        }

        if (new Date(data.StartDate) > new Date(data.EndDate)) {
            alert('End date must be after start date');
            isValid = false;
        }

        if (data.NextRoundDate && new Date(data.NextRoundDate) < new Date(data.StartDate)) {
            alert('Next round date must be after start date');
            isValid = false;
        }

        if (!data.Location) {
            document.getElementById('tournamentLocation').classList.add('is-invalid');
            isValid = false;
        }

        return isValid;
    }

    function prepareDelete() {
        if (!currentTournamentId) {
            alert('Please select a tournament first');
            return;
        }
        deleteTournamentModal.show();
    }

    async function confirmDelete() {
        try {
            const response = await fetch(`/api/tournaments/${currentTournamentId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Delete failed');
            
            alert('Tournament deleted successfully');
            deleteTournamentModal.hide();
            fetchTournaments();
            currentTournamentId = null;
        } catch (error) {
            console.error('Error deleting tournament:', error);
            alert('Failed to delete tournament');
        }
    }

    function searchTournaments() {
        const searchTerm = document.getElementById('searchTournament').value.trim();
        fetchTournaments(searchTerm);
    }
});