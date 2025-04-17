document.addEventListener("DOMContentLoaded", function () {
    // Create a style element to add transitions for smoother tab highlighting
    const style = document.createElement('style');
    style.textContent = '.nav-link { transition: all 0.2s ease; }';
    document.head.appendChild(style);
  
    // Store the current path to avoid unnecessary re-highlighting
    const currentPath = window.location.pathname;
  
    // Pre-highlight the colleges tab for details page before any other processing
    if (currentPath === '/details' || currentPath === '/details.html' || currentPath.includes('details')) {
      const links = document.querySelectorAll('.navbar-links a');
      for (let link of links) {
        if (link.textContent.trim() === 'Colleges') {
          link.classList.add('active');
          break;
        }
      }
    }
    
    // Pre-highlight the teams tab for team page before any other processing
    if (currentPath === '/team' || currentPath === '/team.html' || currentPath.includes('team')) {
      const links = document.querySelectorAll('.navbar-links a');
      for (let link of links) {
        if (link.textContent.trim() === 'Teams') {
          link.classList.add('active');
          break;
        }
      }
    }
  
    function updateNavigation(loggedIn, role) {
      const navbar = document.getElementsByClassName("navbar-links")[0];
      console.log("Current path:", currentPath);
      
      // Get all navigation links
      const navLinks = navbar.getElementsByClassName("nav-link");
      
      // Only update tab highlighting if it hasn't been pre-set for details or team page
      if (!(currentPath === '/details' || currentPath === '/details.html' || currentPath.includes('details') || 
            currentPath === '/team' || currentPath === '/team.html' || currentPath.includes('team'))) {
        
        // Remove active class from all links first
        for (let link of navLinks) {
          link.classList.remove("active");
        }
  
        // Find links by text content for specific paths
        if (currentPath === '/colleges' || currentPath.startsWith('/colleges/')) {
          const links = document.querySelectorAll('.navbar-links a');
          for (let link of links) {
            if (link.textContent.trim() === 'Colleges') {
              link.classList.add('active');
              console.log("Found colleges link by text content");
              break;
            }
          }
        }
        else if (currentPath === '/teams' || currentPath.startsWith('/teams/')) {
          const links = document.querySelectorAll('.navbar-links a');
          for (let link of links) {
            if (link.textContent.trim() === 'Teams') {
              link.classList.add('active');
              console.log("Found teams link by text content");
              break;
            }
          }
        }
        else {
          // For other pages, try to match by href first, then by text
          const pathSegments = currentPath.split('/').filter(Boolean);
          const mainSection = pathSegments.length > 0 ? pathSegments[0] : '';
          
          let found = false;
          
          // First try by href
          for (let link of navLinks) {
            const href = link.getAttribute("href");
            if (href && (href === `/${mainSection}` || href === mainSection)) {
              link.classList.add("active");
              found = true;
              break;
            }
          }
          
          // If not found by href, try by text content
          if (!found && mainSection) {
            const sectionName = mainSection.charAt(0).toUpperCase() + mainSection.slice(1);
            for (let link of navLinks) {
              if (link.textContent.trim() === sectionName) {
                link.classList.add("active");
                break;
              }
            }
          }
        }
      }
  
      // Handle login/logout links
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
    }
  
    removeDuplicateNavLinks();
  
    // Initial update
    fetch('/check-session')
      .then(response => response.json())
      .then(data => {
        updateNavigation(data.loggedIn, data.role);
      })
      .catch(error => {
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