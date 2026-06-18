// storage.js - Advanced LocalStorage Manager with Backup & Sync
class StorageManager {
    constructor(options = {}) {
        this.prefix = options.prefix || 'LostFound_';
        this.backupKey = `${this.prefix}backup`;
        this.syncInterval = options.syncInterval || 30000; // 30s
        this.maxItems = options.maxItems || 1000;
        this.init();
    }
    
    init() {
        this.migrateLegacyData();
        this.startAutoBackup();
        this.startSync();
        console.log('🗄️ StorageManager initialized');
    }
    
    // Data Keys
    getKey(name) {
        return `${this.prefix}${name}`;
    }
    
    // Generic CRUD Operations
    set(key, data, options = {}) {
        try {
            const serialized = this.serialize(data);
            localStorage.setItem(this.getKey(key), serialized);
            
            if (options.backup !== false) {
                this.updateBackup(key, serialized);
            }
            
            return { success: true, data };
        } catch (error) {
            console.error(`Storage set error (${key}):`, error);
            return { success: false, error };
        }
    }
    
    get(key, defaultValue = null) {
        try {
            const raw = localStorage.getItem(this.getKey(key));
            if (!raw) return defaultValue;
            
            const data = this.deserialize(raw);
            return data !== null ? data : defaultValue;
        } catch (error) {
            console.error(`Storage get error (${key}):`, error);
            return defaultValue;
        }
    }
    
    remove(key) {
        try {
            localStorage.removeItem(this.getKey(key));
            this.updateBackup(key, null);
            return { success: true };
        } catch (error) {
            console.error(`Storage remove error (${key}):`, error);
            return { success: false, error };
        }
    }
    
