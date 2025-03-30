document.getElementById('submit-payment').addEventListener('click', async () => {
    const { paymentMethod, error } = await stripe.createPaymentMethod({
        type: 'card',
        card: elements.getElement(CardElement),
    });

    if (error) {
        displayError(error.message);
    } else {
        const response = await fetch('/confirm-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentMethodId: paymentMethod.id })
        });

        const result = await response.json();
        if (result.success) {
            window.location.href = '/payment-success'; // Redirect immediately
        }
    }
});  