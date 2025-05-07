i'm getting this error when paypal checkout finished for the first intial and redirects it.
 if the initial is a paypal checkout then the upsells all will also be paypapl, 
 they don't need to follow the other method to pay via needing past order id or the gateway. 

 thisi s a different flow, maybe you have to update the site to intake this, if the checkout page uses paypal then the upsells will also use the paypl method for all upsells. 

 no 'im telling you we don't need the order id and gateway id for the upsell, that paypal flow for an upsell will use the api post new_order from stickyio, it wont use the normal new_upsell api call. this is a paypapl flow. just need to know what the intial checkout was creditCardType = paypal then all buttons should use the same checkout for paypal, which is the redirect to their page then come back to the next upsell page, upsell2 and upsell3, then the last one is a thank you page but can vary based on site so better to have this dynamic. 

you have acess to edit and read any file in any workspace:
this is the checkout page C:\Users\88Devs\Documents\VsCode\tech-ecom\ecommerce-monorepo\sites\drivebright\src\app\page.tsx
C:\Users\88Devs\Documents\VsCode\tech-ecom\ecommerce-monorepo\sites\drivebright\src\app\(checkout)\upsell1\page.tsx
i think this handles - C:\Users\88Devs\Documents\VsCode\cloudflare-worker-pixel-router\src\handlers\checkout.ts

upsells are here - C:\Users\88Devs\Documents\VsCode\tech-ecom\ecommerce-monorepo\sites\drivebright\src\app\(checkout)

this is the error: 

[RootLayout] Rendering or Re-rendering 2025-05-06T23:19:39.718Z
C:\Users\88Devs\Docu…c\app\layout.tsx:29 [RootLayout] Rendering or Re-rendering 2025-05-06T23:19:39.718Z
C:\Users\88Devs\Docu…ckoutContext.tsx:61 [CheckoutProvider] Mounting 2025-05-06T23:19:39.720Z
C:\Users\88Devs\Docu…ckoutContext.tsx:61 [CheckoutProvider] Mounting 2025-05-06T23:19:39.721Z
C:\Users\88Devs\Docu…rc\app\page.tsx:391 Image with src "/images/imag1.png" has a "loader" property that does not implement width. Please implement it or use the "unoptimized" property instead.
Read more: https://nextjs.org/docs/messages/next-image-missing-loader-width
C:\Users\88Devs\Docu…rc\app\page.tsx:345 Image with src "http://localhost:3000/https://purpleassets.blob.core.windows.net/web/all/lock.png" has either width or height modified, but not the other. If you use CSS to change the size of your image, also include the styles 'width: "auto"' or 'height: "auto"' to maintain the aspect ratio.
C:\Users\88Devs\Docu…rc\app\page.tsx:385 Image with src "http://localhost:3000/https://purpleassets.blob.core.windows.net/web/all/rating-star.png" has either width or height modified, but not the other. If you use CSS to change the size of your image, also include the styles 'width: "auto"' or 'height: "auto"' to maintain the aspect ratio.
C:\Users\88Devs\Docu…oductOptions.tsx:70 Image with src "http://localhost:3000/https://purpleassets.blob.core.windows.net/web/all/star.png" has either width or height modified, but not the other. If you use CSS to change the size of your image, also include the styles 'width: "auto"' or 'height: "auto"' to maintain the aspect ratio.
C:\Users\88Devs\Docu…ckoutContext.tsx:78 [CheckoutContext Effect] Initializing state from sessionStorage: 
{storedTxnId: 'f9d91bae-ce69-434e-bf78-951d5f866392', storedContext: false}
C:\Users\88Devs\Docu…\app\layout.tsx:106 [RootLayout] Effect Mount
C:\Users\88Devs\Docu…\app\layout.tsx:110 [Main Thread] Fetching page pixels...
C:\Users\88Devs\Docu…\app\layout.tsx:139 [Main Thread] Calling http://127.0.0.1:8787/api/page-pixels with payload: 
{siteId: 'drivebright', url: 'http://localhost:3000/', affid: null, c1: null, campid: null, …}
C:\Users\88Devs\Docu…ckoutContext.tsx:61 [CheckoutProvider] Mounting 2025-05-06T23:19:39.767Z
C:\Users\88Devs\Docu…ckoutContext.tsx:61 [CheckoutProvider] Mounting 2025-05-06T23:19:39.768Z
C:\Users\88Devs\Docu…CheckoutForm.tsx:97 NEXT_PUBLIC_PIXEL_WORKER_URL: http://127.0.0.1:8787
C:\Users\88Devs\Docu…router-client.ts:66 PixelRouterClient initialized with worker URL: http://127.0.0.1:8787/, Site ID: drivebright, Sticky ID: 1
C:\Users\88Devs\Docu…CheckoutForm.tsx:97 NEXT_PUBLIC_PIXEL_WORKER_URL: http://127.0.0.1:8787
C:\Users\88Devs\Docu…router-client.ts:66 PixelRouterClient initialized with worker URL: http://127.0.0.1:8787/, Site ID: drivebright, Sticky ID: 1
C:\Users\88Devs\Docu…CheckoutForm.tsx:97 NEXT_PUBLIC_PIXEL_WORKER_URL: http://127.0.0.1:8787
C:\Users\88Devs\Docu…router-client.ts:66 PixelRouterClient initialized with worker URL: http://127.0.0.1:8787/, Site ID: drivebright, Sticky ID: 1
C:\Users\88Devs\Docu…CheckoutForm.tsx:97 NEXT_PUBLIC_PIXEL_WORKER_URL: http://127.0.0.1:8787
C:\Users\88Devs\Docu…router-client.ts:66 PixelRouterClient initialized with worker URL: http://127.0.0.1:8787/, Site ID: drivebright, Sticky ID: 1
C:\Users\88Devs\Docu…ckoutActions.tsx:75 Image with src "/images/paypal-logo.png" has a "loader" property that does not implement width. Please implement it or use the "unoptimized" property instead.
Read more: https://nextjs.org/docs/messages/next-image-missing-loader-width
on-recoverable-error.js:28 Uncaught Error: Hydration failed because the server rendered HTML didn't match the client. As a result this tree will be regenerated on the client. This can happen if a SSR-ed Client Component used:

