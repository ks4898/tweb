document.addEventListener('DOMContentLoaded', function () {
    const stripe = Stripe('YOUR_STRIPE_PUBLISHABLE_KEY'); // replace with your actual publishable key !
    const elements = stripe.elements();
    const cardElement = elements.create('card');
    cardElement.mount('#card-element');

    const form = document.getElementById('payment-form');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const { error, paymentMethod } = await stripe.createPaymentMethod({
            type: 'card',
            card: cardElement,
        });

        if (error) {
            console.error(error);
            document.getElementById('card-errors').textContent = error.message;
            return;
        }

        // Create PaymentIntent on the server
        const response = await fetch('/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        const { clientSecret } = await response.json();

        // Confirm the payment on the client
        const result = await stripe.confirmCardPayment(clientSecret, {
            payment_method: paymentMethod.id
        });

        if (result.error) {
            console.error(result.error);
            document.getElementById('card-errors').textContent = result.error.message;
        } else {
            // Payment succeeded, confirm on the server
            const confirmResponse = await fetch('/confirm-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentIntentId: result.paymentIntent.id })
            });
            const confirmResult = await confirmResponse.json();
            if (confirmResult.success) {
                alert('Payment successful!');
                // Redirect or update UI as needed
            } else {
                alert('Payment failed: ' + confirmResult.error);
            }
        }
    });
});  