document.addEventListener("DOMContentLoaded", function () {
  const searchInput = document.querySelector(".search-bar input");
  const searchButton = document.querySelector(".search-bar button");
  const containerParent = document.getElementById("college-collection");
  const collegesList = document.getElementById("colleges-list");

  if (!searchInput || !searchButton || !collegesList) {
    console.error("Required elements not found!");
    return;
  }

  // Add a loading indicator
  const loadingIndicator = document.createElement("div");
  loadingIndicator.className = "loading-indicator";
  loadingIndicator.textContent = "Loading colleges...";
  containerParent.appendChild(loadingIndicator);

  // No colleges found message - Updated to match loading indicator style
  let noResultsMessage = document.createElement("div");
  noResultsMessage.textContent = "No colleges found matching your search. Please check for any typing errors and try again.";
  noResultsMessage.classList.add("no-results-message");
  noResultsMessage.style.display = "none";
  containerParent.appendChild(noResultsMessage);

  searchButton.addEventListener("click", filterColleges);
  
  // Modified event listener to only hide the no results message when the input changes
  searchInput.addEventListener("input", function() {
    // Only hide the message when the user starts typing
    if (noResultsMessage.classList.contains('visible')) {
      noResultsMessage.classList.remove('visible');
      setTimeout(() => {
        noResultsMessage.style.display = "none";
      }, 400);
    }
  });
  
  searchInput.addEventListener("keyup", debounce(filterColleges, 300));
  console.log("Search event listeners attached.");

  // Fetch and load colleges
  fetchColleges();
});

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function () {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

// Fetch colleges data
function fetchColleges() {
  fetch("/universities")
    .then(response => response.json())
    .then(data => {
      // Preload images first
      preloadImages(data).then(() => {
        // After images are preloaded, prepare the display
        prepareCollegesDisplay(data);
      });
    })
    .catch(error => {
      console.error("Error fetching colleges:", error);
      const loadingIndicator = document.querySelector(".loading-indicator");
      if (loadingIndicator) {
        loadingIndicator.textContent = "Error loading colleges. Please refresh the page.";
      }
    });
}

// Preload all images
function preloadImages(data) {
  const imagePromises = data.map(college => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve(); // Continue even if image fails to load
      img.src = college.Emblem || '/media/img/placeholder-250x250.png';
    });
  });
  return Promise.all(imagePromises);
}

// Prepare colleges display
function prepareCollegesDisplay(data) {
  const container = document.getElementById("colleges-list");
  const fragment = document.createDocumentFragment();

  // Clear any existing content
  container.innerHTML = "";

  // Create all college elements
  data.forEach((college, index) => {
    const collegeElement = createCollegeElement(college, index);
    fragment.appendChild(collegeElement);
  });

  // Add all elements at once
  container.appendChild(fragment);

  // Remove loading indicator
  const loadingIndicator = document.querySelector(".loading-indicator");
  setTimeout(() => {
    if (loadingIndicator) {
      loadingIndicator.remove();
    }
  }, 400);

  // Delay showing the colleges to ensure everything is ready
  setTimeout(() => {
    container.classList.add('loaded');
  }, 200);
}

// Create college element
function createCollegeElement(college, index) {
  let descriptionText = college.Description ||
    `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
    Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
    Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
    Excepteur sint occaecat cupidatat non proident, sunt in culpa...`;

  // Create college container
  const collegeContainer = document.createElement('div');
  collegeContainer.className = 'college-container';
  collegeContainer.classList.add(index % 2 === 0 ? 'odd-style' : 'even-style');

  // Create image
  const img = document.createElement('img');
  img.alt = `${college.Name} Logo`;
  // Set the initial src using the existing logic (attempts the real emblem first)
  img.src = college.Emblem || '/media/img/placeholder-250x250.png';
  // Add error handling
  img.onerror = function () {
    this.src = '/media/img/placeholder-250x250.png';
  };

  // Create info div
  const infoDiv = document.createElement('div');
  infoDiv.className = 'college-info';

  // Create heading
  const heading = document.createElement('h2');
  heading.textContent = college.Name.toUpperCase();

  // Create horizontal rule
  const hr = document.createElement('hr');

  // Create paragraph
  const paragraph = document.createElement('p');
  paragraph.textContent = descriptionText;

  // Create button link
  const link = document.createElement('a');
  link.href = `/details?name=${encodeURIComponent(college.Name)}`; // Assuming a details route
  link.className = 'btn-link';
  link.classList.add(index % 2 === 0 ? 'odd-button' : 'even-button');
  link.textContent = 'View Details';

  // Assemble the elements
  infoDiv.appendChild(heading);
  infoDiv.appendChild(hr);
  infoDiv.appendChild(paragraph);
  infoDiv.appendChild(link);
  collegeContainer.appendChild(img); // Image added first
  collegeContainer.appendChild(infoDiv); // Info div added second

  return collegeContainer;
}

