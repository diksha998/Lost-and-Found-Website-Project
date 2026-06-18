// add-item.js - Add Item Form Controller
class AddItemController {
    constructor() {
        this.form = document.getElementById('addItemForm');
        this.submitBtn = document.getElementById('submitBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.imageUpload = document.getElementById('imageUpload');
        this.imageInput = document.getElementById('imageInput');
        this.imagePreview = document.getElementById('imagePreview');
        this.typeBtns = document.querySelectorAll('.type-btn');
        this.itemTypeInput = document.getElementById('itemType');
        this.messages = {
            success: document.getElementById('successMsg'),
            error: document.getElementById('errorMsg')
        };
        
        this.maxImageSize = 5 * 1024 * 1024; // 5MB
        this.supportedFormats = ['image/jpeg', 'image/png', 'image/webp'];
        
        this.init();
    }
    
    init() {
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }
        
        this.setupEventListeners();
        this.setDefaultDate();
        this.updateFormUI();
    }
    
    setupEventListeners() {
        // Form submission
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Type toggle
        this.typeBtns.forEach(btn => {
            btn.addEventListener('click', () => this.toggleType(btn));
        });
        
        // Image upload
        this.imageUpload.addEventListener('click', () => this.imageInput.click());
        this.imageInput.addEventListener('change', (e) => this.handleImageUpload(e));
        
        // Drag & drop
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
            this.imageUpload.addEventListener(event, (e) => e.preventDefault());
        });
        
        this.imageUpload.addEventListener('dragenter', () => this.imageUpload.classList.add('dragover'));
        this.imageUpload.addEventListener('dragleave', () => this.imageUpload.classList.remove('dragover'));
        this.imageUpload.addEventListener('drop', (e) => this.handleDrop(e));
        
        // Reset button
        this.resetBtn.addEventListener('click', () => this.resetForm());
        
        // Real-time validation
        this.form.querySelectorAll('input[required], select[required]').forEach(field => {
            field.addEventListener('blur', () => this.validateField(field));
            field.addEventListener('input', () => this.validateField(field));
        });
    }
    
    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('date').value = today;
    }
    
    toggleType(activeBtn) {
        this.typeBtns.forEach(btn => btn.classList.remove('active'));
        activeBtn.classList.add('active');
        this.itemTypeInput.value = activeBtn.dataset.type;
        this.updateFormUI();
    }
    
    updateFormUI() {
        const type = this.itemTypeInput.value;
        const title = document.querySelector('.page-title');
        if (title) {
            title.textContent = type === 'lost' ? 'Report Lost Item' : 'Report Found Item';
        }
    }
    
    handleImageUpload(e) {
        const file = e.target.files[0];
        if (file) {
            this.processImage(file);
        }
    }
    
    handleDrop(e) {
        this.imageUpload.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.imageInput.files = files;
            this.processImage(files[0]);
        }
    }
    
    processImage(file) {
        // Validate format
        if (!this.supportedFormats.includes(file.type)) {
            this.showMessage('Please upload JPEG, PNG, or WebP images only', false);
            return;
        }
        
        // Validate size
        if (file.size > this.maxImageSize) {
            this.showMessage('Image size must be less than 5MB', false);
            return;
        }
        
        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            this.imagePreview.innerHTML = `
                <div class="image-preview-content">
                    <img src="${e.target.result}" alt="Preview">
                    <button type="button" class="remove-image" title="Remove image">✕</button>
                </div>
            `;
            this.imagePreview.style.display = 'block';
            
            // Remove image handler
            this.imagePreview.querySelector('.remove-image').addEventListener('click', () => {
                this.imagePreview.style.display = 'none';
                this.imagePreview.innerHTML = '';
                this.imageInput.value = '';
            });
        };
        reader.readAsDataURL(file);
        
        // Store compressed image for storage
        this.compressImage(file).then(compressed => {
            this.compressedImage = compressed;
        });
    }
    
    async compressImage(file, quality = 0.8) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                // Max dimensions
                const maxWidth = 800;
                const maxHeight = 600;
                
                let { width, height } = img;
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob(resolve, file.type, quality);
            };
            
            img.src = URL.createObjectURL(file);
        });
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        // Validate form
        if (!this.validateForm()) return;
        
        // Show loading
        this.submitBtn.disabled = true;
        this.submitBtn.innerHTML = '⏳ Submitting...';
        
        try {
            const formData = new FormData(this.form);
            const itemData = Object.fromEntries(formData);
            
            // Add image if available
            if (this.compressedImage) {
                itemData.image = await this.blobToBase64(this.compressedImage);
            }
            
            // Save item
            const result = Storage.addItem(itemData);
            
            if (result.success) {
                this.showMessage('✅ Item reported successfully! Redirecting...', true);
                
                // Broadcast update
                if ('BroadcastChannel' in window) {
                    new BroadcastChannel('lostfound-sync').postMessage({
                        action: 'itemAdded',
                        item: result.data
                    });
                }
                
                // Reset and redirect
                setTimeout(() => {
                    this.resetForm();
                    window.location.href = 'index.html';
                }, 1500);
                
            } else {
                throw new Error('Failed to save item');
            }
            
        } catch (error) {
            this.showMessage('❌ Failed to submit item. Please try again.', false);
            console.error('Add item error:', error);
        } finally {
            this.submitBtn.disabled = false;
            this.submitBtn.innerHTML = 'Submit Report';
        }
    }
    
    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
    
    validateForm() {
        const fields = this.form.querySelectorAll('[required]');
        let isValid = true;
        
        fields.forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });
        
        return isValid;
    }
    
    validateField(field) {
        const value = field.value.trim();
        const isValid = value.length > 0;
        
        field.classList.toggle('invalid', !isValid);
        field.classList.toggle('valid', isValid);
        
        return isValid;
    }
    
    resetForm() {
        this.form.reset();
        this.imagePreview.style.display = 'none';
        this.imagePreview.innerHTML = '';
        this.imageInput.value = '';
        this.compressedImage = null;
        
        // Reset UI
        this.typeBtns[0].classList.add('active');
        this.typeBtns[1].classList.remove('active');
        this.itemTypeInput.value = 'lost';
        this.setDefaultDate();
        
        // Clear validation
        this.form.querySelectorAll('.form-control').forEach(field => {
            field.classList.remove('valid', 'invalid');
        });
    }
    
    showMessage(text, isSuccess = true) {
        const msg = isSuccess ? this.messages.success : this.messages.error;
        const otherMsg = isSuccess ? this.messages.error : this.messages.success;
        
        otherMsg.style.display = 'none';
        msg.textContent = text;
        msg.style.display = 'block';
        
        if (isSuccess) {
            setTimeout(() => msg.style.display = 'none', 4000);
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new AddItemController();
});

// Export for manual use
window.AddItemController = AddItemController;