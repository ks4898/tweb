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
    const teamId = getCurrentTeamId(); // Implement this function to get the current user's team ID
    if (!teamId) {
      alert('You must be part of a team to sign up for a tournament.');
      return;
    }
  
    try {
      const response = await fetch('/tournament-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tournamentId, teamId }),
      });
  
      if (!response.ok) {
        throw new Error('Failed to sign up for tournament');
      }
  
      const result = await response.json();
      if (result.success) {
        alert('Successfully signed up for the tournament! Proceeding to payment.');
        window.location.href = `/payment.html?tournamentId=${tournamentId}&teamId=${teamId}`;
      } else {
        alert('Failed to sign up for the tournament: ' + result.message);
      }
    } catch (error) {
      console.error('Error signing up for tournament:', error);
      alert('Failed to sign up for the tournament');
    }
  }
  
  function setupEventListeners() {
    // Add any additional event listeners here
  }
  
  function getCurrentTeamId() {
    // Implement this function to return the current user's team ID
    // You might get this from a session or local storage
  }
  