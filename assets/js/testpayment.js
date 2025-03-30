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
    const stripe = Stripe(process.env.STRIPE_PUBLISHABLE_KEY);
    const elements = stripe.elements();
    const cardElement = elements.create('card');

    cardElement.mount('#card-element');

    document.getElementById('submit-payment').addEventListener('click', async () => {
        const { clientSecret } = await fetch('/create-payment-intent', {
            method: 'POST'
        }).then(res => res.json());

        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: elements.getElement(CardElement)
            }
        });

        if (error) {
            document.getElementById('payment-message').textContent = error.message;
        } else {
            const result = await fetch('/confirm-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentIntentId: paymentIntent.id })
            });

            if (result.ok) window.location.href = '/payment-success';
        }
    });
}