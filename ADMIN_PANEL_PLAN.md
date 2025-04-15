# Admin Panel Redesign Plan

## Problem
The current admin panel implementation with separate admin.js file is causing 500 errors. The architecture is too complex with multiple points of failure.

## Solution
Create a single, self-contained admin interface with embedded JavaScript that's more resilient and easier to debug.

## Implementation Details

### 1. Single HTML File Approach
- Combine all JavaScript into the main admin HTML template
- Eliminate separate admin.js file
- Embed all styles in the HTML
- Use minimal external dependencies

### 2. Core Features
- Login/Authentication
- Site selector
- KV store editor
- Filtering and search
- Error handling with user feedback

### 3. Code Structure
```javascript
// 1. Authentication
- Store token in localStorage
- Add token to all API requests
- Handle 401 responses

// 2. API Communication
- Centralized fetch wrapper
- Built-in error handling
- Automatic token management

// 3. UI Components
- Site selector dropdown
- KV entry table
- Filter input
- Action buttons (edit/delete)

// 4. Error Handling
- Clear error messages
- Status feedback
- Automatic retry logic
```

### 4. API Endpoints
- `/admin/api/auth/login` - Authentication
- `/admin/api/sites` - List available sites
- `/admin/api/kv/list` - List KV entries
- `/admin/api/kv/{key}` - CRUD operations

## Next Steps
1. Hand off to Code mode to implement the new admin HTML template
2. Remove admin.js file and related routes
3. Update router to serve single HTML file
4. Test authentication and KV operations
5. Verify CORS and error handling

## Benefits
- Simpler architecture
- Easier debugging
- Fewer points of failure
- Better error visibility
- Improved maintainability