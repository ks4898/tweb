document.addEventListener("DOMContentLoaded", function () {
    // Placeholder values
    const userData = {
        name: "John Doe",
        college: "Sample University"
    };

    const tournaments = [
        "Valorant Spring Cup",
        "League of Legends Clash",
        "CS2 Summer Showdown"
    ];

    // Populate the name and college
    document.getElementById("user-name").value = userData.name;
    document.getElementById("user-college").value = userData.college;

    // Populate tournament options
    const tournamentSelect = document.getElementById("tournament");
    tournaments.forEach(tournament => {
        const option = document.createElement("option");
        option.value = tournament;
        option.textContent = tournament;
        tournamentSelect.appendChild(option);
    });

    // Handle form submission
    document.getElementById("signup-form").addEventListener("submit", function (e) {
        e.preventDefault();

        const selectedTournament = tournamentSelect.value;
        if (!selectedTournament) {
            alert("Please select a tournament before submitting.");
            return;
        }

        console.log("Form submitted!");
        console.log("Name:", userData.name);
        console.log("College:", userData.college);
        console.log("Tournament:", selectedTournament);
        console.log("Message:", document.getElementById("message").value);
    });
});
