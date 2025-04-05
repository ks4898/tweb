document.addEventListener("DOMContentLoaded", function () {

    function updateNavigation(loggedIn, role) {
        const navbar = document.getElementsByClassName("navbar-links")[0];
        const currentPage = window.location.pathname.split("/").pop().replace(".html", "");

        // remove existing Management, Log Out, and Account links
        const managementLink = navbar.querySelector('a[href="account.html"]') || navbar.querySelector('a[href="/account"]');
        const logOutLink = navbar.querySelector('#logoutButton');
        const accountLink = navbar.querySelector('a[href="/signup"]') || navbar.querySelector('a[href="signup.html"]');
        if (managementLink) managementLink.remove();
        if (logOutLink) logOutLink.remove();
        if (accountLink) accountLink.remove();

        if (loggedIn) {
            if (role === "Admin" || role === "SuperAdmin") {
                const managementLink = document.createElement("a");
                managementLink.setAttribute("class", "nav-link");
                managementLink.innerHTML = "Management";
                managementLink.setAttribute("href", "account.html");
                navbar.appendChild(managementLink);
            }

            // add Log Out link last for all logged-in users
            const logOutLink = document.createElement("a");
            logOutLink.setAttribute("class", "nav-link");
            logOutLink.setAttribute("href", "/logout");
            logOutLink.setAttribute("id", "logoutButton");
            logOutLink.innerHTML = "Log Out";
            navbar.appendChild(logOutLink);
        } else {
            const accountLink = document.createElement("a");
            accountLink.setAttribute("class", "nav-link");
            accountLink.setAttribute("href", "/signup");
            accountLink.classList.add("account-style");
            accountLink.innerHTML = "Account";
            navbar.appendChild(accountLink);
        }

        removeDuplicateNavLinks();

        const navLinks = navbar.getElementsByClassName("nav-link");
        for (let link of navLinks) {
            const href = link.getAttribute("href").replace(".html", "");
            if (href === currentPage || href === `/${currentPage}`) {
                link.classList.add("active");
            }
        }
    }

    fetch('/check-session')
        .then(response => response.json())
        .then(data => {
            updateNavigation(data.loggedIn, data.role);
        })
        .catch(error => {
            //console.error("Error checking session:", error);
            updateNavigation(false, null);
        });

    // remove existing listener and add the new one
    document.removeEventListener("click", logoutHandler);
    document.addEventListener("click", logoutHandler);
});

async function logoutHandler(event) {
    if (event.target && event.target.id === "logoutButton") {
      event.preventDefault();
      try {
        const response = await fetch("/logout");
        if (response.redirected) {
          window.location.href = response.url;
        } else if (!response.ok) {
          throw new Error("Logout request failed");
        }
      } catch (error) {
        console.error("Error logging out:", error);
      }
    }
  }
  

async function removeDuplicateNavLinks() {
    const navLinks = document.getElementsByClassName('nav-link');
    const linkTexts = {};
    for (let i = 0; i < navLinks.length; i++) {
        const link = navLinks[i];
        const text = link.textContent.trim();
        if (linkTexts[text]) {
            link.parentNode.removeChild(link);
            i--; // adjust index after removal
        } else {
            linkTexts[text] = true;
        }
    }
}