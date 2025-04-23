document.addEventListener("DOMContentLoaded", function() {
  // DOM references with structural isolation
  const navbar = document.querySelector(".navbar");
  const logo = document.querySelector(".navbar-logo");
  const linksContainer = document.querySelector(".navbar-links");

  // immediate synchronous active tab assignment
  function setActiveTab() {
      const currentPath = window.location.pathname;
      const routeMap = {
          '/': 'Home',
          '/details': 'Colleges',
          '/colleges': 'Colleges',
          '/teams': 'Teams',
          '/brackets': 'Brackets',
          '/schedule': 'Schedules',
          '/schedules': 'Schedules',
          '/about': 'About Us',
          '/account': 'Management',
          '/management': 'Management',
          '/signup': 'Account',
          '/profile': 'Profile'
      };

      linksContainer.querySelectorAll('.nav-link').forEach(link => {
          const linkPath = new URL(link.href).pathname;
          const isActive = currentPath === linkPath || 
                         currentPath.startsWith(linkPath + '/') ||
                         link.textContent.trim() === routeMap[currentPath];
          link.classList.toggle('active', isActive);
      });
  }

  // atomic session handling
  function updateNavigation(loggedIn, role) {
      const fragment = document.createDocumentFragment();
      
      // preserve static links
      linksContainer.querySelectorAll('.nav-link').forEach(link => {
          if (!['Management', 'Log Out', 'Account'].includes(link.textContent)) {
              fragment.appendChild(link.cloneNode(true));
          }
      });

      // add dynamic links
      if (loggedIn) {
          if (['Admin', 'SuperAdmin', 'CollegeRep'].includes(role)) {
              fragment.appendChild(createLink('/account', 'Management'));
          }
          fragment.appendChild(createLink('/profile', 'Profile'));
      } else {
          fragment.appendChild(createLink('/signup', 'Account', null, 'account-style'));
      }

      // atomic DOM update with layout stabilization
      linksContainer.replaceChildren(fragment);
      setActiveTab();
  }

  function createLink(href, text, id, className) {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = text;
      link.className = `nav-link${className ? ' ' + className : ''}`;
      if (id) link.id = id;
      return link;
  }

  // Synchronous initialization sequence
  setActiveTab(); // Initial active state
  fetch('/check-session')
      .then(res => res.json())
      .then(data => {
          updateNavigation(data.loggedIn, data.role);
      })
      .catch(() => updateNavigation(false, null));
});