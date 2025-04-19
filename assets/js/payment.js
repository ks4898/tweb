document.addEventListener('DOMContentLoaded', async function () {
    let user_id, user_name, user_role;
    let registrationId = new URLSearchParams(window.location.search).get('registrationId');

    if (!registrationId) {
        window.location.href = '/';
        return;
    }

    fetch('/user-info')
        .then(response => response.json())
        .then(data => {
            user_id = data.userId;
            user_name = data.name;
            user_role = data.role;
            document.getElementsByClassName("explain")[0].innerHTML = `Hello, ${user_name}.`;

            if (user_role !== "Player") {
                window.location.href = "/";
                throw new Error("User is not a player");
            }

            return fetch(`/payment-details?registrationId=${registrationId}`);
        })
        .then(response => response.json())
        .then(data => {
            if (data.Status === 'Completed') {
                window.location.href = "/";
                throw new Error("Payment already completed");
            } else {
                // initialize Stripe and set up payment form
                initStripePayment();
            }
        })
        .catch(error => {
            if (error.message !== "User is not a player" && error.message !== "Payment already completed") {
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
        // Fetch the publishable key from the server
        fetch('/stripe-key')
            .then(response => response.json())
            .then(data => {
                const stripe = Stripe(data.publishableKey);
                const elements = stripe.elements();

                // Card element with constrained styling
                const cardElement = elements.create('card', {
                    style: {
                        base: {
                            fontSize: '16px',
                            color: '#32325d',
                            '::placeholder': {
                                color: '#aab7c4'
                            }
                        }
                    }
                });

                cardElement.mount('#card-element');

                // Payment handler
                document.getElementById('submit-payment').addEventListener('click', async () => {
                    try {
                        document.getElementById('payment-message').textContent = "Processing payment...";

                        // Fetch payment intent
                        const response = await fetch('/create-payment-intent', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                registrationId: new URLSearchParams(window.location.search).get('registrationId')
                            })
                        });

                        if (!response.ok) {
                            document.getElementById('payment-message').textContent = 'Payment failed';
                            throw new Error('Failed to create payment intent');
                        }

                        const { clientSecret } = await response.json();

                        // Confirm payment
                        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
                            payment_method: { card: cardElement }
                        });

                        if (error) {
                            document.getElementById('payment-message').textContent = 'Payment failed';
                            throw error;
                        }

                        // Verify payment succeeded
                        if (paymentIntent.status === 'succeeded') {
                            const responseConfirm = await fetch('/confirm-payment', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ paymentIntentId: paymentIntent.id })
                            });

                            const responseData = await responseConfirm.json();

                            if (responseData.success) {
                                window.location.href = `/payment-success?payment_intent=${responseData.paymentIntentId}&registration_id=${responseData.registrationId}`;
                            } else {
                                document.getElementById('payment-message').textContent = 'Payment verification failed';
                            }
                        }
                    } catch (error) {
                        document.getElementById('payment-message').textContent = error.message;
                    }
                });
            })
            .catch(error => {
                document.getElementById('payment-message').textContent = 'Failed to initialize payment system';
                console.error('Error fetching Stripe key:', error);
            });
    } catch (error) {
        document.getElementById('payment-message').textContent = 'Payment system initialization failed';
    }
}

// Add to existing code:
document.getElementById('card-element').style.padding = '10px';
document.getElementById('submit-payment').classList.add('mx-auto', 'd-block', 'mt-3');