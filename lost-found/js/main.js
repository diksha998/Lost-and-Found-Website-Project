import { getCurrentUser } from './storage.js';
import { updateStats } from './utils.js';

document.addEventListener('DOMContentLoaded', async function() {
    await loadNavbar();
    await loadUserProfile();
    updateStats();
    
    // Mobile menu toggle
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
    }
});

async function loadNavbar() {
    const navbar = document.getElementById('navbar');
    if (navbar) {
        navbar.innerHTML = await fetch('components/navbar.html').then(r => r.text());
        await loadUserProfile();
    }
}

async function loadUserProfile() {
    const user = await getCurrentUser();
    const userNameEl = document.getElementById('userName');
    const userProfileEl = document.getElementById('userProfile');
    
    if (user && userNameEl) {
        userNameEl.textContent = user.name;
    }
    
    if (userProfileEl) {
        userProfileEl.style.display = user ? 'flex' : 'none';
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

window.logout = async function() {
    localStorage.removeItem('lostfound_current_user');
    showMessage('Logged out successfully!', 'success');
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 1000);
};

function showMessage(text, type = 'info') {
    // Global message handler
    const container = document.createElement('div');
    container.className = `message ${type}`;
    container.textContent = text;
    document.body.appendChild(container);
    
    setTimeout(() => {
        container.remove();
    }, 4000);
}