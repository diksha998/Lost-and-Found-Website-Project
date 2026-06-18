// view-items.js - Advanced Items Viewer with Search & Filters
class ViewItemsController {
    constructor() {
        this.itemsGrid = document.getElementById('itemsGrid');
        this.searchInput = document.getElementById('searchInput');
        this.filterBtns = document.querySelectorAll('.filter-btn');
        this.pagination = document.getElementById('pagination');
        this.statsElements = {
            total: document.getElementById('totalCount'),
            lost: document.getElementById('lostCount'),
            found: document.getElementById('foundCount')
        };
        this.emptyState = document.getElementById('emptyState');
        
        this.currentFilters = {
            search: '',
            type: 'all',
            category: 'all',
            status: 'active'
        };
        
        this.itemsPerPage = 12;
        this.currentPage = 1;
        
        this.init();
    }
    
    init() {
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }
        
        this.loadItems();
        this.setupEventListeners();
        this.updateStats();
    }
    
    setupEventListeners() {
        // Search
        this.searchInput.addEventListener('input', debounce(() => {
            this.currentFilters.search = this.searchInput.value;
            this.currentPage = 1;
            this.render();
        }, 300));
        
        // Filters
        this.filterBtns.forEach(btn => {
            btn.addEventListener('click', () => this.setFilter(btn.dataset.filter, btn));
        });
        
        // Pagination
        this.pagination.addEventListener('click', (e) => {
            if (e.target.classList.contains('page-btn')) {
                this.currentPage = parseInt(e.target.textContent);
                this.render();
            }
        });
        
        // Item clicks
        this.itemsGrid.addEventListener('click', (e) => {
            const itemCard = e.target.closest('.item-card');
            if (itemCard) {
                const itemId = parseInt(itemCard.dataset.itemId);
                window.location.href = `item-details.html?id=${itemId}`;
            }
        });
        
        // Keyboard search
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.currentFilters.search = this.searchInput.value;
                this.currentPage = 1;
                this.render();
            }
        });
    }
    
    async loadItems() {
        this.allItems = Storage.getItems();
        this.filteredItems = [...this.allItems];
        this.render();
        this.updateStats();
        
        // Listen for real-time updates
        if ('BroadcastChannel' in window) {
            const channel = new BroadcastChannel('lostfound-sync');
            channel.onmessage = (e) => {
                if (e.data.action === 'itemAdded' || e.data.action === 'reload') {
                    this.reloadItems();
                }
            };
        }
    }
    
    reloadItems() {
        this.allItems = Storage.getItems();
        this.applyFilters();
        this.render();
    }
    
    setFilter(value, activeBtn) {
        // Update active filter
        this.filterBtns.forEach(btn => btn.classList.remove('active'));
        activeBtn.classList.add('active');
        
        // Update filter state
        const filterType = activeBtn.dataset.filterType || 'type';
        this.currentFilters[filterType] = value;
        
        this.currentPage = 1;
        this.render();
    }
    
    applyFilters() {
        this.filteredItems = this.allItems.filter(item => {
            // Search filter
            if (this.currentFilters.search) {
                const search = this.currentFilters.search.toLowerCase();
                if (!item.itemName?.toLowerCase().includes(search) &&
                    !item.location?.toLowerCase().includes(search) &&
                    !item.category?.toLowerCase().includes(search) &&
                    !item.description?.toLowerCase().includes(search)) {
                    return false;
                }
            }
            
            // Type filter
            if (this.currentFilters.type !== 'all' && item.itemType !== this.currentFilters.type) {
                return false;
            }
            
            // Category filter
            if (this.currentFilters.category !== 'all' && item.category !== this.currentFilters.category) {
                return false;
            }
            
            // Status filter
            if (this.currentFilters.status !== 'all' && item.status !== this.currentFilters.status) {
                return false;
            }
            
            return true;
        });
    }
    
    render() {
        this.applyFilters();
        this.renderItems();
        this.renderPagination();
        this.toggleEmptyState();
    }
    
    renderItems() {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const pageItems = this.filteredItems.slice(start, end);
        
        this.itemsGrid.innerHTML = pageItems.map(item => this.createItemCard(item)).join('');
    }
    
    createItemCard(item) {
        const icon = this.getCategoryIcon(item.category);
        const hasPhoto = item.image;
        const statusClass = item.itemType === 'found' ? 'found' : 'lost';
        const timeAgo = this.formatTimeAgo(item.createdAt);
        
        return `
            <article class="item-card" data-item-id="${item.id}" tabindex="0">
                <div class="item-image ${hasPhoto ? 'has-photo' : ''}" 
                     style="${hasPhoto ? `background-image: url(${item.image})` : ''}">
                    ${!hasPhoto ? icon : ''}
                    <div class="status-badge status-${statusClass}">
                        ${item.itemType?.toUpperCase()}
                    </div>
                </div>
                <div class="item-content">
                    <h3 class="item-title">${this.escapeHtml(item.itemName)}</h3>
                    <div class="item-meta">
                        <span class="meta-tag location">📍 ${item.location}</span>
                        <span class="meta-tag time">${timeAgo}</span>
                    </div>
                    <div class="item-meta">
                        <span class="meta-tag category">${item.category}</span>
                        ${item.status !== 'active' ? `<span class="meta-tag status">${item.status}</span>` : ''}
                    </div>
                    ${item.contactName ? `
                        <div class="contact-preview">
                            <span class="contact-name">${item.contactName}</span>
                            ${item.contactPhone ? `<span class="contact-phone">${this.formatPhone(item.contactPhone)}</span>` : ''}
                        </div>
                    ` : ''}
                </div>
            </article>
        `;
    }
    
    getCategoryIcon(category) {
        const icons = {
            'Electronics': '📱', 'Bags': '🎒', 'Clothing': '👕',
            'Accessories': '💼', 'Keys': '🔑', 'Documents': '📄',
            'Other': '📦', 'Books': '📚', 'Jewelry': '💎'
        };
        return icons[category] || '📦';
    }
    
    formatTimeAgo(dateStr) {
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }
    
    formatPhone(phone) {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
        }
        return phone;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    renderPagination() {
        const totalPages = Math.ceil(this.filteredItems.length / this.itemsPerPage);
        
        if (totalPages <= 1) {
            this.pagination.innerHTML = '';
            return;
        }
        
        let html = '';
        const maxVisible = 5;
        const startPage = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
        const endPage = Math.min(totalPages, startPage + maxVisible - 1);
        
        // First page
        if (startPage > 1) {
            html += `<button class="page-btn" data-page="1">1</button>`;
            if (startPage > 2) html += `<span class="page-ellipsis">...</span>`;
        }
        
        // Page buttons
        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === this.currentPage ? 'active' : '';
            html += `<button class="page-btn ${activeClass}" data-page="${i}">${i}</button>`;
        }
        
        // Last page
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += `<span class="page-ellipsis">...</span>`;
            html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
        }
        
        this.pagination.innerHTML = html;
    }
    
    updateStats() {
        const stats = Storage.getStats();
        this.statsElements.total.textContent = stats.totalItems;
        this.statsElements.lost.textContent = stats.lostItems;
        this.statsElements.found.textContent = stats.foundItems;
    }
    
    toggleEmptyState() {
        const hasItems = this.filteredItems.length > 0;
        this.emptyState.style.display = hasItems ? 'none' : 'block';
        this.itemsGrid.style.display = hasItems ? 'grid' : 'none';
        this.pagination.style.display = hasItems ? 'flex' : 'none';
    }
}

// Utility: Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new ViewItemsController();
});

// Export
window.ViewItemsController = ViewItemsController;