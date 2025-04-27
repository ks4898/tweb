document.addEventListener('DOMContentLoaded', function() {
    // load dynamic college carousel
    loadCollegeCarousel();
    
    // load dynamic tournament data
    loadTournaments();
    
    // load dynamic team data
    loadFeaturedTeams();
});

async function loadCollegeCarousel() {
    try {
        // fetch colleges
        const response = await fetch('/universities');
        if (!response.ok) throw new Error('Failed to fetch colleges');
        
        const colleges = await response.json();
        
        // get carousel elements
        const carouselInner = document.querySelector('.carousel-inner');
        const carouselIndicators = document.querySelector('.carousel-indicators');
        
        if (!carouselInner || !carouselIndicators) return;
        
        // clear existing content
        carouselInner.innerHTML = '';
        carouselIndicators.innerHTML = '';
        
        // add colleges to carousel (limit to 3 for performance)
        colleges.slice(0, 3).forEach((college, index) => {
            // create indicator
            const indicator = document.createElement('button');
            indicator.type = 'button';
            indicator.dataset.bsTarget = '#collegeCarousel';
            indicator.dataset.bsSlideTo = index.toString();
            if (index === 0) indicator.classList.add('active');
            indicator.setAttribute('aria-current', index === 0 ? 'true' : 'false');
            indicator.setAttribute('aria-label', `Slide ${index + 1}`);
            carouselIndicators.appendChild(indicator);
            
            // create carousel item
            const item = document.createElement('div');
            item.classList.add('carousel-item');
            if (index === 0) item.classList.add('active');
            
            // set background image if available
            if (college.ImageURL) {
                item.style.backgroundImage = `url("${college.ImageURL}")`;
            } else {
                item.style.backgroundImage = `url("/media/img/college${(index % 3) + 1}.jpg")`;
            }
            
            // create caption
            const caption = document.createElement('div');
            caption.classList.add('carousel-caption', 'd-none', 'd-md-block');
            caption.innerHTML = `
                <h5>${college.Name}</h5>
                <p>${college.Location || 'Join our tournament!'}</p>
                <a href="/details?name=${college.Name}" class="btn btn-link">Learn More</a>
            `;
            
            item.appendChild(caption);
            carouselInner.appendChild(item);
        });
    } catch (error) {
        console.error('Error loading college carousel:', error);
    }
}

async function loadTournaments() {
    try {
        // fetch tournaments from existing endpoint
        const response = await fetch('/api/tournaments');
        if (!response.ok) throw new Error('Failed to fetch tournaments');
        
        const tournaments = await response.json();
        
        // get tournament container
        const tournamentContainer = document.querySelector('#tournaments .row');
        if (!tournamentContainer) return;
        
        // clear existing content
        tournamentContainer.innerHTML = '';
        
        // add tournaments (limit to 3 for homepage)
        tournaments.slice(0, 3).forEach(tournament => {
            const tournamentCol = document.createElement('div');
            tournamentCol.classList.add('col-md-4', 'mb-4');
            
            // format dates
            const startDate = new Date(tournament.StartDate).toLocaleDateString();
            const endDate = new Date(tournament.EndDate).toLocaleDateString();
            
            tournamentCol.innerHTML = `
                <div class="tournament-container h-100">
                    <h3>${tournament.Name}</h3>
                    <p>${tournament.Description || 'Join this exciting tournament!'}</p>
                    <p>Dates: ${startDate} - ${endDate}</p>
                    <p>Location: ${tournament.Location}</p>
                    <p>Status: ${tournament.Status}</p>
                    <a href="/brackets" class="btn-link w-100">More Info</a>
                </div>
            `;
            
            tournamentContainer.appendChild(tournamentCol);
        });
        
        // if no tournaments, show a message
        if (tournaments.length === 0) {
            tournamentContainer.innerHTML = `
                <div class="col-12 text-center">
                    <h3>No tournaments available at the moment.</h3>
                    <p>Check back soon for upcoming events!</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading tournaments:', error);
    }
}