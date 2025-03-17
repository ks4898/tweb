document.addEventListener('DOMContentLoaded', function() {
    fetchTournaments();
    setupEventListeners();
  });
  
  async function fetchTournaments() {
    try {
      const response = await fetch('/tournaments');
      if (!response.ok) {
        throw new Error('Failed to fetch tournaments');
      }
      const tournaments = await response.json();
      renderTournaments(tournaments);
    } catch (error) {
      console.error('Error fetching tournaments:', error);
      alert('Failed to fetch tournaments. Please try again later.');
    }
  }
  
  function renderTournaments(tournaments) {
    const tournamentsContainer = document.getElementById('tournaments-container');
    tournamentsContainer.innerHTML = '';
    tournaments.forEach(tournament => {
      const tournamentElement = document.createElement('div');
      tournamentElement.className = 'tournament';
      tournamentElement.innerHTML = `
        <h3>${tournament.Name}</h3>
        <p>Start Date: ${new Date(tournament.StartDate).toLocaleDateString()}</p>
        <p>End Date: ${new Date(tournament.EndDate).toLocaleDateString()}</p>
        <p>Location: ${tournament.Location}</p>
        <button onclick="signUpForTournament(${tournament.TournamentID})">Sign Up</button>
      `;
      tournamentsContainer.appendChild(tournamentElement);
    });
  }
  
  async function signUpForTournament(tournamentId) {
    try {
      const response = await fetch('/tournament-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tournamentId }),
      });
  
      const result = await response.json();
      if (result.success) {
        alert(result.message);
        processPayment(tournamentId);
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('Error signing up for tournament:', error);
      alert('Failed to sign up for the tournament. Please try again.');
    }
  }
  
  async function processPayment(tournamentId) {
    const stripe = Stripe('YOUR_STRIPE_PUBLISHABLE_KEY'); // Replace with your actual publishable key
    const { token, error } = await stripe.createToken(card);
  
    if (error) {
      console.error(error);
      alert('Payment failed: ' + error.message);
    } else {
      try {
        const response = await fetch('/process-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: token.id }),
        });
  
        const result = await response.json();
        if (result.success) {
          alert(result.message);
        } else {
          alert('Payment failed: ' + result.message);
        }
      } catch (error) {
        console.error('Error processing payment:', error);
        alert('Failed to process payment. Please try again.');
      }
    }
  }
  
  function setupEventListeners() {
    // Add any additional event listeners here
  }  