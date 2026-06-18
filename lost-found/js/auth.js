import { saveUser, getUsers, setCurrentUser, getCurrentUser, clearAuth } from './storage.js';

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    setupAuthListeners();
});

function checkAuth() {
    const currentUser = getCurrentUserId();
    const protectedPages = ['index.html', 'add-item.html', 'view-items.html', 'item-details.html'];
    const currentPath = window.location.pathname.split('/').pop();

    if (protectedPages.includes(currentPath) && !currentUser) {
        window.location.href = 'login.html';
    } else if (currentPath === 'login.html' || currentPath === 'register.html') {
        if (currentUser) {
            window.location.href = 'index.html';
        }
    }
}

function setupAuthListeners() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

window.login = async function(email, password) {
    const users = await getUsers();
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
        setCurrentUser(user.id);
        showMessage('Login successful!', 'success');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
        return true;
    } else {
        showMessage('Invalid credentials!', 'error');
        return false;
    }
};

window.register = async function(name, email, password) {
    const users = await getUsers();
    if (users.find(u => u.email === email)) {
        showMessage('Email already registered!', 'error');
        return false;
    }

    const user = {
        id: Date.now().toString(),
        name,
        email,
        password,
        joined: new Date().toISOString()
    };

    await saveUser(user);
    showMessage('Registration successful! Please login.', 'success');
    
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 1500);
    return true;
};

window.logout = function() {
    clearAuth();
    showMessage('Logged out successfully!', 'success');
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 1000);
};

function showMessage(text, type = 'info') {
    const messageDivs = document.querySelectorAll('#loginMessage, #registerMessage, #addItemMessage');
    messageDivs.forEach(div => {
        div.innerHTML = `<div class="message ${type}">${text}</div>`;
        setTimeout(() => {
            div.innerHTML = '';
        }, 5000);
    });
}

// Form handlers
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        await window.login(email, password);
    });
}

if (document.getElementById('registerForm')) {
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('regName').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        await window.register(name, email, password);
    });
}