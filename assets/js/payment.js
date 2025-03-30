document.addEventListener('DOMContentLoaded', async () => {
    const stripe = Stripe(process.env.STRIPE_PUBLISHABLE_KEY);
    const elements = stripe.elements();
    const card = elements.create('card');
    card.mount('#card-element');
  
    // Initialize payment intent
    const { clientSecret } = await fetch('/create-payment-intent', {
      method: 'POST'
    }).then(res => res.json());
  
    document.getElementById('submit-payment').addEventListener('click', async () => {
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)
        }
      });
  
      if (error) {
        document.getElementById('payment-message').textContent = error.message;
      } else if (paymentIntent.status === 'succeeded') {
        // Confirm payment with backend
        const result = await fetch('/confirm-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentIntentId: paymentIntent.id })
        });
        
        if (result.ok) window.location.href = '/payment-success';
      }
    });
  });
  