- A server/client branch `if (typeof window !== 'undefined')`.
- Variable input such as `Date.now()` or `Math.random()` which changes each time it's called.
- Date formatting in a user's locale which doesn't match the server.
- External changing data without sending a snapshot of it along with the HTML.
- Invalid HTML tag nesting.

It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.

https://react.dev/link/hydration-mismatch

  ...
    <main id="vueApp">
      <div>
      <div>
      <div className="main-middl...">
        <div className="container ...">
          <div className="flex flex-...">
            <div className="w-full lg:...">
              <div className="left">
                <div>
                <div>
                <div>
                  <h4>
                  <div>
                  <div>
                  <h4>
                  <p>
                  <Suspense fallback={<div>}>
                    <CheckoutForm initialProductDetails={{id:"driveb...", ...}} additionalProductIds={[...]}>
                      <div className="checkout-f...">
                        <form id="myForm" onSubmit={function submitForm} name="downsell_f..." acceptCharset="utf-8" ...>
                          <input>
                          <input>
                          <input>
                          <input>
                          <input>
                          <ShippingAddress customerEmail="" setCustomerEmail={function bound dispatchSetState} ...>
                            <div className="space-y-4">
                              <h2>
                              <div className="relative">
                                <input>
                                <label>
+                               <span data-valmsg-for="Customer.Email" className="text-red-500 text-xs italic">
-                               <div
-                                 data-lastpass-icon-root=""
-                                 style={{position:"relative",height:"0px",width:"0px",float:"left"}}
-                               >
                              ...
                          ...
                ...
              ...
            ...
          ...
        ...
      ...

    at ShippingAddress (C:\Users\88Devs\Docu…ngAddress.tsx:65:17)
    at CheckoutForm (C:\Users\88Devs\Docu…ckoutForm.tsx:503:9)
    at HomePage (C:\Users\88Devs\Docu…app\page.tsx:446:25)
