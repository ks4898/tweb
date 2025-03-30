document.addEventListener('DOMContentLoaded', async function () {
    let user_id, user_name, user_role;

    fetch('/user-info')
        .then(response => response.json())
        .then(data => {
            user_id = data.userId;
            user_name = data.name;
            user_role = data.role;

            document.getElementsByClassName("explain")[0].innerHTML = `Hello, ${user_name}. Welcome to the Aardvark Games tournament payment page! The payment amount for participation is $10 USD per player.`;

            if (user_role !== "Player") {
                window.location.href = "/";
                throw new Error("User is not a player");
            }

            return fetch(`/player/${user_id}`);
        })
        .then(response => response.json())
        .then(data => {
            if (data.PayedFee === true || data.PayedFee === 1) {
                window.location.href = "/";
            } else {
                // initialize Stripe and set up payment form
                initStripePayment();
            }
        })
        .catch(error => {
            if (error.message !== "User is not a player") {
                console.error('Error:', error);
                throw new Error("Unable to initialize payment, please try again.");
            }
        });
});

function initStripePayment() {
    const stripe = Stripe('pk_test_TYooMQauvdEDq54NiTphI7jx'); // replace with your actual publishable key !
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

        // create PaymentIntent on the server
        const response = await fetch('/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        const { clientSecret } = await response.json();

        // confirm the payment on the client
        const result = await stripe.confirmCardPayment(clientSecret, {
            payment_method: paymentMethod.id
        });

        if (result.error) {
            console.error(result.error);
            document.getElementById('card-errors').textContent = result.error.message;
        } else {
            // payment succeeded, confirm on the server
            const confirmResponse = await fetch('/confirm-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentIntentId: result.paymentIntent.id })
            });
            const confirmResult = await confirmResponse.json();
            if (confirmResult.success) {
                window.location.href = "/payment-success";
            } else {
                alert('Payment failed: ' + confirmResult.error);
                window.location.href = "/";
            }
        }
    });
}