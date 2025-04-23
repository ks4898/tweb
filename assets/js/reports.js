class ReportManager {
    constructor() {
        this.collegeSort = { column: 'date', direction: 'desc' };
        this.tournamentSort = { column: 'date', direction: 'desc' };
        this.today = new Date().toISOString().split('T')[0];
        this.createToastContainer();
        this.initDatePickers();
        this.initSorting();
        this.initEventListeners();
        this.loadReports();
    }

    createToastContainer() {
        if (!document.querySelector('.toast-container')) {
            const container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
    }

    initDatePickers() {
        const collegeStart = document.getElementById('collegeStartDate');
        const collegeEnd = document.getElementById('collegeEndDate');
        const tournamentStart = document.getElementById('tournamentStartDate');
        const tournamentEnd = document.getElementById('tournamentEndDate');

        collegeStart.max = this.today;
        collegeEnd.max = this.today;
        tournamentStart.max = this.today;
        tournamentEnd.max = this.today;

        collegeStart.value = this.today;
        collegeEnd.value = this.today;
        tournamentStart.value = this.today;
        tournamentEnd.value = this.today;
    }

    initSorting() {
        document.querySelectorAll('[data-sort]').forEach(header => {
            header.addEventListener('click', (e) => {
                const tableType = e.target.closest('table').id.includes('College') ? 'college' : 'tournament';
                const column = e.target.dataset.sort;

                if (this[`${tableType}Sort`].column === column) {
                    this[`${tableType}Sort`].direction =
                        this[`${tableType}Sort`].direction === 'asc' ? 'desc' : 'asc';
                } else {
                    this[`${tableType}Sort`].column = column;
                    this[`${tableType}Sort`].direction = 'asc';
                }

                this[`load${tableType.charAt(0).toUpperCase() + tableType.slice(1)}Report`]();
            });
        });
    }

    initEventListeners() {
        document.getElementById('collegeApplyBtn').addEventListener('click', () => this.loadCollegeReport());
        document.getElementById('tournamentApplyBtn').addEventListener('click', () => this.loadTournamentReport());

        document.getElementById('collegeStartDate').addEventListener('change', (e) => {
            document.getElementById('collegeEndDate').min = e.target.value;
        });

        document.getElementById('tournamentStartDate').addEventListener('change', (e) => {
            document.getElementById('tournamentEndDate').min = e.target.value;
        });
    }

    async loadCollegeReport() {
        try {
            const startDate = document.getElementById('collegeStartDate').value;
            const endDate = document.getElementById('collegeEndDate').value;

            if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
                this.showError('Start date cannot be after end date');
                return;
            }

            this.showLoader('collegeReportBody');

            const params = new URLSearchParams({
                startDate: startDate || '',
                endDate: endDate || '',
                sort: this.collegeSort.column
            });

            const response = await fetch(`/api/reports/college-signups?${params}`);
            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();

            this.populateTable({
                bodyId: 'collegeReportBody',
                data: data,
                columns: row => [
                    new Date(row.DateAdded).toLocaleDateString(),
                    row.collegeName,
                    row.country.includes(',') ?
                        row.country.split(',').pop().trim() :
                        row.country,
                    row.teamCount,
                    row.memberCount,
                    this.renderBadge(row.hasModerator),
                    this.renderBadge(row.HasPage)
                ],
                totals: {
                    colleges: data.length,
                    teams: data.reduce((sum, row) => sum + row.teamCount, 0),
                    members: data.reduce((sum, row) => sum + row.memberCount, 0)
                }
            });

        } catch (error) {
            console.error('College report error:', error);
            this.showError('Failed to load college report');
        }
    }

    async loadTournamentReport() {
        try {
            const startDate = document.getElementById('tournamentStartDate').value;
            const endDate = document.getElementById('tournamentEndDate').value;

            if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
                this.showError('Start date cannot be after end date');
                return;
            }

            this.showLoader('tournamentReportBody');

            const params = new URLSearchParams({
                startDate: startDate || '',
                endDate: endDate || '',
                sort: this.tournamentSort.column
            });

            const response = await fetch(`/api/reports/tournament-status?${params}`);
            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();

            this.populateTable({
                bodyId: 'tournamentReportBody',
                data: data,
                columns: row => [
                    row.NextRoundDate ?
                        new Date(row.NextRoundDate).toLocaleDateString() : 'No Date',
                    row.collegeName,
                    row.country?.trim() || 'N/A',
                    row.plannedMatches,
                    row.completedMatches,
                    this.renderBadge(row.EliminationsComplete)
                ],
                totals: {
                    colleges: data.length,
                    planned: data.reduce((sum, row) => sum + row.plannedMatches, 0),
                    completed: data.reduce((sum, row) => sum + row.completedMatches, 0)
                }
            });

        } catch (error) {
            console.error('Tournament report error:', error);
            this.showError('Failed to load tournament report');
        }
    }

    populateTable({ bodyId, data, columns, totals }) {
        const tbody = document.getElementById(bodyId);
        tbody.innerHTML = data.map(row => `
            <tr>
                ${columns(row).map(cell => `<td>${cell}</td>`).join('')}
            </tr>
        `).join('');

        if (bodyId === 'collegeReportBody') {
            document.getElementById('totalColleges').textContent = totals.colleges;
            document.getElementById('totalTeams').textContent = totals.teams;
            document.getElementById('totalMembers').textContent = totals.members;
        } else {
            document.getElementById('totalTournamentColleges').textContent = totals.colleges;
            document.getElementById('totalPlanned').textContent = totals.planned;
            document.getElementById('totalCompleted').textContent = totals.completed;
        }
    }

    renderBadge(value) {
        if (typeof value === 'number') {
            return value === 1 ?
                '<span class="badge bg-success">Yes</span>' :
                '<span class="badge bg-danger">No</span>';
        }
        return typeof value === 'boolean' ?
            `<span class="badge ${value ? 'bg-success' : 'bg-danger'}">
                ${value ? 'Yes' : 'No'}
            </span>` :
            `<span class="badge bg-secondary">N/A</span>`;
    }


    showLoader(tableId) {
        const tbody = document.getElementById(tableId);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </td>
            </tr>`;
    }

    showError(message) {
        const toast = document.createElement('div');
        toast.className = 'toast align-items-center text-white bg-danger border-0';
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>`;

        document.querySelector('.toast-container').appendChild(toast);
        new bootstrap.Toast(toast).show();
        setTimeout(() => toast.remove(), 5000);
    }

    loadReports() {
        this.loadCollegeReport();
        this.loadTournamentReport();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => new ReportManager());