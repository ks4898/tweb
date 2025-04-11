document.addEventListener('DOMContentLoaded', function () {
    const searchArticleInput = document.getElementById('searchArticle');
    const searchArticlesBtn = document.getElementById('searchArticlesBtn');
    const addArticleBtn = document.getElementById('addArticleBtn');
    const editArticleBtn = document.getElementById('editArticleBtn');
    const deleteArticleBtn = document.getElementById('deleteArticleBtn');
    const newsTableBody = document.getElementById('newsTableBody');

    const addArticleModal = new bootstrap.Modal(document.getElementById('addArticleModal'));
    const editArticleModal = new bootstrap.Modal(document.getElementById('editArticleModal'));
    const deleteArticleModal = new bootstrap.Modal(document.getElementById('deleteArticleModal'));

    let selectedArticle = null;

    // fetch and display articles
    function fetchArticles() {
        fetch('/news-articles')
            .then(response => response.json())
            .then(articles => {
                const reversedArticles = articles.reverse();
                displayArticles(reversedArticles);
            })
            .catch(error => console.error('Error fetching articles:', error));
    }

    function displayArticles(articles) {
        newsTableBody.innerHTML = '';
        articles.forEach(article => {
            if (article.ImageURL !== null) {
                const row = document.createElement('tr');
                row.innerHTML = `
                <td>${article.PostID}</td>
                <td>${article.Author}</td>
                <td>${article.UserID || 'N/A'}</td>
                <td>${article.Title.length > 24 ? article.Title.substring(0, 24) + '...' : article.Title}</td>
                <td>${(article.ImageURL.length > 16 ? article.ImageURL.substring(0, 16) + '...' : article.ImageURL) || 'N/A'}</td>
                <td>${article.Content.length > 36 ? article.Content.substring(0, 36) + '...' : article.Content}</td>
                <td>${new Date(article.CreatedAt).toLocaleDateString()}</td>
            `;
                row.addEventListener('click', (e) => selectArticle(article, e));
                newsTableBody.appendChild(row);
            } else {
                const row = document.createElement('tr');
                row.innerHTML = `
                <td>${article.PostID}</td>
                <td>${article.Author}</td>
                <td>${article.UserID || 'N/A'}</td>
                <td>${article.Title.length > 24 ? article.Title.substring(0, 24) + '...' : article.Title}</td>
                <td>${'N/A'}</td>
                <td>${article.Content.length > 36 ? article.Content.substring(0, 36) + '...' : article.Content}</td>
                <td>${new Date(article.CreatedAt).toLocaleDateString()}</td>
            `;
                row.addEventListener('click', (e) => selectArticle(article, e));
                newsTableBody.appendChild(row);
            }
        });
    }

    function selectArticle(article, e) {
        selectedArticle = article;
        const allTables = document.querySelectorAll('.user-table tbody tr');
        allTables.forEach(row => row.classList.remove('selected'));
        e.currentTarget.classList.add('selected');
    }

    // search articles
    searchArticlesBtn.addEventListener('click', function () {
        const searchTerm = searchArticleInput.value.toLowerCase();
        if (searchTerm !== "" || searchTerm !== " ") {
            fetch('/news-articles')
                .then(response => response.json())
                .then(articles => {
                    const filteredArticles = articles.filter(article =>
                        article.Title.toLowerCase().includes(searchTerm) ||
                        article.Author.toLowerCase().includes(searchTerm)
                    );
                    displayArticles(filteredArticles);
                })
                .catch(error => console.error('Error searching articles:', error));
        } else {
            fetchArticles();
        }
    });

    // Add article
    addArticleBtn.addEventListener('click', function () {
        addArticleModal.show();
    });

    document.getElementById('createArticleBtn').addEventListener('click', function () {
        const author = document.getElementById('addArticleAuthorName').value;
        const title = document.getElementById('addArticleName').value;
        const imageURL = document.getElementById('addArticleImageURL').value;
        const content = document.getElementById('addArticleContent').value;

        fetch('/create-news', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ Author: author, Title: title, ImageURL: imageURL, Content: content }),
        })
            .then(response => response.json())
            .then(data => {
                addArticleModal.hide();
                fetchArticles();
                alert("Article added successfully!");
            })
            .catch(error => console.error('Error adding article:', error));
    });

    // Edit article
    editArticleBtn.addEventListener('click', function () {
        if (selectedArticle) {
            document.getElementById('editArticleName').value = selectedArticle.Title;
            document.getElementById('editArticleImageURL').value = selectedArticle.ImageURL || '';
            document.getElementById('editArticleContent').value = selectedArticle.Content;
            editArticleModal.show();
        } else {
            alert('Please select an article to edit.');
        }
    });

    document.getElementById('saveArticleBtn').addEventListener('click', function () {
        const title = document.getElementById('editArticleName').value;
        const imageURL = document.getElementById('editArticleImageURL').value;
        const content = document.getElementById('editArticleContent').value;

        fetch(`/update-news/${selectedArticle.PostID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ Title: title, ImageURL: imageURL, Content: content }),
        })
            .then(response => response.json())
            .then(data => {
                editArticleModal.hide();
                fetchArticles();
                alert("Article updated successfully!");
            })
            .catch(error => console.error('Error updating article:', error));
    });

    // Delete article
    deleteArticleBtn.addEventListener('click', function () {
        if (selectedArticle) {
            document.getElementById('articleDetails').innerHTML = `
                <p><strong>Title:</strong> ${selectedArticle.Title}</p>
                <p><strong>Author:</strong> ${selectedArticle.Author}</p>
                <p><strong>Created At:</strong> ${new Date(selectedArticle.CreatedAt).toLocaleDateString()}</p>
            `;
            deleteArticleModal.show();
        } else {
            alert('Please select an article to delete.');
        }
    });

    document.getElementById('confirmDeleteArticleBtn').addEventListener('click', function () {
        fetch(`/delete-news/${selectedArticle.PostID}`, {
            method: 'DELETE',
        })
            .then(response => response.json())
            .then(data => {
                deleteArticleModal.hide();
                fetchArticles();
                alert("Article deleted successfully!");
            })
            .catch(error => console.error('Error deleting article:', error));
    });

    // Initial fetch of articles
    fetchArticles();
});