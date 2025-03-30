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

// Initialize Stripe FIRST
const stripe = Stripe('pk_test_51R8PKGQ563EKpadRONF5n8pWipbZcJH8OoH3HC0pF1I9GRFoUUhybDBZOGDLS6nnS2zBiRBYMvbOVotS9jR6mq9v00kZgS46TL');
const elements = stripe.elements();

// Create card element with constrained styling
const card = elements.create('card', {
    style: {
        base: {
            fontSize: '16px',
            color: '#32325d',
            '::placeholder': { color: '#aab7c4' }
        }
    },
    classes: { base: 'md-3' } // Match your existing column width
});

// Mount to container
card.mount('#card-element');

function clearError() {
    document.getElementById('payment-message').textContent = '';
}

async function initStripePayment() {
    try {
        document.getElementById('submit-payment').addEventListener('click', async () => {
            try {
                // Get client secret PROPERLY
                const response = await fetch('/create-payment-intent', {
                    method: 'POST'
                });

                if (!response.ok) {
                    throw new Error('Failed to create payment intent');
                }

                const { clientSecret } = await response.json();

                // Verify clientSecret exists
                if (!clientSecret) {
                    throw new Error('Invalid payment intent');
                }

                const { error } = await stripe.confirmCardPayment(clientSecret, {
                    payment_method: {
                        card: elements.getElement(CardElement)
                    }
                });

                if (error) throw error;

                window.location.href = '/payment-success';

            } catch (error) {
                console.error('Payment Error:', error);
                document.getElementById('payment-message').textContent = error.message;
            }
        });

    } catch (error) {
        document.getElementById('payment-message').textContent = error.message;
    }
}

// Keep existing user verification logic
// Add to existing code:
document.getElementById('card-element').style.padding = '10px';
document.getElementById('submit-payment').classList.add('mx-auto', 'd-block', 'mt-3');