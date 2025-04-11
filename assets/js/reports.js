class ReportManager {
    constructor() {
        this.collegeSort = { column: 'date', direction: 'desc' };
        this.tournamentSort = { column: 'date', direction: 'desc' };
        this.today = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format
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
        // Set default to current date
        const collegeStart = document.getElementById('collegeStartDate');
        const collegeEnd = document.getElementById('collegeEndDate');
        const tournamentStart = document.getElementById('tournamentStartDate');
        const tournamentEnd = document.getElementById('tournamentEndDate');

        // Set max attribute to prevent future date selection
        collegeStart.max = this.today;
        collegeEnd.max = this.today;
        tournamentStart.max = this.today;
        tournamentEnd.max = this.today;

        // Set default values to current date
        collegeStart.value = this.today;
        collegeEnd.value = this.today;
        tournamentStart.value = this.today;
        tournamentEnd.value = this.today;
    }

    initEventListeners() {
        // Connect Apply buttons to report loading methods
        document.getElementById('collegeApplyBtn').addEventListener('click', () => this.loadCollegeReport());
        document.getElementById('tournamentApplyBtn').addEventListener('click', () => this.loadTournamentReport());

        // Add event listeners to prevent end date being before start date
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
                startDate: startDate,
                endDate: endDate
            });

            const response = await fetch(`/api/reports/college-signups?${params}`);
            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();

            this.populateTable({
                bodyId: 'collegeReportBody',
                data: this.sortData(data, this.collegeSort, {
                    date: 'DateAdded',
                    name: 'collegeName',
                    country: 'country',
                    teams: 'teamCount',
                    members: 'memberCount',
                    moderator: 'hasModerator',
                    page: 'HasPage'
                }),
                columns: row => [
                    new Date(row.DateAdded).toLocaleDateString(),
                    row.collegeName,
                    row.country.includes(',') ? row.country.split(',')[1].trim() : row.country,
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
                startDate: startDate,
                endDate: endDate
            });

            const response = await fetch(`/api/reports/tournament-status?${params}`);
            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();

            this.populateTable({
                bodyId: 'tournamentReportBody',
                data: this.sortData(data, this.tournamentSort, {
                    date: 'NextRoundDate',
                    name: 'collegeName',
                    country: 'country',
                    planned: 'plannedMatches',
                    completed: 'completedMatches',
                    eliminations: 'EliminationsComplete'
                }),
                columns: row => [
                    new Date(row.NextRoundDate).toLocaleDateString(),
                    row.collegeName || 'N/A',
                    (row.country && row.country.includes(',')) ? row.country.split(',')[1].trim() : (row.country || 'N/A'),
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

    showLoader(tableId) {
        const tbody = document.getElementById(tableId);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></td></tr>`;
    }

    populateTable({ bodyId, data, columns, totals }) {
        const tbody = document.getElementById(bodyId);
        tbody.innerHTML = '';

        if (data.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `<td colspan="7" class="text-center">No data found for selected date range</td>`;
            tbody.appendChild(emptyRow);
        } else {
            data.forEach(row => {
                const tr = document.createElement('tr');
                const columnValues = columns(row);
                tr.innerHTML = columnValues.map(col => `<td>${col}</td>`).join('');
                tbody.appendChild(tr);
            });
        }

        // Update totals
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
        return value ?
            `<span class="badge bg-success">Yes</span>` :
            `<span class="badge bg-danger">No</span>`;
    }

    sortData(data, config, columnMap) {
        return [...data].sort((a, b) => {
            const key = columnMap[config.column];
            const valA = a[key];
            const valB = b[key];
            const modifier = config.direction === 'asc' ? 1 : -1;

            if (typeof valA === 'string' && typeof valB === 'string') {
                return valA.localeCompare(valB) * modifier;
            }

            return (valA - valB) * modifier;
        });
    }

    initSorting() {
        document.querySelectorAll('th.sortable').forEach(header => {
            header.addEventListener('click', (e) => {
                const tableId = e.target.closest('table').querySelector('tbody').id;
                const column = e.target.dataset.sort;

                if (tableId === 'collegeReportBody') {
                    this.collegeSort.direction = this.collegeSort.column === column
                        ? (this.collegeSort.direction === 'asc' ? 'desc' : 'asc')
                        : 'asc';
                    this.collegeSort.column = column;
                    this.loadCollegeReport();
                } else {
                    this.tournamentSort.direction = this.tournamentSort.column === column
                        ? (this.tournamentSort.direction === 'asc' ? 'desc' : 'asc')
                        : 'asc';
                    this.tournamentSort.column = column;
                    this.loadTournamentReport();
                }

                // Update sorting indicators
                e.target.closest('thead').querySelectorAll('th.sortable')
                    .forEach(h => h.classList.remove('asc', 'desc'));

                e.target.classList.add(this.collegeSort.direction);
            });
        });
    }

    loadReports() {
        this.loadCollegeReport();
        this.loadTournamentReport();
    }

    showError(message) {
        const toast = document.createElement('div');
        toast.className = 'toast align-items-center text-white bg-danger border-0';
        toast.innerHTML = `
          <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
          </div>
        `;

        document.querySelector('.toast-container').appendChild(toast);
        new bootstrap.Toast(toast, { autohide: true, delay: 5000 }).show();
        setTimeout(() => toast.remove(), 5000);
    }
}

// Initialize when DOM loaded
document.addEventListener('DOMContentLoaded', () => {
    window.reportManager = new ReportManager();
});  