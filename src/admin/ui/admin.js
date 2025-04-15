let allKVEntries = []; // Store all entries for filtering

// Get auth token from localStorage
function getAuthToken() {
    return localStorage.getItem('adminToken');
}

// Make authenticated fetch request
async function authFetch(url, options = {}) {
    const token = getAuthToken();
    if (!token) {
        window.location.href = '/admin/login'; // Redirect if no token
        return Promise.reject('No auth token found'); // Return a rejected promise
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {})
    };

    try {
        const response = await fetch(url, { ...options, headers });

        if (response.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('adminToken');
            window.location.href = '/admin/login';
            return Promise.reject('Unauthorized'); // Return a rejected promise
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        // Handle cases where response might be empty (e.g., DELETE)
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return await response.json();
        } else {
            return { success: true }; // Assume success for non-JSON responses if status is OK
        }
    } catch (error) {
        console.error('Fetch error:', error);
        alert(`An error occurred: ${error.message}. Please try again.`);
        throw error; // Re-throw error for further handling if needed
    }
}

// Render table rows based on provided data
function renderTable(data) {
    const tableBody = document.getElementById('kv-entries');
    tableBody.innerHTML = ''; // Clear existing rows

    if (!data || data.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="3">No entries found.</td>';
        tableBody.appendChild(row);
        return;
    }

    data.forEach(entry => {
        const row = document.createElement('tr');
        // Ensure value is displayed correctly, even if null/undefined
        const displayValue = entry.value !== null && entry.value !== undefined ? entry.value : 'N/A';
        row.innerHTML = `
            <td>${entry.name}</td>
            <td>${displayValue}</td>
            <td>
                <button class="action-btn edit-btn" onclick="editKey('${entry.name}', '${displayValue}')">Edit</button>
                <button class="action-btn delete-btn" onclick="deleteKey('${entry.name}')">Delete</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Filter table data
function filterTable() {
    const filterValue = document.getElementById('kv-filter').value.toLowerCase();
    const filteredData = allKVEntries.filter(entry =>
        entry.name.toLowerCase().includes(filterValue) ||
        (entry.value && entry.value.toLowerCase().includes(filterValue))
    );
    renderTable(filteredData);
}

// Load KV entries and setup filter
async function loadKVEntriesAndSetup() {
    try {
        // Add siteId=site1 to the API call for testing
        const response = await authFetch('/admin/api/kv/list?siteId=site1'); // Fetch the wrapped response for site1
        allKVEntries = response.data || []; // Extract the data array, default to empty array if missing
        renderTable(allKVEntries); // Initial render

        // Setup filter input if not already present
        const filterContainer = document.querySelector('.filter-container');
        if (filterContainer) { // Check if elements exist before adding listener
             const filterInput = document.getElementById('kv-filter');
             if (filterInput) {
                filterInput.addEventListener('input', filterTable);
             }
             const bulkEditBtn = document.getElementById('bulk-edit-btn');
             if (bulkEditBtn) {
                bulkEditBtn.addEventListener('click', () => alert('Bulk Edit functionality not yet implemented.'));
             }
        }

    } catch (error) {
        // Error handling is done within authFetch, but log here if needed
        console.error('Error loading KV entries:', error);
        // Optionally display an error message in the UI
        const tableBody = document.getElementById('kv-entries');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="3">Error loading data. Please check console or try again.</td></tr>';
        }
    }
}


// Edit key - Pass current value to pre-fill prompt
async function editKey(key, currentValue) {
    const newValue = prompt(`Enter new value for ${key}:`, currentValue);
    if (newValue !== null) { // Check if user cancelled prompt
        try {
            await authFetch(`/admin/api/kv/${key}`, {
                method: 'PUT',
                body: JSON.stringify({ value: newValue })
            });
            // Re-fetch data to reflect changes accurately
            await loadKVEntriesAndSetup();
        } catch (error) {
            console.error(`Error updating key ${key}:`, error);
            // Error alert is handled in authFetch
        }
    }
}

// Delete key
async function deleteKey(key) {
    if (confirm(`Are you sure you want to delete key: ${key}?`)) {
        try {
            await authFetch(`/admin/api/kv/${key}`, {
                method: 'DELETE'
            });
            // Re-fetch data to reflect deletion
            await loadKVEntriesAndSetup();
        } catch (error) {
            console.error(`Error deleting key ${key}:`, error);
            // Error alert is handled in authFetch
        }
    }
}

// Initial load on page ready
document.addEventListener('DOMContentLoaded', () => {
    if (!getAuthToken()) {
        window.location.href = '/admin/login';
    } else {
        // Add filter/bulk elements dynamically before loading data
        const table = document.querySelector('.kv-table');
        if (table && !document.querySelector('.filter-container')) { // Prevent adding multiple times
            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'filter-container'; // Use this class for styling
            controlsDiv.innerHTML = `
                <input type="text" id="kv-filter" placeholder="Filter by key or value..." class="filter-input">
                <button id="bulk-edit-btn" class="action-btn bulk-edit-btn">Bulk Edit</button>
            `;
            table.parentNode.insertBefore(controlsDiv, table);
        }
        loadKVEntriesAndSetup(); // Load data and setup listeners
    }
});