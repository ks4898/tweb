// Add event listener for DOM content loaded
document.addEventListener("DOMContentLoaded", function() {
    const articlesContainer = document.getElementById("articles");
    const modal = new bootstrap.Modal(document.getElementById("newsModal"));
    const modalTitle = document.querySelector("#newsModal .modal-title");
    const modalBody = document.querySelector("#newsModal .modal-body");

    // Fetch articles from the database
    fetch('/news-articles')
        .then(response => response.json())
        .then(articles => {
            // Loop through the fetched articles and create each article
            articles.forEach(createArticle);
        })
        .catch(error => console.error('Error fetching articles:', error));

    // Function to create and append articles
    function createArticle(article) {
        const articleElement = document.createElement("div");
        articleElement.classList.add("news-article", "d-flex", "align-items-center", "mt-3", "text-truncate");

        // Image container or default megaphone container
        const imgContainer = document.createElement("div");
        imgContainer.classList.add("news-img-container");

        if (article.ImageURL) {
            const img = document.createElement("img");
            img.src = article.ImageURL;
            img.alt = article.Title;
            img.classList.add("news-img");
            imgContainer.appendChild(img);
        } else {
            const defaultImgContainer = document.createElement("div");
            defaultImgContainer.classList.add("default-img-container");
            const icon = document.createElement("i");
            icon.classList.add("bi", "bi-megaphone");
            defaultImgContainer.appendChild(icon);
            imgContainer.appendChild(defaultImgContainer);
        }

        // Article details
        const details = document.createElement("div");
        details.classList.add("news-details", "ms-3");

        const title = document.createElement("h3");
        title.classList.add("news-title");
        title.textContent = article.Title;

        const date = document.createElement("span");
        date.classList.add("news-date", "text-muted");
        date.textContent = `${article.Author}, ${new Date(article.CreatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;


        details.appendChild(title);
        details.appendChild(date);

        // Hover overlay
        const hoverOverlay = document.createElement("div");
        hoverOverlay.classList.add("hover-overlay");

        const searchIcon = document.createElement("i");
        searchIcon.classList.add("bi", "bi-search");
        hoverOverlay.appendChild(searchIcon);

        // Append image and details to the article container
        articleElement.appendChild(imgContainer);
        articleElement.appendChild(details);
        articleElement.appendChild(hoverOverlay);

        // Add click event to show the modal
        articleElement.addEventListener("click", function() {
            modalTitle.innerHTML = `<strong>${article.Title}</strong>`;
            modalBody.innerHTML = `
                <p class="text-muted" style="font-style: italic;">${article.Author}, ${new Date(article.CreatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p>${article.Content}</p>
                ${article.ImageURL ? `<img src="${article.ImageURL}" alt="${article.Title}" class="modal-img">` : ''}
            `;
            modal.show();
        });

        // Append the article to the articles container
        articlesContainer.appendChild(articleElement);
    }
});