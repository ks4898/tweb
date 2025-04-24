document.addEventListener("DOMContentLoaded", function() {
    let currentPaymentId = null;
    const paymentsTableBody = document.getElementById('paymentsTableBody');
    const viewModal = new bootstrap.Modal(document.getElementById('paymentsModal'));

    // Initial load
    fetchPayments();

    // Event listeners
    document.getElementById('searchPaymentBtn').addEventListener('click', searchPayments);
    document.getElementById('viewPaymentBtn').addEventListener('click', viewPayment);

    // Table row selection handler
    paymentsTableBody.addEventListener('click', function(e) {
        const row = e.target.closest('tr');
        if (!row) return;
        
        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        row.classList.add('selected');
        currentPaymentId = row.dataset.paymentId;
    });

    async function fetchPayments(searchTerm = '') {
        try {
            const url = `/api/payments${searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : ''}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            
            const payments = await response.json();
            renderPayments(payments);
        } catch (error) {
            console.error('Error fetching payments:', error);
            alert('Failed to load payments');
        }
    }

    function renderPayments(payments) {
        paymentsTableBody.innerHTML = payments.map(payment => `
            <tr data-payment-id="${payment.PaymentID}">
                <td>${payment.PaymentID}</td>
                <td>${payment.UserID} (${payment.UserName || 'Unknown'})</td>
                <td>${payment.TournamentID || 'N/A'}</td>
                <td>$${parseFloat(payment.Amount).toFixed(2)}</td>
                <td>${renderStatusBadge(payment.Status)}</td>
                <td>${payment.SuccessPageViewed ? 'Yes' : 'No'}</td>
                <td>${new Date(payment.PaymentDate).toLocaleString()}</td>
            </tr>
        `).join('');
        
        currentPaymentId = null;
    }

    function renderStatusBadge(status) {
        if (status === 'Completed') {
            return '<span class="badge bg-success">Completed</span>';
        } else if (status === 'Pending') {
            return '<span class="badge bg-warning text-dark">Pending</span>';
        } else {
            return `<span class="badge bg-secondary">${status}</span>`;
        }
    }

    function searchPayments() {
        const searchTerm = document.getElementById('searchPayment').value.trim();
        fetchPayments(searchTerm);
    }

    async function viewPayment() {
        if (!currentPaymentId) {
            alert('Please select a payment first');
            return;
        }

        try {
            const response = await fetch(`/api/payments/${currentPaymentId}`);
            if (!response.ok) throw new Error('Failed to fetch payment details');
            
            const payment = await response.json();
            
            // Populate modal fields
            document.getElementById('viewPaymentID').value = payment.PaymentID;
            document.getElementById('viewPaymentUserID').value = payment.UserID;
            document.getElementById('viewPaymentTournamentID').value = payment.TournamentID || 'N/A';
            document.getElementById('viewPaymentTeamID').value = payment.TeamID || 'N/A';
            document.getElementById('viewPaymentAmount').value = `$${parseFloat(payment.Amount).toFixed(2)}`;
            document.getElementById('viewPaymentStatus').value = payment.Status;
            document.getElementById('viewPaymentDate').value = new Date(payment.PaymentDate).toLocaleString();

            viewModal.show();
        } catch (error) {
            console.error('Error viewing payment:', error);
            alert('Failed to load payment details');
        }
    }
});