C:\Users\88Devs\Docu…koutContext.tsx:209 [CheckoutContext] Clearing Context
C:\Users\88Devs\Docu…koutContext.tsx:107 [CheckoutContext] Setting Internal Transaction ID: f259a98e-0a04-4093-ac4b-0ca82ee82160
C:\Users\88Devs\Docu…heckoutForm.tsx:119 Generated internalTxnId: f259a98e-0a04-4093-ac4b-0ca82ee82160
C:\Users\88Devs\Docu…ckoutContext.tsx:61 [CheckoutProvider] Mounting 2025-05-06T23:19:39.804Z
C:\Users\88Devs\Docu…ckoutContext.tsx:61 [CheckoutProvider] Mounting 2025-05-06T23:19:39.804Z
C:\Users\88Devs\Docu…rc\app\page.tsx:391 Image with src "http://localhost:3000/images/imag1.png" has either width or height modified, but not the other. If you use CSS to change the size of your image, also include the styles 'width: "auto"' or 'height: "auto"' to maintain the aspect ratio.
C:\Users\88Devs\Docu…ckoutContext.tsx:61 [CheckoutProvider] Mounting 2025-05-06T23:19:39.814Z
C:\Users\88Devs\Docu…ckoutContext.tsx:61 [CheckoutProvider] Mounting 2025-05-06T23:19:39.814Z
C:\Users\88Devs\Docu…\app\layout.tsx:151 [Main Thread] Received actions from backend: 
[]
C:\Users\88Devs\Docu…ckoutContext.tsx:61 [CheckoutProvider] Mounting 2025-05-06T23:19:39.823Z
C:\Users\88Devs\Docu…ckoutContext.tsx:61 [CheckoutProvider] Mounting 2025-05-06T23:19:39.823Z
C:\Users\88Devs\Docu…heckoutForm.tsx:128 Calling decideCampaign...
C:\Users\88Devs\Docu…heckoutForm.tsx:141 Calling decideCampaign with payload: 
{siteId: 'drivebright'}
C:\Users\88Devs\Docu…router-client.ts:90 [PixelRouterClient] Calling decideCampaign: http://127.0.0.1:8787/api/decide-campaign with payload: 
{siteId: 'drivebright', internal_txn_id: 'f259a98e-0a04-4093-ac4b-0ca82ee82160'}
C:\Users\88Devs\Docu…outer-client.ts:108 [PixelRouterClient] decideCampaign response: 
{targetCampaignId: '431', internal_txn_id: 'f259a98e-0a04-4093-ac4b-0ca82ee82160'}
C:\Users\88Devs\Docu…heckoutForm.tsx:147 Target Campaign ID: 431
C:\Users\88Devs\Docu…koutContext.tsx:120 [CheckoutContext] Setting Target Campaign ID: 431
C:\Users\88Devs\Docu…ckoutContext.tsx:61 [CheckoutProvider] Mounting 2025-05-06T23:19:39.903Z
C:\Users\88Devs\Docu…ckoutContext.tsx:61 [CheckoutProvider] Mounting 2025-05-06T23:19:39.903Z
paypal-logo.png:1 
 GET http://localhost:3000/images/paypal-logo.png 404 (Not Found)
ssl-safe.png:1 
 GET http://localhost:3000/https:/purpleassets.blob.core.windows.net/web/all/ssl-safe.png 404 (Not Found)
:3000/https:/purplea…safe-checkout.png:1 
 GET http://localhost:3000/https:/purpleassets.blob.core.windows.net/web/all/safe-checkout.png 404 (Not Found)
encrypted.png:1 
 GET http://localhost:3000/https:/purpleassets.blob.core.windows.net/web/all/encrypted.png 404 (Not Found)
