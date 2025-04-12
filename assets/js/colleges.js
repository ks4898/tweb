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

    // No colleges found message
    let noResultsMessage = document.createElement("p");
    noResultsMessage.textContent = `No colleges found matching your search.\nPlease check for any typing errors and try again.`;
    noResultsMessage.classList.add("no-results-message");
    noResultsMessage.style.display = "none";
    containerParent.appendChild(noResultsMessage);

    searchButton.addEventListener("click", filterColleges);
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

    // --- MODIFICATION START ---

    // Step 1: Set the initial src using the existing logic (attempts the real emblem first)
    img.src = college.Emblem || '/media/img/placeholder-250x250.png';

    // Step 2: Add the onerror handler to catch loading failures
    img.onerror = function() {
        // If the initial src fails to load for ANY reason (invalid path, 404, etc.)
        // set the source to the placeholder image.
        console.warn(`Failed to load emblem for ${college.Name} (Attempted: ${this.src}). Using placeholder.`); // Optional: for debugging
        this.src = '/media/img/placeholder-250x250.png';
        // Optionally update alt text if you want to indicate it's a placeholder
        // this.alt = `${college.Name} Logo (Placeholder)`;
    };

    // --- MODIFICATION END ---


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

// Filter colleges
function filterColleges() {
    const searchInput = document.querySelector(".search-bar input");
    const query = searchInput.value.toLowerCase().trim();
    const collegeContainers = document.querySelectorAll(".college-container");
    const noResultsMessage = document.querySelector(".no-results-message");

    let visibleColleges = [];

    // If query is empty, show all colleges
    if (query === "") {
        collegeContainers.forEach((college, index) => {
            college.style.display = "flex";
            college.className = 'college-container';
            college.classList.add(index % 2 === 0 ? 'odd-style' : 'even-style');

            const button = college.querySelector(".btn-link");
            if (button) {
                button.className = 'btn-link';
                button.classList.add(index % 2 === 0 ? 'odd-button' : 'even-button');
            }
        });

        noResultsMessage.style.display = "none";
        return;
    }

    // Filter colleges based on query
    collegeContainers.forEach(college => {
        const collegeNameElement = college.querySelector("h2");
        if (!collegeNameElement) return;

        const collegeName = collegeNameElement.textContent.toLowerCase();
        if (collegeName.includes(query)) {
            college.style.display = "flex";
            visibleColleges.push(college);
        } else {
            college.style.display = "none";
        }
    });

    // Show or hide no results message
    noResultsMessage.style.display = visibleColleges.length === 0 ? "block" : "none";

    // Apply alternating styles to visible colleges
    visibleColleges.forEach((college, index) => {
        college.className = 'college-container';
        college.classList.add(index % 2 === 0 ? 'odd-style' : 'even-style');

        const button = college.querySelector(".btn-link");
        if (button) {
            button.className = 'btn-link';
            button.classList.add(index % 2 === 0 ? 'odd-button' : 'even-button');
        }
    });
}