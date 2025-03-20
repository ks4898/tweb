// Array of articles (simulating database) REPLACE !!!
const articles = [
    {
        title: "Sample News Article 1",
        author: "Author 1",
        date: "March 18, 2025",
        content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus lacinia, lorem vel fringilla faucibus.",
        image: "/media/img/college1.jpg"
    },
    {
        title: "Sample News Article 2",
        author: "Author 2",
        date: "March 19, 2025",
        content: "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
        image: "/media/img/college2.jpg"
    },
    {
        title: "Sample News Article 3",
        author: "Author 3",
        date: "March 20, 2025",
        content: "Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit.",
        image: "/media/img/college3.jpg"
    },
    {
        title: "Sample News Article 4",
        author: "Author 4",
        date: "March 21, 2025",
        content: "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.",
        image: null
    }
];

// Add event listener for DOM content loaded
document.addEventListener("DOMContentLoaded", function() {
    const articlesContainer = document.getElementById("articles");
    const modal = new bootstrap.Modal(document.getElementById("newsModal"));
    const modalTitle = document.querySelector("#newsModal .modal-title");
    const modalBody = document.querySelector("#newsModal .modal-body");

    // Function to create and append articles
    function createArticle(article) {
        const articleElement = document.createElement("div");
        articleElement.classList.add("news-article", "d-flex", "align-items-center", "mt-3", "text-truncate");

        // Image container or default megaphone container
        const imgContainer = document.createElement("div");
        imgContainer.classList.add("news-img-container");

        if (article.image) {
            const img = document.createElement("img");
            img.src = article.image;
            img.alt = article.title;
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
        title.textContent = article.title;

        const date = document.createElement("span");
        date.classList.add("news-date", "text-muted");
        date.textContent = `${article.author}, ${article.date}`;

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
            modalTitle.innerHTML = `<strong>${article.title}</strong>`; // Title wrapped in <strong> tag
            modalBody.innerHTML = `
                <p class="text-muted" style="font-style: italic;">${article.author}, ${article.date}</p>
                <p>${article.content}</p>
                ${article.image ? `<img src="${article.image}" alt="${article.title}" class="modal-img">` : ''}
            `;
            modal.show();
        });

        // Append the article to the articles container
        articlesContainer.appendChild(articleElement);
    }

    // Loop through the array and create each article
    articles.forEach(createArticle);
});
