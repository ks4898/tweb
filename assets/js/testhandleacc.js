document.addEventListener("DOMContentLoaded", function() {
  // Immediate synchronous active tab setup
  const navbar = document.querySelector(".navbar-links");
  const currentPath = window.location.pathname;

  // Complete route configuration
  const routeConfig = {
      '/details': 'Colleges',
      '/colleges': 'Colleges',
      '/teams': 'Teams',
      '/brackets': 'Brackets',
      '/schedule': 'Schedule',
      '/schedules': 'Schedule',
      '/about': 'About Us',
      '/account': 'Management',
      '/management': 'Management',
      '/signup': 'Account'
  };

  // Synchronous active tab determination
  function setActiveTab() {
      const allLinks = navbar.querySelectorAll('.nav-link');
      let targetText = routeConfig[currentPath] || '';
      
      // Fallback to path segment matching
      if (!targetText) {
          const pathSegment = currentPath.split('/')[1];
          targetText = routeConfig['/' + pathSegment] || '';
      }

      allLinks.forEach(link => {
          const isActive = link.textContent.trim() === targetText ||
                          link.href === window.location.href;
          link.classList.toggle('active', isActive);
      });
  }

  // Optimized session handling
  function updateNavigation(loggedIn, role) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = navbar.innerHTML;
      
      ['Management', 'Log Out', 'Account'].forEach(text => {
          tempDiv.querySelectorAll('.nav-link').forEach(link => {
              if (link.textContent === text) link.remove();
          });
      });

      if (loggedIn) {
          if (['Admin', 'SuperAdmin', 'CollegeRep'].includes(role)) {
              tempDiv.innerHTML += `<a class="nav-link" href="/account">Management</a>`;
          }
          tempDiv.innerHTML += `<a class="nav-link" id="logoutButton" href="#">Log Out</a>`;
      } else {
          tempDiv.innerHTML += `<a class="nav-link account-style" href="/signup">Account</a>`;
      }

      navbar.innerHTML = tempDiv.innerHTML;
      setActiveTab();
  }

  // Initial setup
  setActiveTab();
  fetch('/check-session')
      .then(res => res.json())
      .then(data => updateNavigation(data.loggedIn, data.role))
      .catch(() => updateNavigation(false, null));

  // Persistent click handlers
  navbar.addEventListener('click', function(e) {
      if (e.target?.id === 'logoutButton') {
          e.preventDefault();
          fetch('/logout').then(() => window.location.reload());
      }
  });
});