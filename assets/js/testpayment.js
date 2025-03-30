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

function clearError() {
    document.getElementById('payment-message').textContent = '';
}

function initStripePayment() {
    clearError();
    try {
        // Initialize Stripe
        const stripe = Stripe('pk_test_51R8PKGQ563EKpadRONF5n8pWipbZcJH8OoH3HC0pF1I9GRFoUUhybDBZOGDLS6nnS2zBiRBYMvbOVotS9jR6mq9v00kZgS46TL');
        const elements = stripe.elements();
        
        // Card element with constrained styling
        const cardElement = elements.create('card', {
            style: {
                base: {
                    fontSize: '16px',
                    color: '#32325d',
                    '::placeholder': { color: '#aab7c4' }
                }
            },
            classes: { base: 'md-3' } // Match your existing column width
        });
        cardElement.mount('#card-element');

        // Payment handler
        document.getElementById('submit-payment').addEventListener('click', async () => {
            try {
                const response = await fetch('/create-payment-intent', { method: 'POST' });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Payment failed');
                }

                const { clientSecret } = await response.json();
                
                if (!clientSecret) {
                    throw new Error('Invalid payment configuration');
                }

                const { error } = await stripe.confirmCardPayment(clientSecret, {
                    payment_method: { card: cardElement }
                });

                if (error) throw error;
                
                const confirmResponse = await fetch('/confirm-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ paymentIntentId: paymentIntent.id })
                });
                
                if (confirmResponse.ok) {
                    window.location.href = '/payment-success';
                }

            } catch (error) {
                document.getElementById('payment-message').textContent = error.message;
            }
        });

    } catch (error) {
        document.getElementById('payment-message').textContent = 'Payment system initialization failed';
    }
}

// Keep existing user verification logic
// Add to existing code:
document.getElementById('card-element').style.padding = '10px';
document.getElementById('submit-payment').classList.add('mx-auto', 'd-block', 'mt-3');