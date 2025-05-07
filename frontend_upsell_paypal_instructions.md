# Frontend Instructions: Handling `internal_txn_id` for PayPal Upsells

## 1. Objective

The primary goal is to ensure that the `internal_txn_id`, which links an upsell attempt to the initial PayPal checkout transaction, is correctly passed from the frontend upsell page (e.g., `sites/drivebright/src/app/(checkout)/upsell1/page.tsx`) to the Cloudflare Worker's `/api/upsell` endpoint. This is crucial for resolving potential "Missing previous order ID..." errors from Sticky.io when processing PayPal upsells.

## 2. Making the Page a Client Component

To use React hooks like `useState`, `useEffect`, and `useSearchParams` for handling URL parameters and state, the Next.js page component must be a Client Component. If it's not already, add `'use client';` at the very top of your upsell page file.

```typescript jsx
// Example: sites/drivebright/src/app/(checkout)/upsell1/page.tsx
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// ... rest of your component
```

**Note:** `useSearchParams` should be used within a component wrapped by `<Suspense>` if the page is server-rendered initially and then hydrates on the client. For simplicity in client components, direct usage is often fine.

## 3. Reading `internal_txn_id` from URL on Page Load

When the upsell page loads, the `internal_txn_id` will typically be present as a URL query parameter (e.g., `?internal_txn_id=SOME_PAYPAL_ORDER_ID`).

*   **Use `useSearchParams`:** Import `useSearchParams` from `next/navigation` to access URL query parameters.
*   **Store in State:** Use `useState` to store the retrieved `internal_txn_id`.
*   **Verify:** Use `console.log` to confirm the ID is captured correctly.

```typescript jsx
// Inside your UpsellPage component:

function UpsellPageComponent() {
  const searchParams = useSearchParams();
  const [internalTxnId, setInternalTxnId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const idFromUrl = searchParams.get('internal_txn_id');
    if (idFromUrl) {
      setInternalTxnId(idFromUrl);
      console.log('Captured internal_txn_id from URL:', idFromUrl);
    } else {
      console.warn('internal_txn_id not found in URL parameters.');
      // Optionally, set an error state or redirect if the ID is critical and missing
    }
  }, [searchParams]);

  // ... rest of your component logic
}

// Wrap the component that uses useSearchParams in Suspense if needed
export default function UpsellPage() {
  return (
    <Suspense fallback={<div>Loading upsell...</div>}>
      <UpsellPageComponent />
    </Suspense>
  );
}
```

## 4. Including `internal_txn_id` in the API Request to `/api/upsell`

When the user clicks the "YES! Add To My Order" button (or a similar call-to-action), the `internal_txn_id` must be included in the body of the POST request sent to your worker's `/api/upsell` endpoint.

