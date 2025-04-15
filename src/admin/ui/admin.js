// Get auth token from localStorage
function getAuthToken() {
    return localStorage.getItem('adminToken');
}

// Make authenticated fetch request
async function authFetch(url, options = {}) {
    const token = getAuthToken();
    if (!token) {
        window.location.href = '/admin/login';
        return;
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
    };

    try {
        const response = await fetch(url, { ...options, headers });
        
        if (response.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('adminToken');
            window.location.href = '/admin/login';
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Fetch error:', error);
        alert('An error occurred. Please try again.');
        throw error;
    }
}

// Load KV entries
async function loadKVEntries() {
    try {
        const data = await authFetch('/admin/api/kv/list');
        
        const tableBody = document.getElementById('kv-entries');
        tableBody.innerHTML = '';
        
        data.forEach(entry => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${entry.name}</td>
                <td>${entry.value || 'N/A'}</td>
                <td>
                    <button class="action-btn edit-btn" onclick="editKey('${entry.name}')">Edit</button>
                    <button class="action-btn delete-btn" onclick="deleteKey('${entry.name}')">Delete</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading KV entries:', error);
    }
}

// Edit key
async function editKey(key) {
    const newValue = prompt('Enter new value:');
    if (newValue !== null) {
        try {
            await authFetch(`/admin/api/kv/${key}`, {
                method: 'PUT',
                body: JSON.stringify({ value: newValue })
            });
            loadKVEntries();
        } catch (error) {
            console.error('Error updating key:', error);
        }
    }
}

// Delete key
async function deleteKey(key) {
    if (confirm(`Are you sure you want to delete ${key}?`)) {
        try {
            await authFetch(`/admin/api/kv/${key}`, {
                method: 'DELETE'
            });
            loadKVEntries();
        } catch (error) {
            console.error('Error deleting key:', error);
        }
    }
}

// Load entries on page load
document.addEventListener('DOMContentLoaded', () => {
    if (!getAuthToken()) {
        window.location.href = '/admin/login';
    } else {
        loadKVEntries();
    }
});