function filterColleges() {
  const searchInput = document.querySelector(".search-bar input");
  const query = searchInput.value.toLowerCase().trim();
  const collegeContainers = document.querySelectorAll(".college-container");
  const noResultsMessage = document.querySelector(".no-results-message");
  const container = document.getElementById("colleges-list");
  const containerParent = document.getElementById("college-collection");

  // If query is empty, fetch all colleges again
  if (query === "") {
    // Hide no results message with proper transition
    noResultsMessage.classList.remove('visible');
    setTimeout(() => {
      noResultsMessage.style.display = "none";
    }, 400);
    
    // Remove loaded class to fade out current content
    container.classList.remove('loaded');

    // Add loading indicator
    let loadingIndicator = document.querySelector(".loading-indicator");
    if (!loadingIndicator) {
      loadingIndicator = document.createElement("div");
      loadingIndicator.className = "loading-indicator";
      containerParent.appendChild(loadingIndicator);
    }
    loadingIndicator.textContent = "Loading all colleges...";
    loadingIndicator.style.display = "block";

    // Instead of extracting from DOM, fetch fresh data
    fetch("/universities")
      .then(response => response.json())
      .then(data => {
        // Use setTimeout to allow the fade-out to complete
        setTimeout(() => {
          // Clear container
          container.innerHTML = "";

          // Preload images first (just like in initial load)
          preloadImages(data).then(() => {
            // Create all college elements
            const fragment = document.createDocumentFragment();

            data.forEach((college, index) => {
              const collegeElement = createCollegeElement(college, index);
              fragment.appendChild(collegeElement);
            });

            // Add all elements at once
            container.appendChild(fragment);

            // Remove loading indicator with a delay
            setTimeout(() => {
              if (loadingIndicator) {
                loadingIndicator.style.display = "none";
              }
            }, 300);

            // Delay showing the colleges to ensure everything is ready
            setTimeout(() => {
              container.classList.add('loaded');
            }, 200);
          });
        }, 300); // Short delay to allow fade-out
      })
      .catch(error => {
        console.error("Error fetching colleges:", error);
        if (loadingIndicator) {
          loadingIndicator.textContent = "Error loading colleges. Please try again.";
        }
      });

    return; // Exit the function early
  }

  // Continue with the existing filtering logic for non-empty queries
  // Remove loaded class to fade out current content
  container.classList.remove('loaded');

  // Add loading indicator
  let loadingIndicator = document.querySelector(".loading-indicator");
  if (!loadingIndicator) {
    loadingIndicator = document.createElement("div");
    loadingIndicator.className = "loading-indicator";
    containerParent.appendChild(loadingIndicator);
  }
  loadingIndicator.textContent = "Filtering colleges...";
  loadingIndicator.style.display = "block";

  // Extract college data from existing elements
  const collegeData = [];
  collegeContainers.forEach(college => {
    const nameElement = college.querySelector("h2");
    if (!nameElement) return;

    const name = nameElement.textContent;
    const description = college.querySelector("p").textContent;
    const imgSrc = college.querySelector("img").src;

    collegeData.push({
      Name: name,
      Description: description,
      Emblem: imgSrc
    });
  });

  // Filter college data
  const filteredData = collegeData.filter(college =>
    college.Name.toLowerCase().includes(query)
  );

  // Use setTimeout to allow the fade-out to complete
  setTimeout(() => {
    // Clear container
    container.innerHTML = "";

    // Check if there are any matching colleges
    if (filteredData.length === 0) {
      // Show no results message with smooth transition
      noResultsMessage.style.display = "block";
      // Trigger reflow
      void noResultsMessage.offsetWidth;
      // Add visible class for transition
      setTimeout(() => {
        noResultsMessage.classList.add('visible');
      }, 100);
      
      // Remove loading indicator with a delay
      setTimeout(() => {
        if (loadingIndicator) {
          loadingIndicator.style.display = "none";
        }
      }, 400);
      
      // Add the loaded class to ensure proper display
      setTimeout(() => {
        container.classList.add('loaded');
      }, 400);
    } else {
      // Hide no results message
      noResultsMessage.classList.remove('visible');
      setTimeout(() => {
        noResultsMessage.style.display = "none";
      }, 400);

      // Preload images first (just like in initial load)
      preloadImages(filteredData).then(() => {
        // Create all college elements
        const fragment = document.createDocumentFragment();

        filteredData.forEach((college, index) => {
          const collegeElement = createCollegeElement(college, index);
          fragment.appendChild(collegeElement);
        });

        // Add all elements at once
        container.appendChild(fragment);

        // Remove loading indicator with a delay
        setTimeout(() => {
          if (loadingIndicator) {
            loadingIndicator.style.display = "none";
          }
        }, 300);

        // Delay showing the colleges to ensure everything is ready
        setTimeout(() => {
          container.classList.add('loaded');
        }, 400);
      });
    }
  }, 300); // Short delay to allow fade-out
}  