    // Items Management (Lost & Found)
    getItems(filter = {}) {
        const items = this.get('items', []);
        
        return items.filter(item => {
            if (filter.status && item.status !== filter.status) return false;
            if (filter.type && item.itemType !== filter.type) return false;
            if (filter.category && item.category !== filter.category) return false;
            if (filter.userEmail && item.userEmail !== filter.userEmail) return false;
            return true;
        }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    addItem(itemData) {
        const items = this.get('items', []);
        const newItem = {
            id: Date.now(),
            ...itemData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'active'
        };
        
        items.unshift(newItem);
        const trimmedItems = items.slice(0, this.maxItems);
        
        return this.set('items', trimmedItems, { backup: true });
    }
    
    updateItem(itemId, updates) {
        const items = this.get('items', []);
        const itemIndex = items.findIndex(item => item.id === itemId);
        
        if (itemIndex === -1) {
            return { success: false, error: 'Item not found' };
        }
        
        items[itemIndex] = {
            ...items[itemIndex],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        
        return this.set('items', items);
    }
    
    deleteItem(itemId) {
        const items = this.get('items', []);
        const filteredItems = items.filter(item => item.id !== itemId);
        return this.set('items', filteredItems);
    }
    
    // Users Management
    getUsers() {
        return this.get('users', []);
    }
    
    addUser(userData) {
        const users = this.getUsers();
        if (users.find(u => u.email === userData.email)) {
            return { success: false, error: 'User exists' };
        }
        
        const newUser = {
            id: Date.now(),
            ...userData,
            createdAt: new Date().toISOString()
        };
        
        users.push(newUser);
        return this.set('users', users);
    }
    
    // Search
    searchItems(query, options = {}) {
        const items = this.getItems(options);
        const searchLower = query.toLowerCase();
        
        return items.filter(item => 
            item.itemName?.toLowerCase().includes(searchLower) ||
            item.description?.toLowerCase().includes(searchLower) ||
            item.location?.toLowerCase().includes(searchLower) ||
            item.category?.toLowerCase().includes(searchLower)
        );
    }
    
    // Stats
    getStats() {
        const items = this.get('items', []);
        const users = this.getUsers();
        
        const stats = {
            totalItems: items.length,
            activeItems: items.filter(i => i.status === 'active').length,
            lostItems: items.filter(i => i.itemType === 'lost').length,
            foundItems: items.filter(i => i.itemType === 'found').length,
            totalUsers: users.length,
            lastSync: new Date().toISOString()
        };
        
        return stats;
    }
    
    // Backup & Recovery
    updateBackup(key, data) {
        const backup = this.getBackup();
        if (data === null) {
            delete backup[key];
        } else {
            backup[key] = data;
        }
        localStorage.setItem(this.getKey(this.backupKey), JSON.stringify(backup));
    }
    
    getBackup() {
        try {
            return JSON.parse(localStorage.getItem(this.getKey(this.backupKey)) || '{}');
        } catch {
            return {};
        }
    }
    
    restoreFromBackup() {
        const backup = this.getBackup();
        const restored = [];
        
        Object.entries(backup).forEach(([key, data]) => {
            if (this.set(key.replace(this.prefix, ''), data, { backup: false }).success) {
                restored.push(key);
            }
        });
        
        console.log(`Restored ${restored.length} items from backup`);
        return restored;
    }
    
    // Auto-backup
    startAutoBackup() {
        setInterval(() => {
            const keys = ['items', 'users'];
            keys.forEach(key => {
                const data = localStorage.getItem(this.getKey(key));
                if (data) this.updateBackup(key, data);
            });
        }, this.syncInterval);
    }
    
    // Cross-tab Sync
    startSync() {
        // Broadcast channel for real-time sync
        if ('BroadcastChannel' in window) {
            this.channel = new BroadcastChannel('lostfound-sync');
            this.channel.onmessage = (e) => {
                if (e.data.action === 'reload') {
                    window.location.reload();
                }
            };
        }
        
        // Storage event listener
        window.addEventListener('storage', (e) => {
            if (e.key && e.key.startsWith(this.prefix)) {
                if (this.channel) {
                    this.channel.postMessage({ action: 'reload' });
                } else {
                    window.location.reload();
                }
            }
        });
    }
    
    // Export/Import
    exportData() {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.prefix)) {
                data[key.replace(this.prefix, '')] = this.deserialize(localStorage.getItem(key));
            }
        }
        return data;
    }
    
    importData(data) {
        Object.entries(data).forEach(([key, value]) => {
            this.set(key, value, { backup: true });
        });
        return { success: true, imported: Object.keys(data).length };
    }
    
    // Clear all data (dangerous!)
    clearAll() {
        if (!confirm('Delete ALL data? This cannot be undone!')) return false;
        
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(this.prefix)) {
                localStorage.removeItem(key);
            }
        });
        return true;
    }
    
    // Serialization with validation
    serialize(data) {
        return JSON.stringify(data);
    }
    
    deserialize(raw) {
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }
    
    // Legacy migration
    migrateLegacyData() {
        // Migrate old data formats
        const oldItems = localStorage.getItem('lostFoundItems');
        if (oldItems && !localStorage.getItem(this.getKey('items'))) {
            this.set('items', JSON.parse(oldItems));
            localStorage.removeItem('lostFoundItems');
        }
    }
    
    // Debug info
    getDebugInfo() {
        return {
            storageUsed: `${(localStorage.length * 100 / 5000).toFixed(1)}%`,
            itemCount: this.getItems().length,
            userCount: this.getUsers().length,
            backupSize: Object.keys(this.getBackup()).length
        };
    }
}

// Global instance
const Storage = new StorageManager({
    prefix: 'LF_',
    maxItems: 500,
    syncInterval: 30000
});

// Usage Examples:
/*
Storage.addItem({
    itemName: 'Lost Wallet',
    itemType: 'lost',
    category: 'Accessories',
    location: 'Library'
});

const stats = Storage.getStats();
console.log(stats);

const items = Storage.searchItems('wallet');
console.log(items);
*/

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
}