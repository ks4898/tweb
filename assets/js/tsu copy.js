document.addEventListener("DOMContentLoaded", function () {
    // Initialize data loading
    initializePage();

    // Handle team selection change
    document.getElementById("team-select").addEventListener('change', function () {
        const teamCreateContainer = document.getElementById("team-create-container");

        // If team-create-container doesn't exist, create it
        if (!teamCreateContainer) {
            const container = document.createElement("div");
            container.id = "team-create-container";
            container.className = "mb-3";
            container.style.display = "none";

            container.innerHTML = `
          <label for="team-create" class="tsu-label">New Team Name</label>
          <input type="text" class="form-control" id="team-create" placeholder="Enter your new team name..." required>
        `;

            // Insert after team dropdown
            this.parentNode.after(container);
        }

        // Get the container (whether it existed or was just created)
        const newContainer = document.getElementById("team-create-container");
        const newTeamInput = document.getElementById("team-create");

        if (this.value === "new-team") {
            // Show the team creation field
            newContainer.style.display = "block";
            if (newTeamInput) {
                newTeamInput.setAttribute("required", "required");
            }
        } else {
            // Hide the team creation field
            newContainer.style.display = "none";
            if (newTeamInput) {
                newTeamInput.removeAttribute("required");
                newTeamInput.value = ""; // Clear the input
            }
        }
    });

    // Handle form submission
    document.querySelector("form").addEventListener("submit", function (e) {
        e.preventDefault();

        const collegeId = document.getElementById("college-select").value;
        const tournamentId = document.getElementById("tournament-select").value;
        const teamSelection = document.getElementById("team-select").value;
        const message = document.getElementById("message").value;

        if (!collegeId) {
            alert("Please select a college.");
            return;
        }

        if (!tournamentId) {
            alert("Please select a tournament.");
            return;
        }

        if (!teamSelection) {
            alert("Please select a team or create a new one.");
            return;
        }

        let newTeamName = null;
        if (teamSelection === "new-team") {
            newTeamName = document.getElementById("team-create").value.trim();
            if (!newTeamName) {
                alert("Please enter a valid team name.");
                return;
            }
        }

        // Prepare data for submission
        const formData = {
            collegeId: collegeId,
            tournamentId: tournamentId,
            teamId: teamSelection !== "new-team" ? teamSelection : null,
            newTeamName: newTeamName,
            message: message
        };

        // Submit registration
        submitRegistration(formData);
    });
});

// Function to initialize the page and load all required data
async function initializePage() {
    try {
        // Load user data
        const userData = await fetchJSON('/user-info-tournament');

        // Populate user data
        document.getElementById("user-name").value = userData.Name || "";

        // Load colleges and tournaments in parallel
        const [colleges, tournaments] = await Promise.all([
            fetchJSON('/universities'),
            fetchJSON('/tournaments')
        ]);

        // Populate college dropdown
        populateCollegeDropdown(colleges);

        // Populate tournament dropdown
        populateTournamentDropdown(tournaments);

    } catch (error) {
        // If there's an error, it's likely due to authentication issues
        // The server-side redirect should handle this, but as a fallback:
        console.error("Error initializing page:", error);
        /*window.location.href = '/login?redirect=/tournament-register';*/
    }
}

// Function to fetch JSON data with error handling
async function fetchJSON(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return response.json();
}

// Function to populate college dropdown
function populateCollegeDropdown(colleges) {
    const collegeSelect = document.getElementById("college-select");

    colleges.forEach(college => {
        const option = document.createElement("option");
        option.value = college.UniversityID;
        option.textContent = college.Name;
        collegeSelect.appendChild(option);
    });

    // Add event listener for college selection
    collegeSelect.addEventListener('change', function () {
        loadTeamsForCollege(this.value);
    });
}

// Function to populate tournament dropdown
function populateTournamentDropdown(tournaments) {
    const tournamentSelect = document.getElementById("tournament-select");

    tournaments.forEach(tournament => {
        const option = document.createElement("option");
        option.value = tournament.TournamentID;
        option.textContent = tournament.Name;
        tournamentSelect.appendChild(option);
    });
}

// Function to load teams for selected college
async function loadTeamsForCollege(collegeId) {
    if (!collegeId) return;

    try {
        // Clear previous options
        const teamSelect = document.getElementById("team-select");
        teamSelect.innerHTML = '';

        // Add default option
        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "Select your team";
        defaultOption.disabled = true;
        defaultOption.selected = true;
        teamSelect.appendChild(defaultOption);

        // Add create new team option
        const createOption = document.createElement("option");
        createOption.value = "new-team";
        createOption.textContent = "Create a new team";
        teamSelect.appendChild(createOption);

        // Hide the team creation field when college changes
        const teamCreateContainer = document.getElementById("team-create-container");
        if (teamCreateContainer) {
            teamCreateContainer.style.display = "none";
        }

        // Fetch teams from selected college
        const teams = await fetchJSON(`/teams-for-college-tournament?collegeId=${collegeId}`);

        // Add teams to dropdown
        teams.forEach(team => {
            const option = document.createElement("option");
            option.value = team.TeamID;
            option.textContent = team.Name;
            teamSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading teams:", error);
    }
}

// Function to submit registration
async function submitRegistration(formData) {
    try {
      const response = await fetch('/tournament-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        if (data.pendingVerification) {
          // Show the modal instead of alert
          const pendingModal = new bootstrap.Modal(document.getElementById('pendingVerificationModal'));
          pendingModal.show();
          
          // Add event listener for the OK button
          document.getElementById('pendingVerificationOkBtn').addEventListener('click', function() {
            pendingModal.hide();
            window.location.href = '/';
          });
          
          // Also redirect when the modal is hidden (e.g., if user clicks outside or the X button)
          document.getElementById('pendingVerificationModal').addEventListener('hidden.bs.modal', function() {
            window.location.href = '/';
          });
        } else {
          // Redirect to payment page with registration ID
          window.location.href = `/payment?registrationId=${data.registrationId}`;
        }
      } else {
        alert(data.message || "Registration failed. Please try again.");
      }
    } catch (error) {
      console.error("Error submitting registration:", error);
      alert("Error submitting registration. Please try again later.");
    }
  }
  