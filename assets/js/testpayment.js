document.addEventListener('DOMContentLoaded', function () {
    let user_id, user_name, user_role;

    fetch('/user-info')
        .then(async response => await response.json())
        .then(data => {
            document.getElementsByClassName("explain")[0].innerHTML = ("Hello, " + data.name + ". Welcome to the Aardvark Games tournament payment page! The payment amount for participation is $10 USD per player.");
            user_id = data.userId;
            user_name = data.name;
            user_role = data.role;
            console.log(user_id, user_name, user_role);

            if (user_role !== "Player") {
                console.log(user_role);
                if (user_role === "SuperAdmin") {
                    alert("You are SuperAdmin byebye");
                } else {
                    alert("You are unauthorized");
                }
                window.location.href = "/";
            }

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

        })
        .catch(error => {
            console.error('Error fetching user info:', error);
        });

});