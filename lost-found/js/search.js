// search.js - Advanced Search Engine for Lost & Found
class SearchEngine {
    constructor(options = {}) {
        this.container = options.container || document.body;
        this.resultsContainer = options.resultsContainer || '#searchResults';
        this.minQueryLength = options.minQueryLength || 2;
        this.maxResults = options.maxResults || 20;
        this.debounceDelay = options.debounceDelay || 250;
        
        this.results = [];
        this.currentQuery = '';
        this.isSearching = false;
        
        this.init();
    }
    
    init() {
        this.setupGlobalSearch();
        this.setupAdvancedSearch();
        this.loadSearchHistory();
        console.log('🔍 SearchEngine initialized');
    }
    
    // Global site search (header/search bar)
    setupGlobalSearch() {
        const searchInput = document.querySelector('#globalSearch, .search-input, [data-search]');
        if (!searchInput) return;
        
        searchInput.addEventListener('input', debounce((e) => {
            this.currentQuery = e.target.value.trim();
            if (this.currentQuery.length >= this.minQueryLength) {
                this.globalSearch(this.currentQuery);
            } else {
                this.hideResults();
            }
        }, this.debounceDelay));
        
        // Enter key
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && this.currentQuery.length >= this.minQueryLength) {
                this.goToSearchResults(this.currentQuery);
            }
        });
        
        // Escape clears search
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.clearSearch();
            }
        });
    }
    
    // Search across all items
    async globalSearch(query) {
        if (this.isSearching) return;
        this.isSearching = true;
        
        try {
            this.showLoading();
            
            // Search items
            const items = Storage.searchItems(query, {
                status: 'active'
            });
            
            // Search users (for contact matching)
            const users = Storage.getUsers().filter(user =>
                user.fullName.toLowerCase().includes(query.toLowerCase()) ||
                user.email.toLowerCase().includes(query.toLowerCase())
            );
            
            this.results = items.slice(0, this.maxResults);
            
            if (this.results.length > 0) {
                this.renderGlobalResults(this.results, query);
            } else {
                this.showNoResults(query);
            }
            
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Search failed. Please try again.');
        } finally {
            this.isSearching = false;
        }
    }
    
    renderGlobalResults(items, query) {
        const container = document.querySelector(this.resultsContainer);
        if (!container) return;
        
        container.innerHTML = `
            <div class="search-results-header">
                <h3>Found ${items.length} results for "${this.escapeHtml(query)}"</h3>
                <a href="view-items.html?search=${encodeURIComponent(query)}" class="view-all-results">
                    View all results →
                </a>
            </div>
            <div class="search-results-grid">
                ${items.slice(0, 5).map(item => this.createSearchResult(item)).join('')}
            </div>
        `;
        
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    createSearchResult(item) {
        const icon = this.getCategoryIcon(item.category);
        const statusClass = item.itemType === 'found' ? 'found' : 'lost';
        const timeAgo = this.formatTimeAgo(item.createdAt);
        const highlight = this.createHighlight(item.itemName, this.currentQuery);
        
        return `
            <article class="search-result-card" tabindex="0">
                <div class="search-result-image" style="background-image: url(${item.image || ''})">
                    ${!item.image ? icon : ''}
                    <div class="status-badge status-${statusClass}">${item.itemType?.toUpperCase()}</div>
                </div>
                <div class="search-result-content">
                    <h4 class="search-result-title">${highlight}</h4>
                    <div class="search-result-meta">
                        <span class="location">${item.location}</span>
                        <span class="category">${item.category}</span>
                        <span class="time">${timeAgo}</span>
                    </div>
                    ${item.contactName ? `
                        <div class="search-result-contact">
                            👤 ${item.contactName}
                        </div>
                    ` : ''}
                    <a href="item-details.html?id=${item.id}" class="search-result-link">
                        View Item →
                    </a>
                </div>
            </article>
        `;
    }
    
    // Advanced search page
    setupAdvancedSearch() {
        const searchForm = document.querySelector('#advancedSearchForm, [data-advanced-search]');
        if (!searchForm) return;
        
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(searchForm);
            const query = Object.fromEntries(formData);
            this.advancedSearch(query);
        });
    }
    
    advancedSearch(filters) {
        const results = Storage.getItems({
            status: filters.status || 'active',
            type: filters.type || 'all',
            category: filters.category || 'all'
        });
        
        // Apply text search if provided
        let filtered = results;
        if (filters.query) {
            filtered = Storage.searchItems(filters.query, {
                status: filters.status,
                type: filters.type,
                category: filters.category
            });
        }
        
        this.renderAdvancedResults(filtered, filters);
        this.saveSearchHistory(filters.query || '');
    }
    
    renderAdvancedResults(items, filters) {
        const container = document.querySelector(this.resultsContainer);
        if (!container) return;
        
        const filterText = this.formatFilterText(filters);
        
        container.innerHTML = `
            <div class="advanced-search-header">
                <h2>${items.length} items found ${filterText}</h2>
                <div class="search-refine">
                    <button onclick="SearchEngine.clearFilters()">Clear Filters</button>
                    <button onclick="SearchEngine.saveSearch()">Save Search</button>
                </div>
            </div>
            <div class="advanced-results-list">
                ${items.map(item => this.createAdvancedResult(item)).join('')}
            </div>
        `;
    }
    
    createAdvancedResult(item) {
        return `
            <div class="advanced-result">
                <div class="result-header">
                    <h3>${this.escapeHtml(item.itemName)}</h3>
                    <span class="result-status">${item.itemType} - ${item.status}</span>
                </div>
                <div class="result-details">
                    <div class="result-meta">
                        📍 ${item.location} | ${item.category} | ${this.formatTimeAgo(item.createdAt)}
                    </div>
                    ${item.description ? `<p>${item.description.substring(0, 100)}${item.description.length > 100 ? '...' : ''}</p>` : ''}
                </div>
                <div class="result-actions">
                    <a href="item-details.html?id=${item.id}" class="btn btn-primary">View Details</a>
                    ${item.contactPhone ? `<a href="tel:${item.contactPhone}" class="btn btn-secondary">Call</a>` : ''}
                </div>
            </div>
        `;
    }
    
    // Search history
    loadSearchHistory() {
        const history = this.getSearchHistory();
        const historyEl = document.querySelector('#searchHistory');
        if (historyEl && history.length) {
            historyEl.innerHTML = history.slice(0, 5).map(term => 
                `<button class="history-item" onclick="SearchEngine.search('${term}')">${this.escapeHtml(term)}</button>`
            ).join('');
        }
    }
    
    saveSearchHistory(query) {
        if (!query) return;
        
        let history = this.getSearchHistory();
        history = history.filter(h => h !== query);
        history.unshift(query);
        history = history.slice(0, 10);
        
        localStorage.setItem('LF_searchHistory', JSON.stringify(history));
    }
    
    getSearchHistory() {
        try {
            return JSON.parse(localStorage.getItem('LF_searchHistory') || '[]');
        } catch {
            return [];
        }
    }
    
    // UI Helpers
    showLoading() {
        const container = document.querySelector(this.resultsContainer);
        if (container) {
            container.innerHTML = `
                <div class="search-loading">
                    <div class="spinner"></div>
                    <span>Searching...</span>
                </div>
            `;
            container.style.display = 'block';
        }
    }
    
    showNoResults(query) {
        const container = document.querySelector(this.resultsContainer);
        if (container) {
            container.innerHTML = `
                <div class="search-no-results">
                    <div class="no-results-icon">🔍</div>
                    <h3>No results found</h3>
                    <p>No items match "${this.escapeHtml(query)}"</p>
                    <div class="search-suggestions">
                        <p>Try:</p>
                        <ul>
                            <li>Checking spelling</li>
                            <li>Using category filters</li>
                            <li>Broadening your search</li>
                        </ul>
                    </div>
                    <a href="add-item.html" class="btn btn-primary">Report New Item</a>
                </div>
            `;
            container.style.display = 'block';
        }
    }
    
    showError(message) {
        const container = document.querySelector(this.resultsContainer);
        if (container) {
            container.innerHTML = `
                <div class="search-error">
                    <div class="error-icon">⚠️</div>
                    <h3>Search Error</h3>
                    <p>${message}</p>
                    <button onclick="SearchEngine.clearSearch()" class="btn btn-secondary">Try Again</button>
                </div>
            `;
        }
    }
    
    hideResults() {
        const container = document.querySelector(this.resultsContainer);
        if (container) container.style.display = 'none';
    }
    
    clearSearch() {
        this.currentQuery = '';
        this.searchInput.value = '';
        this.hideResults();
        this.searchInput.focus();
    }
    
    goToSearchResults(query) {
        window.location.href = `view-items.html?search=${encodeURIComponent(query)}`;
    }
    
    formatFilterText(filters) {
        const parts = [];
        if (filters.type && filters.type !== 'all') parts.push(filters.type);
        if (filters.category && filters.category !== 'all') parts.push(filters.category);
        if (filters.status && filters.status !== 'all') parts.push(filters.status);
        return parts.length ? `matching ${parts.join(', ')}` : '';
    }
    
    getCategoryIcon(category) {
        const icons = {
            'Electronics': '📱', 'Bags': '🎒', 'Clothing': '👕',
            'Accessories': '💼', 'Keys': '🔑', 'Documents': '📄'
        };
        return icons[category] || '📦';
    }
    
    formatTimeAgo(dateStr) {
        const now = new Date();
        const date = new Date(dateStr);
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        return diffDays === 0 ? 'Today' : `${diffDays}d ago`;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    createHighlight(text, query) {
        if (!query) return this.escapeHtml(text);
const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return this.escapeHtml(text).replace(regex, '<mark>$1</mark>');
    }
}

// Static methods for global access
SearchEngine.clearFilters = function() {
    const form = document.querySelector('#advancedSearchForm');
    if (form) form.reset();
    new SearchEngine().advancedSearch({});
};

SearchEngine.saveSearch = function() {
    const formData = Object.fromEntries(new FormData(document.querySelector('#advancedSearchForm')));
    localStorage.setItem('LF_savedSearch', JSON.stringify(formData));
    alert('Search saved!');
};

SearchEngine.search = function(query) {
    document.querySelector('#globalSearch, .search-input')?.setAttribute('value', query);
    new SearchEngine().globalSearch(query);
};

SearchEngine.clearSearch = function() {
    new SearchEngine().clearSearch();
};

// Debounce utility
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
    window.SearchEngine = new SearchEngine();
});