C:\Users\88Devs\Docu…heckoutForm.tsx:380 PayPal button clicked
C:\Users\88Devs\Docu…heckoutForm.tsx:457 Initiating PayPal checkout via PixelRouterClient: 
{internalTxnId: 'f259a98e-0a04-4093-ac4b-0ca82ee82160', targetCampaignId: '431'}
C:\Users\88Devs\Docu…outer-client.ts:130 [PixelRouterClient] Calling submitCheckout: http://127.0.0.1:8787/
C:\Users\88Devs\Docu…outer-client.ts:140 [PixelRouterClient] submitCheckout payload: 
{siteId: 'drivebright', customer: {…}, payment: {…}, products: Array(1), hasCoverageUpsell: false, …}
C:\Users\88Devs\Docu…outer-client.ts:184 [PixelRouterClient] submitCheckout success response: 
{success: true, redirectUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=80114449FP860854U'}
C:\Users\88Devs\Docu…heckoutForm.tsx:469 Redirecting to PayPal: https://www.sandbox.paypal.com/checkoutnow?token=80114449FP860854U
Navigated to https://www.sandbox.paypal.com/checkoutnow?token=80114449FP860854U
dev-build-indicator.js:9 
{entry: {…}, content: 'content-manifest.c38dec1e84e450506640bfad7267bd83.json', initialDataQuery: 'initialDataQuery.f18385ecfb2b107510d681ccb6a4edf2.graphql', shellDataQuery: null, coreDataQuery: null, …}
10
A preload for '<URL>' is found, but is not used because the request credentials mode does not match. Consider taking a look at crossorigin attribute.
require-instrumentation-client.js:71 Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source of script in the following Content Security Policy directive: "script-src 'nonce-fUm/eji0OL1QrhE0lYOOfTqLNXiegbyi+0u+yN7kKmbb4tL7' 'self' https://*.paypal.com https://*.paypal.cn https://*.paypalobjects.com https://objects.paypal.cn https://www.gstatic.com https://*.synchronycredit.com https://synchronycredit.com 'unsafe-inline' https://www.datadoghq-browser-agent.com https://static.novacredit.com".
require-instrumentation-client.js:71 Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source of script in the following Content Security Policy directive: "script-src 'nonce-fUm/eji0OL1QrhE0lYOOfTqLNXiegbyi+0u+yN7kKmbb4tL7' 'self' https://*.paypal.com https://*.paypal.cn https://*.paypalobjects.com https://objects.paypal.cn https://www.gstatic.com https://*.synchronycredit.com https://synchronycredit.com 'unsafe-inline' https://www.datadoghq-browser-agent.com https://static.novacredit.com".
encode-uri-path.js:1 Datadog Browser SDK: service value doesn't meet tag requirements and will be sanitized. More details: https://docs.datadoghq.com/getting_started/tagging/#defining-tags


wrangle console outputs

[CheckoutHandler] Using Sticky Base URL: https://techcommerceunlimited.sticky.io/api/v1 for ID: 1                                                    
[CheckoutHandler] Processing checkout for f259a98e-0a04-4093-ac4b-0ca82ee82160                                                                       
[CheckoutHandler] Determined payment method: paypal                                                                                                  
[CheckoutHandler] Updated paymentMethod_Initial to paypal for f259a98e-0a04-4093-ac4b-0ca82ee82160
[CheckoutHandler] PayPal payment method selected, adding required fields.
[CheckoutHandler] Mapping product item from frontend: {"id":"drivebright-double","product_id":150,"offer_id":1,"billing_model_id":2,"quantity":2,"ship_id":4,"price":49.99}
[CheckoutHandler] 'siteBaseUrl' from payload is missing or invalid ('undefined'). Attempting to use 'Origin' header.
[CheckoutHandler] Using 'Origin' header for siteBaseUrl: http://localhost:3000
[CheckoutHandler] Setting alt_pay_return_url for PayPal to: http://localhost:3000/upsell1?internal_txn_id=f259a98e-0a04-4093-ac4b-0ca82ee82160       
[CheckoutHandler] Sending campaignId to Sticky.io: 431
[CheckoutHandler] Final payloadToSend to Sticky: {
  "firstName": "",
  "lastName": "",
  "billingFirstName": "",
  "billingLastName": "",
  "billingAddress1": "",
  "billingAddress2": "",
  "billingCity": "",
  "billingState": "",
  "billingZip": "",
  "billingCountry": "US",
  "phone": "",
  "email": "",
  "shippingId": 4,
  "shippingAddress1": "",
  "shippingAddress2": "",
  "shippingCity": "",
  "shippingState": "",
  "shippingZip": "",
  "shippingCountry": "US",
  "billingSameAsShipping": "NO",
  "tranType": "Sale",
  "campaignId": "431",
  "offers": [
    {
      "product_id": 150,
      "offer_id": 1,
      "billing_model_id": 2,
      "quantity": 2,
      "priceRate": 49.99,
      "discountPrice": 49.99,
      "regPrice": 49.99,
      "shipPrice": 0,
      "price": 49.99
    }
  ],
  "ipAddress": "127.0.0.1",
  "preserve_gateway": "1",
  "creditCardType": "paypal",
  "alt_pay_return_url": "http://localhost:3000/upsell1?internal_txn_id=f259a98e-0a04-4093-ac4b-0ca82ee82160"
}
[StickyLib] Calling Sticky.io POST: https://techcommerceunlimited.sticky.io/api/v1/new_order with timeout 10000ms
[StickyLib] Alternative payment new_order detected for endpoint: new_order. Modifying headers and response handling.
[CheckoutHandler] KV PUT attempted for txn_f259a98e-0a04-4093-ac4b-0ca82ee82160 (paymentMethod update)
[StickyLib] Response Status from new_order: 200
[StickyLib] Handling HTML response for alternative payment on new_order.
[StickyLib] Extracted PayPal redirect URL: https://www.sandbox.paypal.com/checkoutnow?token=80114449FP860854U
[CheckoutHandler] Sticky.io PayPal REDIRECT for f259a98e-0a04-4093-ac4b-0ca82ee82160 to: https://www.sandbox.paypal.com/checkoutnow?token=80114449FP860854U
[CheckoutHandler] KV PUT attempted for txn_f259a98e-0a04-4093-ac4b-0ca82ee82160 (paypal_redirect status update)
[wrangler:inf] POST / 200 OK (2909ms)                                                                                                                
[Router] Received POST request for /api/page-pixels
[Router] Routing to Page Pixels Handler                                                                                                              
[PagePixelsHandler] Fetching pixels for siteId: drivebright, derived page: upsell1 (from URL: http://localhost:3000/upsell1?internal_txn_id=f259a98e-0a04-4093-ac4b-0ca82ee82160&errorFound=0&responseCode=100&transactionID=80114449FP860854U&customerId=2316161&orderId=5609843&orderTotal=108.97&orderSalesTaxPercent=0.00&orderSalesTaxAmount=0.00&test=0&gatewayId=181&prepaid_match=0&line_items[0][product_id]=150&line_items[0][variant_id]=0&line_items[0][quantity]=2&line_items[0][subscription_id]=a1172bf981f04ada151fb846703a672c&product1DigitalURL=shopnightview.com&gatewayCustomerService=714888888&gatewayDescriptor=Ecom+Gadget&subscription_id[150]=a1172bf981f04ada151fb846703a672c&ACS=https%3A%2F%2Fwww.sandbox.paypal.com%2Fcheckoutnow%3Ftoken&alt_pay_method=paypal&shipping_method=Standard+Shipping+-+8.99&coupon_discount_shipping_amount=0.0000&coupon_discount_product_amount=0.0000&totals_breakdown[total]=108.97&totals_breakdown[subtotal]=99.98&totals_breakdown[shipping]=8.99&totals_breakdown[tax]=0)
X [ERROR] [PagePixelsHandler] No pixel configuration found for drivebright_page_upsell1_pixels                                                       
                                                                                                                                                     
                                                                                                                                                     
[wrangler:inf] POST /api/page-pixels 200 OK (5ms)                                                                                                    
╭────────────────────────────────────────────────────────────────────────