*   **Modify Fetch Call:** Update the function that handles the API call.
*   **Include in Body:** Add the `internal_txn_id` (from the component's state) to the JSON payload.
*   **Verify Payload:** Use `console.log` to inspect the payload before sending.

```typescript jsx
// Inside your UpsellPageComponent, add a handler function:

const handleUpsellAccept = async () => {
  if (!internalTxnId) {
    setError('Missing internal transaction ID. Cannot proceed with upsell.');
    console.error('Attempted upsell without internal_txn_id.');
    return;
  }

  setIsLoading(true);
  setError(null);

  const upsellPayload = {
    // ... other necessary upsell data (e.g., productId, campaignId, etc.)
    productId: 'YOUR_UPSELL_PRODUCT_ID', // Example
    campaignId: 'YOUR_CAMPAIGN_ID',     // Example
    internal_txn_id: internalTxnId,     // Crucial part!
    // Potentially other customer/order details if needed by the worker
  };

  console.log('Sending payload to /api/upsell:', upsellPayload);

  try {
    const response = await fetch('/api/upsell', { // Or your full worker URL
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(upsellPayload),
    });

    const result = await response.json();
    console.log('Response from /api/upsell:', result);

    // Handle the response (see next section)

  } catch (err) {
    console.error('Error submitting upsell:', err);
    setError('An error occurred while processing your request.');
  } finally {
    setIsLoading(false);
  }
};

// ... in your JSX for the button:
// <button onClick={handleUpsellAccept} disabled={isLoading || !internalTxnId}>
//   {isLoading ? 'Processing...' : 'YES! Add To My Order'}
// </button>
// {error && <p style={{ color: 'red' }}>{error}</p>}
```

## 5. Handling the Response from `/api/upsell`

The frontend needs to appropriately handle the response from the `/api/upsell` endpoint.

*   **Check for `redirect_url`:** If Sticky.io (via your worker) determines that another PayPal approval is needed for the upsell amount, the worker's response should include a `redirect_url`. The frontend must navigate the user to this URL.
*   **Success/Error:** If there's no `redirect_url`, the response might indicate success (e.g., upsell added directly) or an error. Handle these scenarios by displaying appropriate messages to the user or navigating them to a confirmation/thank-you page.

```typescript jsx
// Continuing from the handleUpsellAccept function:

    // ... inside the try block, after const result = await response.json();

    if (result.redirect_url) {
      console.log('Redirecting to PayPal for upsell approval:', result.redirect_url);
      window.location.href = result.redirect_url;
    } else if (response.ok && result.success) { // Assuming your worker sends a success flag
      console.log('Upsell successful:', result);
      // Navigate to a thank you page or show a success message
      // e.g., router.push('/thank-you-upsell');
      alert('Upsell added successfully!');
    } else {
      console.error('Upsell failed or error in response:', result);
      setError(result.message || 'Failed to process upsell. Please try again.');
    }
```

## 6. Example Code Structure (Conceptual)

Here's a simplified structure of what the upsell page component might look like, incorporating the above points.

```typescript jsx
// sites/drivebright/src/app/(checkout)/upsell1/page.tsx
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } // Assuming you use useRouter for navigation
from 'next/navigation';

function UpsellPageComponent() {
  const searchParams = useSearchParams();
  const router = useRouter(); // For Next.js App Router navigation

  const [internalTxnId, setInternalTxnId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Add state for product details if fetched dynamically
  // const [upsellProduct, setUpsellProduct] = useState(null);

  useEffect(() => {
    const idFromUrl = searchParams.get('internal_txn_id');
    if (idFromUrl) {
      setInternalTxnId(idFromUrl);
      console.log('Captured internal_txn_id from URL:', idFromUrl);
    } else {
      console.warn('internal_txn_id not found in URL parameters. Upsell may fail.');
      setError('Required transaction identifier is missing. Please contact support if this issue persists.');
    }

    // Fetch upsell product details here if needed
    // fetchUpsellProductDetails().then(setUpsellProduct);
  }, [searchParams]);

  const handleUpsellAccept = async () => {
    if (!internalTxnId) {
      setError('Critical error: Missing internal transaction ID. Cannot proceed.');
      console.error('handleUpsellAccept called without internal_txn_id.');
      return;
    }
    // Add other validations if necessary (e.g., upsellProduct loaded)

    setIsLoading(true);
    setError(null);

    const payload = {
      // Replace with actual product ID, campaign ID, etc.
      productId: 'UPSELL_PRODUCT_ID_HERE',
      campaignId: 'CAMPAIGN_ID_HERE',
      // Any other data your /api/upsell endpoint expects
      // e.g., customer details if not already known by the worker via session
      internal_txn_id: internalTxnId,
    };

    console.log('Submitting upsell with payload:', payload);

    try {
      const response = await fetch('/api/upsell', { // Adjust endpoint if necessary
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log('/api/upsell response:', result);

      if (result.redirect_url) {
        window.location.href = result.redirect_url; // Redirect for PayPal approval
      } else if (response.ok && result.success) { // Check your API's success criteria
        // Handle successful upsell (e.g., navigate to a thank you page)
        console.log('Upsell processed successfully.');
        router.push('/order-confirmation?upsell=success'); // Example navigation
      } else {
        // Handle API error or unsuccessful upsell
        setError(result.message || 'An error occurred with the upsell.');
        console.error('Upsell processing failed:', result.message || 'Unknown error');
      }
    } catch (e: any) {
      console.error('Fetch error during upsell:', e);
      setError(`Network or server error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpsellDecline = () => {
    console.log('Upsell declined by user.');
    // Navigate to a "no thanks" page or the next step in the funnel
    router.push('/order-confirmation?upsell=declined'); // Example
  };

  // Basic loading/error display
  if (!internalTxnId && !error) { // Still waiting for useEffect to run or ID missing without error set yet
    return <div>Loading upsell information...</div>;
  }

  return (
    <div>
      <h1>Special Upsell Offer!</h1>
      {/* Display upsell product information here */}
      {/* <p>Add {upsellProduct?.name} for just ${upsellProduct?.price}!</p> */}
      <p>Add this amazing product to your order!</p>

      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      <button onClick={handleUpsellAccept} disabled={isLoading || !internalTxnId}>
        {isLoading ? 'Processing...' : 'YES! Add To My Order'}
      </button>
      <button onClick={handleUpsellDecline} disabled={isLoading}>
        No, Thanks
      </button>
    </div>
  );
}

// It's good practice to wrap components using useSearchParams in Suspense
export default function UpsellPage() {
  return (
    <Suspense fallback={<div>Loading page...</div>}>
      <UpsellPageComponent />
    </Suspense>
  );
}

```

Remember to replace placeholder values like `'YOUR_UPSELL_PRODUCT_ID'`, `'YOUR_CAMPAIGN_ID'`, and API endpoint paths with your actual implementation details. The structure of the `payload` sent to `/api/upsell` should match what your worker endpoint expects.