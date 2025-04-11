// Placeholder data for tickets
const tickets = [
    {
        id: '#001',
        type: 'User',
        name: 'John Doe',
        subject: 'Login Issue',
        date: '2025-04-01',
        status: 'Open',
        description: 'New User has been created with unassigned college. Pending approval.',
    },
    {
        id: '#002',
        type: 'System',
        name: 'Tournament',
        subject: 'New Tournament Created',
        date: '2025-04-05',
        status: 'Closed',
        description: 'A New Tournament has been created. Pending approval.',
    },
    {
        id: '#003',
        type: 'College',
        name: 'Oxford University',
        subject: 'Updated Image',
        date: '2025-04-07',
        status: 'Pending',
        description: 'College Image has been updated. Pending Approval.',
    }
];

// Global state to store the sorting and filtering options
let currentSort = "desc"; // This will be defaulted based on the user's selection.
let currentFilterType = "";
let currentFilterStatus = "";

// Function to populate the table with ticket data
function populateTicketTable() {
    const tbody = document.querySelector('.custom-table tbody');
    tbody.innerHTML = ''; // Clear existing rows

    // Apply sorting and filtering based on global state
    let filteredTickets = tickets.filter(ticket => {
        return (currentFilterType === "" || ticket.type === currentFilterType) &&
               (currentFilterStatus === "" || ticket.status === currentFilterStatus);
    });

    filteredTickets = filteredTickets.sort((a, b) => {
        if (currentSort === "asc") {
            return new Date(a.date) - new Date(b.date);
        } else {
            return new Date(b.date) - new Date(a.date);
        }
    });

    filteredTickets.forEach(ticket => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${ticket.id}</td>
            <td>${ticket.type}</td>
            <td>${ticket.name}</td>
            <td>${ticket.subject}</td>
            <td>${ticket.date}</td>
            <td><span class="status-badge ${ticket.status.toLowerCase()}">${ticket.status}</span></td>
        `;

        // Add click event to open modal on row click
        row.addEventListener('click', () => openTicketModal(ticket));
        tbody.appendChild(row);
    });
}

// Function to open the modal with ticket details
function openTicketModal(ticket) {
    // Populate the modal with the selected ticket's details
    const modalTitle = document.querySelector('#ticketModalLabel');
    const modalBody = document.querySelector('.modal-body');
    const modalFooter = document.querySelector('.modal-footer');

    // If the ticket is Pending, change its status to Open
    if (ticket.status === 'Pending') {
        ticket.status = 'Open'; // Change the status to Open
    }

    modalTitle.textContent = `Report: ${ticket.subject}`;
    modalBody.innerHTML = `
        <span class="status-badge ${ticket.status.toLowerCase()}">${ticket.status}</span></p>
        <p><strong>Date Created:</strong> ${ticket.date}</p>
        <p><strong>Reported By:</strong> ${ticket.type} - ${ticket.name}</p>
        <p><strong>Subject:</strong> ${ticket.subject}</p>
        <p><strong>Description:</strong></p>
        <p>${ticket.description}</p>
    `;

    // Clear previous buttons and add Close Report button if necessary
    modalFooter.innerHTML = ''; // Clear footer

    if (ticket.status !== 'Closed') {
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close Report';
        closeButton.classList.add('btn', 'btn-primary');
        closeButton.addEventListener('click', () => closeTicket(ticket));
        modalFooter.appendChild(closeButton);
    }

    const placeholderButton = document.createElement('button');
    placeholderButton.textContent = 'Placeholder Button';
    placeholderButton.classList.add('btn', 'btn-secondary');
    modalFooter.appendChild(placeholderButton);

    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('ticketModal'));
    modal.show();

    // Refresh the table after updating status
    populateTicketTable();
}

// Function to close the report (just a placeholder for now)
function closeTicket(ticket) {
    // Update ticket status to 'Closed'
    ticket.status = 'Closed';
    populateTicketTable(); // Refresh table to reflect the status change
    const modal = bootstrap.Modal.getInstance(document.getElementById('ticketModal'));
    modal.hide(); // Close the modal after closing the report
}

// Function to handle sort and filter changes
function handleSortChange(event) {
    currentSort = event.target.value;
    populateTicketTable();
}

function handleFilterChange(event) {
    if (event.target.id === 'filterType') {
        currentFilterType = event.target.value;
    } else if (event.target.id === 'filterStatus') {
        currentFilterStatus = event.target.value;
    }
    populateTicketTable();
}

// Add event listeners for sort and filter changes
document.getElementById('sortDate').addEventListener('change', handleSortChange);
document.getElementById('filterType').addEventListener('change', handleFilterChange);
document.getElementById('filterStatus').addEventListener('change', handleFilterChange);

// Initialize the table with data
populateTicketTable();
