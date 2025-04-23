document.addEventListener("DOMContentLoaded", function() {
    let currentRegistrationId = null;
    const viewModal = new bootstrap.Modal(document.getElementById('registrationModal'));
    const editModal = new bootstrap.Modal(document.getElementById('editRegistrationModal'));
    const deleteModal = new bootstrap.Modal(document.getElementById('deleteRegistrationModal'));

    // Initial load
    fetchRegistrations();

    // Event Listeners
    document.getElementById('searchRegistrationBtn').addEventListener('click', searchRegistrations);
    document.getElementById('viewRegistrationBtn').addEventListener('click', viewRegistration);
    document.getElementById('editRegistrationBtn').addEventListener('click', prepareEdit);
    document.getElementById('deleteRegistrationBtn').addEventListener('click', prepareDelete);
    document.getElementById('confirmDeleteRegistrationBtn').addEventListener('click', confirmDelete);
    document.getElementById('saveRegistrationBtn').addEventListener('click', saveRegistration);

    // Table row selection handler
    document.getElementById('registrationsTableBody').addEventListener('click', function(e) {
        const row = e.target.closest('tr');
        if (!row) return;
        
        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        row.classList.add('selected');
        currentRegistrationId = row.dataset.registrationId;
    });

    async function fetchRegistrations(searchTerm = '') {
        try {
            const url = `/api/registrations${searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : ''}`;
            const response = await fetch(url);
            const registrations = await response.json();
            renderRegistrations(registrations);
        } catch (error) {
            console.error('Error fetching registrations:', error);
            alert('Failed to load registrations');
        }
    }

    function renderRegistrations(registrations) {
        const tbody = document.getElementById('registrationsTableBody');
        tbody.innerHTML = registrations.map(reg => `
            <tr data-registration-id="${reg.RegistrationID}">
                <td>${reg.RegistrationID}</td>
                <td>${reg.UserID}</td>
                <td>${reg.TournamentID || 'N/A'}</td>
                <td>${reg.TeamID || 'N/A'}</td>
                <td>${reg.NewTeamName || 'N/A'}</td>
                <td>${reg.Message?.substring(0, 20) || 'N/A'}</td>
                <td>${renderStatusBadge(reg.Status)}</td>
                <td>${new Date(reg.RegistrationDate).toLocaleDateString()}</td>
            </tr>
        `).join('');
    }

    function renderStatusBadge(status) {
        return status === 'Verified' ? 
            '<span class="badge bg-success">Verified</span>' :
            '<span class="badge bg-warning text-dark">Pending</span>';
    }

    async function viewRegistration() {
        if (!currentRegistrationId) {
            alert('Please select a registration first');
            return;
        }

        try {
            const reg = await fetch(`/api/registrations/${currentRegistrationId}`).then(res => res.json());
            
            document.getElementById('viewRegistrationID').value = reg.RegistrationID;
            document.getElementById('viewRegistrationUserID').value = reg.UserID;
            document.getElementById('viewRegistrationTournamentID').value = reg.TournamentID || 'N/A';
            document.getElementById('viewRegistrationTeamID').value = reg.TeamID || 'N/A';
            document.getElementById('viewRegistrationNewTeamName').value = reg.NewTeamName || 'N/A';
            document.getElementById('viewRegistrationMessage').value = reg.Message || 'N/A';
            document.getElementById('viewRegistrationStatus').value = reg.Status;
            document.getElementById('viewRegistrationDate').value = reg.RegistrationDate ?
                new Date(reg.RegistrationDate).toISOString().slice(0, 16) : 'N/A';

            viewModal.show();
        } catch (error) {
            console.error('Error viewing registration:', error);
            alert('Failed to load registration details');
        }
    }

    async function prepareEdit() {
        if (!currentRegistrationId) {
            alert('Please select a registration first');
            return;
        }

        try {
            const reg = await fetch(`/api/registrations/${currentRegistrationId}`).then(res => res.json());
            
            document.getElementById('editRegistrationTournamentID').value = reg.TournamentID || '';
            document.getElementById('editRegistrationTeamID').value = reg.TeamID || '';
            document.getElementById('editRegistrationStatus').value = reg.Status === 'Verified' ? '1' : '0';

            editModal.show();
        } catch (error) {
            console.error('Error preparing edit:', error);
            alert('Failed to load registration details');
        }
    }

    async function saveRegistration() {
        try {
            const regData = {
                TournamentID: parseInt(document.getElementById('editRegistrationTournamentID').value) || null,
                TeamID: parseInt(document.getElementById('editRegistrationTeamID').value) || null,
                Status: document.getElementById('editRegistrationStatus').value === '1' ? 'Verified' : 'Pending'
            };

            const response = await fetch(`/api/registrations/${currentRegistrationId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(regData)
            });

            if (!response.ok) throw new Error('Update failed');
            
            if (regData.Status === 'Verified') {
                await updatePlayerValidation(currentRegistrationId);
            }

            alert('Registration updated successfully!');
            editModal.hide();
            fetchRegistrations();
        } catch (error) {
            console.error('Error saving registration:', error);
            alert('Failed to update registration');
        }
    }

    async function updatePlayerValidation(registrationId) {
        try {
            const response = await fetch(`/api/registrations/${registrationId}/verify`, { method: 'POST' });
            if (!response.ok) throw new Error('Player validation update failed');
        } catch (error) {
            console.error('Validation update error:', error);
            throw error;
        }
    }

    function prepareDelete() {
        if (!currentRegistrationId) {
            alert('Please select a registration first');
            return;
        }
        deleteModal.show();
    }

    async function confirmDelete() {
        try {
            const response = await fetch(`/api/registrations/${currentRegistrationId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Delete failed');
            
            alert('Registration deleted successfully');
            deleteModal.hide();
            fetchRegistrations();
            currentRegistrationId = null;
        } catch (error) {
            console.error('Error deleting registration:', error);
            alert('Failed to delete registration');
        }
    }

    function searchRegistrations() {
        const searchTerm = document.getElementById('searchRegistration').value.trim();
        fetchRegistrations(searchTerm);
    }
});
