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

// Load KV entries for a specific site and setup filters/listeners
async function loadKVEntriesAndSetup(siteId) {
    if (!siteId) {
        console.error("No siteId provided to loadKVEntriesAndSetup");
        // Optionally clear the table or show a message
        const tableBody = document.getElementById('kv-entries');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="3">Please select a site.</td></tr>';
        }
        allKVEntries = []; // Clear stored data
        return;
    }

    console.log(`Loading KV entries for site: ${siteId}`);
    try {
        const response = await authFetch(`/admin/api/kv/list?siteId=${siteId}`); // Fetch for the specified site
        allKVEntries = response.data || []; // Extract the data array
        renderTable(allKVEntries); // Render the table with new data

        // Ensure filter/bulk listeners are attached (only needs to happen once, really)
        // Consider moving listener setup outside this function if it causes issues
        const filterInput = document.getElementById('kv-filter');
        if (filterInput && !filterInput.dataset.listenerAttached) {
            filterInput.addEventListener('input', filterTable);
            filterInput.dataset.listenerAttached = 'true'; // Mark as attached
        }
        const bulkEditBtn = document.getElementById('bulk-edit-btn');
        if (bulkEditBtn && !bulkEditBtn.dataset.listenerAttached) {
            bulkEditBtn.addEventListener('click', () => alert('Bulk Edit functionality not yet implemented.'));
            bulkEditBtn.dataset.listenerAttached = 'true'; // Mark as attached
        }

    } catch (error) {
        console.error(`Error loading KV entries for site ${siteId}:`, error);
        const tableBody = document.getElementById('kv-entries');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="3">Error loading data for site ${siteId}.</td></tr>`;
        }
        allKVEntries = []; // Clear data on error
    }
}

// Populate site dropdown and load initial data
async function initializeSiteSelector() {
    const siteSelect = document.getElementById('site-select');
    if (!siteSelect) return; // Exit if dropdown doesn't exist

    try {
        const sitesResponse = await authFetch('/admin/api/sites');
        const sites = sitesResponse.data || [];

        if (sites.length === 0) {
             siteSelect.innerHTML = '<option value="">No sites found</option>';
             loadKVEntriesAndSetup(null); // Load with null to show message
             return;
        }

        // Populate dropdown
        sites.forEach(siteId => {
            const option = document.createElement('option');
            option.value = siteId;
            option.textContent = siteId;
            siteSelect.appendChild(option);
        });

        // Set default selection (e.g., 'siteA' if it exists, otherwise the first site)
        const defaultSite = sites.includes('siteA') ? 'siteA' : sites[0];
        siteSelect.value = defaultSite;

        // Add event listener to load data on change
        siteSelect.addEventListener('change', (event) => {
            loadKVEntriesAndSetup(event.target.value);
        });

        // Load initial data for the default site
        loadKVEntriesAndSetup(defaultSite);

    } catch (error) {
        console.error("Error initializing site selector:", error);
        siteSelect.innerHTML = '<option value="">Error loading sites</option>';
        loadKVEntriesAndSetup(null); // Load with null to show message
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
        // HTML elements (dropdown, filter, button) are now part of the static HTML template
        // Initialize the site selector, which will then load initial KV data
        initializeSiteSelector();
    }
});