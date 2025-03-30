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

async function initStripePayment() {
    try {
        // 1. Initialize Stripe
        const stripe = Stripe('pk_test_51R8PKGQ563EKpadRONF5n8pWipbZcJH8OoH3HC0pF1I9GRFoUUhybDBZOGDLS6nnS2zBiRBYMvbOVotS9jR6mq9v00kZgS46TL'); // Replace with actual key
        const elements = stripe.elements();

        // 2. Mount card element
        const card = elements.create('card');
        card.mount('#card-element');

        // 3. Payment handler
        document.getElementById('submit-payment').addEventListener('click', async () => {
            // Create payment intent
            const { clientSecret } = await fetch('/create-payment-intent', {
                method: 'POST'
            }).then(res => res.json());

            // Confirm payment
            const { error } = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: elements.getElement(CardElement)
                }
            });

            if (error) {
                document.getElementById('payment-message').textContent = error.message;
            } else {
                // Update payment status
                await fetch('/confirm-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ paymentIntentId })
                });
                window.location.href = '/payment-success';
            }
        });
    } catch (error) {
        console.error('Payment initialization failed:', error);
        document.getElementById('payment-message').textContent = 'Payment system error';
    }
}