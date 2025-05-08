i have a problem stickyio crm is supposed to give me a return url but its giving me html headers,
 i'm getting a 200 return on the post so it works but its returning a html page on me. but i'm actually not sure whats the best way for this to work. all i know is that i have to post to stickyio and stickyio will return me a url that the page needs to redirect to i think. figure out if my current page setup can support that 


this is my checkout page - C:\Users\88Devs\Documents\VsCode\tech-ecom\ecommerce-monorepo\sites\drivebright\src\app\page.tsx
C:\Users\88Devs\Documents\VsCode\cloudflare-worker-pixel-router\src\handlers\checkout.ts
C:\Users\88Devs\Documents\VsCode\cloudflare-worker-pixel-router\src\handlers\paypalReturn.ts
@project_overview.md


  "alt_pay_return_url": "http://127.0.0.1:8787/upsell1" - also this should be the site name not the worker sitename/upsell1

this api post instructions:

var request = require('request');
var options = {
  'method': 'POST',
  'url': 'https://{{app_key}}.{{domain}}{{api_ext}}new_order',
  'headers': {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    "firstName": "Postman",
    "lastName": "API",
    "billingFirstName": "PostingBilling",
    "billingLastName": "APILastname",
    "billingAddress1": "56 Escobar St",
    "billingAddress2": "FL 7",
    "billingCity": "Houston",
    "billingState": "TX",
    "billingZip": "33655",
    "billingCountry": "US",
    "phone": "8135551212",
    "email": "postman@apitest.com",
    "creditCardType": "VISA",
    "creditCardNumber": "1444444444444440",
    "expirationDate": "0628",
    "CVV": "123",
    "shippingId": "2",
    "tranType": "Sale",
    "ipAddress": "198.4.3.2",
    "campaignId": "4",
    "offers": [
      {
        "offer_id": "8",
        "product_id": "4",
        "billing_model_id": "6",
        "quantity": "1",
        "children": [
          {
            "product_id": "1",
            "quantity": "2"
          },
          {
            "product_id": "2",
            "quantity": "1"
          }
        ]
      },
      {
        "offer_id": "8",
        "product_id": 16,
        "billing_model_id": "4",
        "quantity": "2",
        "step_num": "2",
        "trial": {
          "product_id": 16
        }
      }
    ],
    "gift": {
      "email": "gift@email.com",
      "message": "This is a gift order and this is a gift message"
    },
    "notes": "This is a test order using new_order",
    "AFID": "AFID",
    "SID": "SID",
    "AFFID": "AFFID",
    "C1": "C1",
    "C2": "C2",
    "C3": "C3",
    "AID": "AID",
    "OPT": "OPT",
    "click_id": "abc123",
    "billingSameAsShipping": "YES",
    "shippingAddress1": "123 Medellin St",
    "shippingAddress2": "APT 7",
    "shippingCity": "Santo Alto",
    "shippingState": "TX",
    "shippingZip": "33544",
    "shippingCountry": "US",
    "forceGatewayId": "",
    "preserve_force_gateway": "",
    "thm_session_id": "",
    "total_installments": "",
    "alt_pay_token": "",
    "alt_pay_payer_id": "",
    "secretSSN": "",
    "promoCode": "",
    "temp_customer_id": "",
    "three_d_redirect_url": "",
    "alt_pay_return_url": "",
    "sessionId": "",
    "cascade_override": "",
    "create_member": "",
    "event_id": "",
    "ssn_nmi": "",
    "utm_source": "source",
    "utm_medium": "medium",
    "utm_campaign": "campaign",
    "utm_content": "content",
    "utm_term": "term",
    "device_category": "mobile",
    "checkingAccountNumber": "",
    "checkingRoutingNumber": "",
    "sepa_iban": "",
    "sepa_bic": "",
    "eurodebit_acct_num": "",
    "eurodebit_route_num": "",
    "referrer_id": "ABCD1234",
    "conversion_id": "addc703c-6ffd-11e8-a1ea-12f0b4779fbe",
    "cavv": "BwABAwJoEAAAAABhdWgQAAAAAAA=",
    "eci": "06",
    "xid": "YmUyMnFoMmJpbHM1aGJzNjd2MGc="
  })

};
request(options, function (error, response) {
  if (error) throw new Error(error);
  console.log(response.body);
});


this is instructions for stickyio:

PayPal V2 (Alternative Payment)
Support avatar
Written by Support
Updated over 2 months ago
Created: February 27, 2023

Last Updated:  May 30, 2024

 

 

OVERVIEW
PayPal Payments has 2 implementations, a redirect to their payment page or buttons that use popup modals to show the payment form. This integration is compatible with the redirect method currently.

 

For more information on PayPal Integrations click here 

 

Redirect Method
Send a normal new order request with card type = paypal and include alt_pay_return_url (for paypal to redirect back to your website). Make sure to not use AJAX and do not send any headers with your new order request.  All values are obtained from the front end communications with PayPal. Refer to PayPal's Integration documentation for more information on the front end implementation.

 

Sticky API documentation can be located here https://developer-prod.sticky.io/#729244f5-48a0-462f-be16-8ff2e8292bfd

 

IMPORTANT NOTES
PayPal V2 uses the PayPal Vault method to tokenize payments.

Clients MUST turn on PayPal Vaulting on their PayPal Mids

 

Enable Vaulting 
Log into the business dashboard and click the developer link on top


 

Then click this tab


 

Click on the Application for their API Key


 

Click the Vault checkbox (once checked this cannot be unchecked)


 

Save the changes

 


 

Add PayPal Payment Provider for PayPal V2
To configure PayPal V2 (Alternative Payment) into your sticky.io CRM, you will go to Payments>Gateways, under ACTIONS select Add New Provider Profile. Select the type = Payment/Gateway and select PayPal V2 (Alternative Payment) from the drop down. Fill out the gateway parameters which are outlined below and click “Save”.

 

These parameters are briefly described here for your reference:

 

Alias: name that you will assign to the gateway. This is for internal purposes only; it helps you identify a specific gateway account among several of them in your CRM.

 

Client ID: PayPal will provide you with the Client ID.

 

Client Secret: PayPal will provide you with the Client Secret.

 

Send Tracking Info: Yes  - this response will have your orders tracking information sent to PayPal.  Selecting NO will not send tracking information to PayPal.

 

Test Mode: Set to YES if you would like to use this gateway in test mode.

 

***NOTE*** if you use Wallet Info AND there is no Customer data for email, name and address in the new_order_API call you make to us for an order AND PayPal does not return any wallet data for the order THEN sticky will populate the missing fields with dummy data.   

 

Use Wallet Info: This configuration will allow  existing customer and order information to be updated and/or overwritten to wallet information returned from the provider.  sticky recommends always sending in the customers email, name, phone and address with the New_Order_API call even if the customer is using PayPal - this is the only way to prevent dummy data 100% of the time.

 

***NOTE*** if you use either delayed settlement feature below it is IMPERATIVE that you do not change the gateway if your Order status is pending.  These transactions will ONLY settle on the MID the were authorized on.

 

Enable Delayed Capture: Set to YES if you want to capture an authorization up to seven days from the day of the auth. Also an order will remain as pending in the system until the authorization is captured upon the count of days defined. Set to No if you want the standard authorization and capture process for your orders

 

Capture on Shipment: Set to YES if you want to capture an authorization once an order is marked a shipped in the CRM. Also, an order will remain as pending in the system until the authorization is captured upon shipment. Set to No if you want the standard authorization and capture process for your orders

 


There are 2 Required Fields on the Merchant Account Details tab.

·         *Descriptor - This will be the MID Descriptor

·         *Customer Service Number - The customer service number assigned to the MID

 

There is 1 Required Field on the Limits and Fees tab

·         *Global Monthly Cap - This will be the sales amount allowed monthly on this MID

 

To maximize the efficiency of sticky.io Reporting Analytics we suggest you take a moment and fill out the rest of the fields. These will all be used in sticky.io’s profitability reports.

 

Once your gateway profile has been created, then you will go through your campaigns and assign the gateway to the corresponding campaign(s).



this is the error my worker is giving me:
88Devs@88ThinkStation MINGW64 /c/Users/88Devs/Documents/VsCode/cloudflare-worker-pixel-router (main)
$ npm run dev

> cloudflare-worker-pixel-router@1.0.0 dev
> wrangler dev src/index.ts


 ⛅️ wrangler 4.12.0 (update available 4.14.2)
-------------------------------------------------------

Using vars defined in .dev.vars
Your Worker and resources are simulated locally via Miniflare. For more information, see: https://developers.cloudflare.com/workers/testing/local-development.                                                                                                
                                                                                                                               
Your worker has access to the following bindings:                                                                              
- KV Namespaces:                                                                                                               
  - PIXEL_CONFIG: de87977f940b497b85e952b8fee620b3 [simulated locally]                                                         
  - PIXEL_STATE: 0d279ec802c34455863cbd272e55d5d7 [simulated locally]
- Vars:
  - STICKYIO_API_KEY: "test_key"
  - STICKY_API_URL: "(hidden)"
  - STICKY_USERNAME: "(hidden)"
  - STICKY_PASSWORD: "(hidden)"
  - ADMIN_DEV_PROXY: "(hidden)"
  - ADMIN_USERNAME: "(hidden)"
  - ADMIN_PASSWORD: "(hidden)"
  - JWT_SECRET: "(hidden)"
⎔ Starting local server...
[wrangler:inf] Ready on http://127.0.0.1:8787
[Router] Received OPTIONS request for /api/page-pixels
[wrangler:inf] OPTIONS /api/page-pixels 200 OK (16ms)                                                                          
[Router] Handling OPTIONS for /api/page-pixels                                                                                 
[Router] Received POST request for /api/page-pixels                                                                            
[Router] Routing to Page Pixels Handler                                                                                        
[PagePixelsHandler] Fetching pixels for siteId: drivebright, derived page: home (from URL: http://localhost:3000/)
X [ERROR] [PagePixelsHandler] No pixel configuration found for drivebright_page_home_pixels


[wrangler:inf] POST /api/page-pixels 200 OK (24ms)                                                                             
[Router] Received OPTIONS request for /api/decide-campaign                                                                     
[Router] Handling OPTIONS for /api/decide-campaign                                                                             
[Router] Received POST request for /api/decide-campaign                                                                        
[Router] Routing to Decide Campaign Handler
[DecideCampaignHandler] Received request
[DecideCampaignHandler] DEBUG: Received body: {"siteId":"drivebright","internal_txn_id":"7ba2afeb-31dd-476e-affb-be535ac58926"}
[DecideCampaignHandler] Fetching KV for site drivebright: drivebright_global_scrub_percent, N/A, N/A, drivebright_normal_campaign_id, drivebright_scrub_campaign_id
[DecideCampaignHandler] Using global Scrub %: 0
[DecideCampaignHandler] Scrub Decision: isScrub = false (Threshold: 0%)
[DecideCampaignHandler] DEBUG: Raw KV value for drivebright_normal_campaign_id: 431
[DecideCampaignHandler] DEBUG: Raw KV value for drivebright_scrub_campaign_id: 433
[DecideCampaignHandler] Target Campaign ID: 431
[DecideCampaignHandler] Storing initial state to PIXEL_STATE with key: txn_7ba2afeb-31dd-476e-affb-be535ac58926 (async)        
[wrangler:inf] OPTIONS /api/decide-campaign 200 OK (2ms)                                                                       
[wrangler:inf] POST /api/decide-campaign 200 OK (20ms)
[Router] Received OPTIONS request for /api/page-pixels
[Router] Handling OPTIONS for /api/page-pixels                                                                                 
[wrangler:inf] OPTIONS /api/page-pixels 200 OK (4ms)                                                                           
[Router] Received POST request for /api/page-pixels                                                                            
[Router] Routing to Page Pixels Handler                                                                                        
[PagePixelsHandler] Fetching pixels for siteId: drivebright, derived page: home (from URL: http://localhost:3000/)             
X [ERROR] [PagePixelsHandler] No pixel configuration found for drivebright_page_home_pixels


[wrangler:inf] POST /api/page-pixels 200 OK (7ms)                                                                              
[Router] Received OPTIONS request for /api/decide-campaign
[Router] Handling OPTIONS for /api/decide-campaign                                                                             
[wrangler:inf] OPTIONS /api/decide-campaign 200 OK (4ms)                                                                       
[Router] Received POST request for /api/decide-campaign                                                                        
[Router] Routing to Decide Campaign Handler                                                                                    
[DecideCampaignHandler] Received request                                                                                       
[DecideCampaignHandler] DEBUG: Received body: {"siteId":"drivebright","internal_txn_id":"6279141c-21dc-445c-94d1-7ca5f10a0589"}
[DecideCampaignHandler] Fetching KV for site drivebright: drivebright_global_scrub_percent, N/A, N/A, drivebright_normal_campaign_id, drivebright_scrub_campaign_id
[DecideCampaignHandler] Using global Scrub %: 0
[DecideCampaignHandler] Scrub Decision: isScrub = false (Threshold: 0%)
[DecideCampaignHandler] DEBUG: Raw KV value for drivebright_normal_campaign_id: 431
[DecideCampaignHandler] DEBUG: Raw KV value for drivebright_scrub_campaign_id: 433
[DecideCampaignHandler] Target Campaign ID: 431
[DecideCampaignHandler] Storing initial state to PIXEL_STATE with key: txn_6279141c-21dc-445c-94d1-7ca5f10a0589 (async)        
[wrangler:inf] POST /api/decide-campaign 200 OK (9ms)                                                                          
[Router] Received OPTIONS request for /
[Router] Handling OPTIONS for /                                                                                                
[wrangler:inf] OPTIONS / 200 OK (4ms)                                                                                          
[Router] Received POST request for /                                                                                           
[Router] Routing to Checkout Handler                                                                                           
[CheckoutHandler] Received request                                                                                             
[CheckoutHandler] Using Sticky Base URL: https://techcommerceunlimited.sticky.io/api/v1 for ID: 1                              
[CheckoutHandler] Processing checkout for 6279141c-21dc-445c-94d1-7ca5f10a0589                                                 
[CheckoutHandler] Determined payment method: paypal
[CheckoutHandler] Updated paymentMethod_Initial to paypal for 6279141c-21dc-445c-94d1-7ca5f10a0589                             
[CheckoutHandler] PayPal payment method selected, adding required fields.                                                      
[CheckoutHandler] Mapping product item from frontend: {"id":"drivebright-double","product_id":150,"offer_id":1,"billing_model_id":2,"quantity":2,"ship_id":4,"price":49.99}
[CheckoutHandler] Setting alt_pay_return_url for PayPal to: http://127.0.0.1:8787/upsell1
[CheckoutHandler] Sending campaignId to Sticky.io: 431
[CheckoutHandler] Final payloadToSend to Sticky: {
  "firstName": "Test",
  "lastName": "User",
  "billingFirstName": "Test",
  "billingLastName": "User",
  "billingAddress1": "123 Test St",
  "billingAddress2": "",
  "billingCity": "Testville",
  "billingState": "CA",
  "billingZip": "90210",
  "billingCountry": "US",
  "phone": "5555555555",
  "email": "test@example.com",
  "shippingId": 4,
  "shippingAddress1": "123 Test St",
  "shippingAddress2": "",
  "shippingCity": "Testville",
  "shippingState": "CA",
  "shippingZip": "90210",
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
  "alt_pay_return_url": "http://127.0.0.1:8787/upsell1"
}
[StickyLib] Calling Sticky.io POST: https://techcommerceunlimited.sticky.io/api/v1/new_order with timeout 10000ms
[CheckoutHandler] KV PUT attempted for txn_6279141c-21dc-445c-94d1-7ca5f10a0589 (paymentMethod update)
[StickyLib] Response Status from new_order: 200
X [ERROR] [StickyLib] Failed to parse Sticky.io response JSON from new_order: <!DOCTYPE html>                                  
                                                                                                                               
  <html>                                                                                                                       
      <head>
          <meta http-equiv="Content-Type" content="text/html; Charset=UTF-8"><script
  type="text/javascript">(window.NREUM||(NREUM={})).init={ajax:{deny_list:["bam.nr-data.net"]}};(window.NREUM||(NREUM={})).loader_config={licenseKey:"d382cfd12d",applicationID:"157885634"};;/*!
  For license information please see nr-loader-rum-1.288.1.min.js.LICENSE.txt */
  (()=>{var e,t,r={8122:(e,t,r)=>{"use strict";r.d(t,{a:()=>i});var n=r(944);function
  i(e,t){try{if(!e||"object"!=typeof e)return(0,n.R)(3);if(!t||"object"!=typeof
  t)return(0,n.R)(4);const
  r=Object.create(Object.getPrototypeOf(t),Object.getOwnPropertyDescriptors(t)),o=0===Object.keys(r).length?e:r;for(let        
  a in o)if(void
  0!==e[a])try{if(null===e[a]){r[a]=null;continue}Array.isArray(e[a])&&Array.isArray(t[a])?r[a]=Array.from(new
  Set([...e[a],...t[a]])):"object"==typeof e[a]&&"object"==typeof
  t[a]?r[a]=i(e[a],t[a]):r[a]=e[a]}catch(e){(0,n.R)(1,e)}return
  r}catch(e){(0,n.R)(2,e)}}},2555:(e,t,r)=>{"use strict";r.d(t,{fn:()=>s,x1:()=>c});var
  n=r(384),i=r(8122);const o={beacon:n.NT.beacon,errorBeacon:n.NT.errorBeacon,licenseKey:void
  0,applicationID:void 0,sa:void 0,queueTime:void 0,applicationTime:void 0,ttGuid:void 0,user:void
  0,account:void 0,product:void 0,extra:void 0,jsAttributes:{},userAttributes:void 0,atts:void
  0,transactionName:void 0,tNamePlain:void 0},a={};function s(e){try{const t=function(e){if(!e)throw
  new Error("All info objects require an agent identifier!");if(!a[e])throw new Error("Info for
  ".concat(e," was never set"));return
  a[e]}(e);return!!t.licenseKey&&!!t.errorBeacon&&!!t.applicationID}catch(e){return!1}}function
  c(e,t){if(!e)throw new Error("All info objects require an agent
  identifier!");a[e]=(0,i.a)(t,o);const r=(0,n.nY)(e);r&&(r.info=a[e])}},5217:(e,t,r)=>{"use
  strict";r.d(t,{gD:()=>h,xN:()=>m});r(860).K7.genericEvents;const
  n="experimental.marks",i="experimental.measures",o="experimental.resources",a=e=>{if(!e||"string"!=typeof
  e)return!1;try{document.createDocumentFragment().querySelector(e)}catch{return!1}return!0};var
  s=r(2614),c=r(944),u=r(384),d=r(8122);const l="[data-nr-mask]",f=()=>{const
  e={feature_flags:[],experimental:{marks:!1,measures:!1,resources:!1},mask_selector:"*",block_selector:"[data-nr-block]",mask_input_options:{color:!1,date:!1,"datetime-local":!1,email:!1,month:!1,number:!1,range:!1,search:!1,tel:!1,text:!1,time:!1,url:!1,week:!1,textarea:!1,select:!1,password:!0}};return{ajax:{deny_list:void
  0,block_internal:!0,enabled:!0,autoStart:!0},api:{allow_registered_children:!0,duplicate_registered_data:!1},distributed_tracing:{enabled:void
  0,exclude_newrelic_header:void 0,cors_use_newrelic_header:void
  0,cors_use_tracecontext_headers:void 0,allowed_origins:void 0},get feature_flags(){return
  e.feature_flags},set
  feature_flags(t){e.feature_flags=t},generic_events:{enabled:!0,autoStart:!0},harvest:{interval:30},jserrors:{enabled:!0,autoStart:!0},logging:{enabled:!0,autoStart:!0},metrics:{enabled:!0,autoStart:!0},obfuscate:void
  0,page_action:{enabled:!0},page_view_event:{enabled:!0,autoStart:!0},page_view_timing:{enabled:!0,autoStart:!0},performance:{get
  capture_marks(){return e.feature_flags.includes(n)||e.experimental.marks},set
  capture_marks(t){e.experimental.marks=t},get capture_measures(){return
  e.feature_flags.includes(i)||e.experimental.measures},set
  capture_measures(t){e.experimental.measures=t},capture_detail:!0,resources:{get enabled(){return
  e.feature_flags.includes(o)||e.experimental.resources},set
  enabled(t){e.experimental.resources=t},asset_types:[],first_party_domains:[],ignore_newrelic:!0}},privacy:{cookies_enabled:!0},proxy:{assets:void
  0,beacon:void
  0},session:{expiresMs:s.wk,inactiveMs:s.BB},session_replay:{autoStart:!0,enabled:!1,preload:!1,sampling_rate:10,error_sampling_rate:100,collect_fonts:!1,inline_images:!1,fix_stylesheets:!0,mask_all_inputs:!0,get
  mask_text_selector(){return e.mask_selector},set
  mask_text_selector(t){a(t)?e.mask_selector="".concat(t,",").concat(l):""===t||null===t?e.mask_selector=l:(0,c.R)(5,t)},get   
  block_class(){return"nr-block"},get ignore_class(){return"nr-ignore"},get
  mask_text_class(){return"nr-mask"},get block_selector(){return e.block_selector},set
  block_selector(t){a(t)?e.block_selector+=",".concat(t):""!==t&&(0,c.R)(6,t)},get
  mask_input_options(){return e.mask_input_options},set mask_input_options(t){t&&"object"==typeof
  t?e.mask_input_options={...t,password:!0}:(0,c.R)(7,t)}},session_trace:{enabled:!0,autoStart:!0},soft_navigations:{enabled:!0,autoStart:!0},spa:{enabled:!0,autoStart:!0},ssl:void
  0,user_actions:{enabled:!0,elementAttributes:["id","className","tagName","type"]}}},g={},p="All
  configuration objects require an agent identifier!";function m(e,t){if(!e)throw new
  Error(p);g[e]=(0,d.a)(t,f());const r=(0,u.nY)(e);r&&(r.init=g[e])}function h(e,t){if(!e)throw new
  Error(p);var r=function(e){if(!e)throw new Error(p);if(!g[e])throw new Error("Configuration for
  ".concat(e," was never set"));return g[e]}(e);if(r){for(var
  n=t.split("."),i=0;i<n.length-1;i++)if("object"!=typeof(r=r[n[i]]))return;r=r[n[n.length-1]]}return
  r}},3371:(e,t,r)=>{"use strict";r.d(t,{V:()=>f,f:()=>l});var
  n=r(8122),i=r(384),o=r(6154),a=r(9324);let s=0;const
  c={buildEnv:a.F3,distMethod:a.Xs,version:a.xv,originTime:o.WN},u={appMetadata:{},customTransaction:void
  0,denyList:void 0,disabled:!1,entityManager:void 0,harvester:void
  0,isolatedBacklog:!1,loaderType:void 0,maxBytes:3e4,obfuscator:void 0,onerror:void 0,ptid:void
  0,releaseIds:{},session:void 0,timeKeeper:void 0},d={};function l(e){if(!e)throw new Error("All
  runtime objects require an agent identifier!");if(!d[e])throw new Error("Runtime for ".concat(e,"
  was never set"));return d[e]}function f(e,t){if(!e)throw new Error("All runtime objects require an
  agent
  identifier!");d[e]={...(0,n.a)(t,u),...c},Object.hasOwnProperty.call(d[e],"harvestCount")||Object.defineProperty(d[e],"harvestCount",{get:()=>++s});const
  r=(0,i.nY)(e);r&&(r.runtime=d[e])}},9324:(e,t,r)=>{"use
  strict";r.d(t,{F3:()=>i,Xs:()=>o,xv:()=>n});const
  n="1.288.1",i="PROD",o="CDN"},6154:(e,t,r)=>{"use
  strict";r.d(t,{OF:()=>c,RI:()=>i,WN:()=>d,bv:()=>o,gm:()=>a,mw:()=>s,sb:()=>u});var
  n=r(1863);const i="undefined"!=typeof window&&!!window.document,o="undefined"!=typeof
  WorkerGlobalScope&&("undefined"!=typeof self&&self instanceof WorkerGlobalScope&&self.navigator
  instanceof WorkerNavigator||"undefined"!=typeof globalThis&&globalThis instanceof
  WorkerGlobalScope&&globalThis.navigator instanceof WorkerNavigator),a=i?window:"undefined"!=typeof
  WorkerGlobalScope&&("undefined"!=typeof self&&self instanceof
  WorkerGlobalScope&&self||"undefined"!=typeof globalThis&&globalThis instanceof
  WorkerGlobalScope&&globalThis),s=Boolean("hidden"===a?.document?.visibilityState),c=/iPad|iPhone|iPod/.test(a.navigator?.userAgent),u=c&&"undefined"==typeof
  SharedWorker,d=((()=>{const
  e=a.navigator?.userAgent?.match(/Firefox[/\s](\d+\.\d+)/);Array.isArray(e)&&e.length>=2&&e[1]})(),Date.now()-(0,n.t)())},3241:(e,t,r)=>{"use
  strict";r.d(t,{W:()=>o});var n=r(6154);const i="newrelic";function
  o(e={}){try{n.gm.dispatchEvent(new CustomEvent(i,{detail:e}))}catch(e){}}},1687:(e,t,r)=>{"use
  strict";r.d(t,{Ak:()=>c,Ze:()=>l,x3:()=>u});var n=r(7836),i=r(3606),o=r(860),a=r(2646);const
  s={};function c(e,t){const
  r={staged:!1,priority:o.P3[t]||0};d(e),s[e].get(t)||s[e].set(t,r)}function
  u(e,t){e&&s[e]&&(s[e].get(t)&&s[e].delete(t),g(e,t,!1),s[e].size&&f(e))}function d(e){if(!e)throw
  new Error("agentIdentifier required");s[e]||(s[e]=new Map)}function
  l(e="",t="feature",r=!1){if(d(e),!e||!s[e].get(t)||r)return
  g(e,t);s[e].get(t).staged=!0,f(e)}function f(e){const
  t=Array.from(s[e]);t.every((([e,t])=>t.staged))&&(t.sort(((e,t)=>e[1].priority-t[1].priority)),t.forEach((([t])=>{s[e].delete(t),g(e,t)})))}function
  g(e,t,r=!0){const o=e?n.ee.get(e):n.ee,s=i.i.handlers;if(!o.aborted&&o.backlog&&s){if(r){const
  e=o.backlog[t],r=s[t];if(r){for(let
  t=0;e&&t<e.length;++t)p(e[t],r);Object.entries(r).forEach((([e,t])=>{Object.values(t||{}).forEach((t=>{t[0]?.on&&t[0]?.context()instanceof
  a.y&&t[0].on(e,t[1])}))}))}}o.isolatedBacklog||delete
  s[t],o.backlog[t]=null,o.emit("drain-"+t,[])}}function p(e,t){var
  r=e[1];Object.values(t[r]||{}).forEach((t=>{var r=e[0];if(t[0]===r){var
  n=t[1],i=e[3],o=e[2];n.apply(i,o)}}))}},7836:(e,t,r)=>{"use strict";r.d(t,{P:()=>c,ee:()=>u});var
  n=r(384),i=r(8990),o=r(3371),a=r(2646),s=r(5607);const c="nr@context:".concat(s.W),u=function
  e(t,r){var n={},s={},d={},l=!1;try{l=16===r.length&&(0,o.f)(r).isolatedBacklog}catch(e){}var
  f={on:p,addEventListener:p,removeEventListener:function(e,t){var r=n[e];if(!r)return;for(var
  i=0;i<r.length;i++)r[i]===t&&r.splice(i,1)},emit:function(e,r,n,i,o){!1!==o&&(o=!0);if(u.aborted&&!i)return;t&&o&&t.emit(e,r,n);for(var
  a=g(n),c=m(e),d=c.length,l=0;l<d;l++)c[l].apply(a,r);var p=v()[s[e]];p&&p.push([f,e,r,a]);return
  a},get:h,listeners:m,context:g,buffer:function(e,t){const
  r=v();if(t=t||"feature",f.aborted)return;Object.entries(e||{}).forEach((([e,n])=>{s[n]=t,t in
  r||(r[t]=[])}))},abort:function(){f._aborted=!0,Object.keys(f.backlog).forEach((e=>{delete
  f.backlog[e]}))},isBuffering:function(e){return!!v()[s[e]]},debugId:r,backlog:l?{}:t&&"object"==typeof
  t.backlog?t.backlog:{},isolatedBacklog:l};return Object.defineProperty(f,"aborted",{get:()=>{let
  e=f._aborted||!1;return e||(t&&(e=t.aborted),e)}}),f;function g(e){return e&&e instanceof
  a.y?e:e?(0,i.I)(e,c,(()=>new a.y(c))):new a.y(c)}function p(e,t){n[e]=m(e).concat(t)}function
  m(e){return n[e]||[]}function h(t){return d[t]=d[t]||e(f,t)}function v(){return f.backlog}}(void
  0,"globalEE"),d=(0,n.Zm)();d.ee||(d.ee=u)},2646:(e,t,r)=>{"use strict";r.d(t,{y:()=>n});class
  n{constructor(e){this.contextId=e}}},9908:(e,t,r)=>{"use strict";r.d(t,{d:()=>n,p:()=>i});var
  n=r(7836).ee.get("handle");function
  i(e,t,r,i,o){o?(o.buffer([e],i),o.emit(e,t,r)):(n.buffer([e],i),n.emit(e,t,r))}},3606:(e,t,r)=>{"use
  strict";r.d(t,{i:()=>o});var n=r(9908);o.on=a;var i=o.handlers={};function
  o(e,t,r,o){a(o||n.d,i,e,t,r)}function a(e,t,r,i,o){o||(o="feature"),e||(e=n.d);var
  a=t[o]=t[o]||{};(a[r]=a[r]||[]).push([e,i])}},3878:(e,t,r)=>{"use strict";function
  n(e,t){return{capture:e,passive:!1,signal:t}}function
  i(e,t,r=!1,i){window.addEventListener(e,t,n(r,i))}function
  o(e,t,r=!1,i){document.addEventListener(e,t,n(r,i))}r.d(t,{DD:()=>o,jT:()=>n,sp:()=>i})},5607:(e,t,r)=>{"use
  strict";r.d(t,{W:()=>n});const n=(0,r(9566).bz)()},9566:(e,t,r)=>{"use
  strict";r.d(t,{LA:()=>s,bz:()=>a});var n=r(6154);const
  i="xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";function o(e,t){return
  e?15&e[t]:16*Math.random()|0}function a(){const e=n.gm?.crypto||n.gm?.msCrypto;let t,r=0;return
  e&&e.getRandomValues&&(t=e.getRandomValues(new
  Uint8Array(30))),i.split("").map((e=>"x"===e?o(t,r++).toString(16):"y"===e?(3&o()|8).toString(16):e)).join("")}function      
  s(e){const t=n.gm?.crypto||n.gm?.msCrypto;let r,i=0;t&&t.getRandomValues&&(r=t.getRandomValues(new
  Uint8Array(e)));const a=[];for(var s=0;s<e;s++)a.push(o(r,i++).toString(16));return
  a.join("")}},2614:(e,t,r)=>{"use
  strict";r.d(t,{BB:()=>a,H3:()=>n,g:()=>u,iL:()=>c,tS:()=>s,uh:()=>i,wk:()=>o});const
  n="NRBA",i="SESSION",o=144e5,a=18e5,s={STARTED:"session-started",PAUSE:"session-pause",RESET:"session-reset",RESUME:"session-resume",UPDATE:"session-update"},c={SAME_TAB:"same-tab",CROSS_TAB:"cross-tab"},u={OFF:0,FULL:1,ERROR:2}},1863:(e,t,r)=>{"use   
  strict";function n(){return Math.floor(performance.now())}r.d(t,{t:()=>n})},944:(e,t,r)=>{"use
  strict";function n(e,t){"function"==typeof console.debug&&console.debug("New Relic Warning:
  https://github.com/newrelic/newrelic-browser-agent/blob/main/docs/warning-codes.md#".concat(e),t)}r.d(t,{R:()=>n})},5701:(e,t,r)=>{"use
  strict";r.d(t,{B:()=>o,t:()=>a});var n=r(3241);const i=new Set,o={};function a(e,t){const
  r=t.agentIdentifier;o[r]??={},e&&"object"==typeof
  e&&(i.has(r)||(t.ee.emit("rumresp",[e]),o[r]=e,i.add(r),(0,n.W)({agentIdentifier:r,loaded:!0,drained:!0,type:"lifecycle",name:"load",feature:void
  0,data:e})))}},8990:(e,t,r)=>{"use strict";r.d(t,{I:()=>i});var
  n=Object.prototype.hasOwnProperty;function i(e,t,r){if(n.call(e,t))return e[t];var
  i=r();if(Object.defineProperty&&Object.keys)try{return
  Object.defineProperty(e,t,{value:i,writable:!0,enumerable:!1}),i}catch(e){}return
  e[t]=i,i}},6389:(e,t,r)=>{"use strict";function n(e,t=500,r={}){const n=r?.leading||!1;let
  i;return(...r)=>{n&&void
  0===i&&(e.apply(this,r),i=setTimeout((()=>{i=clearTimeout(i)}),t)),n||(clearTimeout(i),i=setTimeout((()=>{e.apply(this,r)}),t))}}function
  i(e){let
  t=!1;return(...r)=>{t||(t=!0,e.apply(this,r))}}r.d(t,{J:()=>i,s:()=>n})},3496:(e,t,r)=>{"use
  strict";function n(e){return!e||!(!e.licenseKey||!e.applicationID)}function
  i(e,t){return!e||e.licenseKey===t.info.licenseKey&&e.applicationID===t.info.applicationID}r.d(t,{A:()=>i,I:()=>n})},5289:(e,t,r)=>{"use
  strict";r.d(t,{GG:()=>o,sB:()=>a});var n=r(3878);function i(){return"undefined"==typeof
  document||"complete"===document.readyState}function o(e,t){if(i())return
  e();(0,n.sp)("load",e,t)}function a(e){if(i())return
  e();(0,n.DD)("DOMContentLoaded",e)}},384:(e,t,r)=>{"use
  strict";r.d(t,{NT:()=>o,US:()=>d,Zm:()=>a,bQ:()=>c,dV:()=>s,nY:()=>u,pV:()=>l});var
  n=r(6154),i=r(1863);const o={beacon:"bam.nr-data.net",errorBeacon:"bam.nr-data.net"};function
  a(){return n.gm.NREUM||(n.gm.NREUM={}),void
  0===n.gm.newrelic&&(n.gm.newrelic=n.gm.NREUM),n.gm.NREUM}function s(){let e=a();return
  e.o||(e.o={ST:n.gm.setTimeout,SI:n.gm.setImmediate,CT:n.gm.clearTimeout,XHR:n.gm.XMLHttpRequest,REQ:n.gm.Request,EV:n.gm.Event,PR:n.gm.Promise,MO:n.gm.MutationObserver,FETCH:n.gm.fetch,WS:n.gm.WebSocket}),e}function
  c(e,t){let r=a();r.initializedAgents??={},t.initializedAt={ms:(0,i.t)(),date:new
  Date},r.initializedAgents[e]=t}function u(e){let t=a();return t.initializedAgents?.[e]}function
  d(e,t){a()[e]=t}function l(){return function(){let e=a();const
  t=e.info||{};e.info={beacon:o.beacon,errorBeacon:o.errorBeacon,...t}}(),function(){let e=a();const
  t=e.init||{};e.init={...t}}(),s(),function(){let e=a();const
  t=e.loader_config||{};e.loader_config={...t}}(),a()}},2843:(e,t,r)=>{"use
  strict";r.d(t,{u:()=>i});var n=r(3878);function
  i(e,t=!1,r,i){(0,n.DD)("visibilitychange",(function(){if(t)return
  void("hidden"===document.visibilityState&&e());e(document.visibilityState)}),r,i)}},3434:(e,t,r)=>{"use
  strict";r.d(t,{Jt:()=>o,YM:()=>c});var n=r(7836),i=r(5607);const o="nr@original:".concat(i.W);var
  a=Object.prototype.hasOwnProperty,s=!1;function c(e,t){return
  e||(e=n.ee),r.inPlace=function(e,t,n,i,o){n||(n="");const a="-"===n.charAt(0);for(let
  s=0;s<t.length;s++){const c=t[s],u=e[c];d(u)||(e[c]=r(u,a?c+n:n,i,c,o))}},r.flag=o,r;function
  r(t,r,n,s,c){return
  d(t)?t:(r||(r=""),nrWrapper[o]=t,function(e,t,r){if(Object.defineProperty&&Object.keys)try{return
  Object.keys(e).forEach((function(r){Object.defineProperty(t,r,{get:function(){return
  e[r]},set:function(t){return e[r]=t,t}})})),t}catch(e){u([e],r)}for(var n in
  e)a.call(e,n)&&(t[n]=e[n])}(t,nrWrapper,e),nrWrapper);function nrWrapper(){var
  o,a,d,l;try{a=this,o=[...arguments],d="function"==typeof
  n?n(o,a):n||{}}catch(t){u([t,"",[o,a,s],d],e)}i(r+"start",[o,a,s],d,c);try{return
  l=t.apply(a,o)}catch(e){throw i(r+"err",[o,a,e],d,c),e}finally{i(r+"end",[o,a,l],d,c)}}}function
  i(r,n,i,o){if(!s||t){var a=s;s=!0;try{e.emit(r,n,i,t,o)}catch(t){u([t,r,n,i],e)}s=a}}}function
  u(e,t){t||(t=n.ee);try{t.emit("internal-error",e)}catch(e){}}function
  d(e){return!(e&&"function"==typeof e&&e.apply&&!e[o])}},993:(e,t,r)=>{"use
  strict";r.d(t,{A$:()=>o,ET:()=>a,p_:()=>i});var n=r(860);const
  i={ERROR:"ERROR",WARN:"WARN",INFO:"INFO",DEBUG:"DEBUG",TRACE:"TRACE"},o={OFF:0,ERROR:1,WARN:2,INFO:3,DEBUG:4,TRACE:5},a="log";n.K7.logging},8154:(e,t,r)=>{"use
  strict";r.d(t,{z_:()=>o,XG:()=>s,TZ:()=>n,rs:()=>i,xV:()=>a});r(6154),r(9566),r(384);const
  n=r(860).K7.metrics,i="sm",o="cm",a="storeSupportabilityMetrics",s="storeEventMetrics"},6630:(e,t,r)=>{"use
  strict";r.d(t,{T:()=>n});const n=r(860).K7.pageViewEvent},782:(e,t,r)=>{"use
  strict";r.d(t,{T:()=>n});const n=r(860).K7.pageViewTiming},6344:(e,t,r)=>{"use
  strict";r.d(t,{G4:()=>i});var n=r(2614);r(860).K7.sessionReplay;const
  i={RECORD:"recordReplay",PAUSE:"pauseReplay",REPLAY_RUNNING:"replayRunning",ERROR_DURING_REPLAY:"errorDuringReplay"};n.g.ERROR,n.g.FULL,n.g.OFF},4234:(e,t,r)=>{"use
  strict";r.d(t,{W:()=>o});var n=r(7836),i=r(1687);class
  o{constructor(e,t){this.agentIdentifier=e,this.ee=n.ee.get(e),this.featureName=t,this.blocked=!1}deregisterDrain(){(0,i.x3)(this.agentIdentifier,this.featureName)}}},1871:(e,t,r)=>{"use
  strict";r.d(t,{j:()=>M});var
  n=r(860),i=r(9908),o=r(1687),a=r(5289),s=r(6154),c=r(944),u=r(8154),d=r(384),l=r(6344);const
  f=["setErrorHandler","finished","addToTrace","addRelease","recordCustomEvent","addPageAction","setCurrentRouteName","setPageViewName","setCustomAttribute","interaction","noticeError","setUserId","setApplicationVersion","start",l.G4.RECORD,l.G4.PAUSE,"log","wrapLogger","register"],g=["setErrorHandler","finished","addToTrace","addRelease"];var
  p=r(1863),m=r(2614),h=r(993);var v=r(7836),y=r(2646),b=r(3434);const w=new Map;function
  A(e,t,r,n){if("object"!=typeof t||!t||"string"!=typeof r||!r||"function"!=typeof
  t[r])return(0,c.R)(29);const i=function(e){return(e||v.ee).get("logger")}(e),o=(0,b.YM)(i),a=new
  y.y(v.P);a.level=n.level,a.customAttributes=n.customAttributes;const s=t[r]?.[b.Jt]||t[r];return
  w.set(s,a),o.inPlace(t,[r],"wrap-logger-",(()=>w.get(s))),i}var R=r(3496);var
  E=r(3241),_=r(5701);function x(){const
  e=(0,d.pV)();f.forEach((t=>{e[t]=(...r)=>function(t,...r){let n=[];return
  Object.values(e.initializedAgents).forEach((e=>{e&&e.runtime?e.exposed&&e[t]&&"micro-agent"!==e.runtime.loaderType&&n.push(e[t](...r)):(0,c.R)(38,t)})),n[0]}(t,...r)}))}const
  I={};function N(e,t){t||(0,o.Ak)(e.agentIdentifier,"api");const
  d=e.ee.get("tracer");I[e.agentIdentifier]=m.g.OFF,e.ee.on(l.G4.REPLAY_RUNNING,(t=>{I[e.agentIdentifier]=t}));const
  f="api-",v=f+"ixn-",y={addPageAction:function(e,t,r,i=(0,p.t)()){N(f,"addPageAction",!0,n.K7.genericEvents,i)(e,t,r)},log:function(t,{customAttributes:r={},level:o=h.p_.INFO}={},a,s=(0,p.t)()){(0,i.p)(u.xV,["API/log/called"],void
  0,n.K7.metrics,e.ee),function(e,t,r={},o=h.p_.INFO,a,s=(0,p.t)()){(0,i.p)(u.xV,["API/logging/".concat(o.toLowerCase(),"/called")],void
  0,n.K7.metrics,e),(0,i.p)(h.ET,[s,t,r,o,a],void
  0,n.K7.logging,e)}(e.ee,t,r,o,a,s)},noticeError:function(t,r,o,a=(0,p.t)()){"string"==typeof
  t&&(t=new Error(t)),(0,i.p)(u.xV,["API/noticeError/called"],void
  0,n.K7.metrics,e.ee),(0,i.p)("err",[t,a,!1,r,!!I[e.agentIdentifier],void 0,o],void
  0,n.K7.jserrors,e.ee)}};function b(t,r,n,i){const o=e.info;return null===r?delete
  o.jsAttributes[t]:e.info={...e.info,jsAttributes:{...o.jsAttributes,[t]:r}},N(f,n,!0,i||null===r?"session":void
  0)(t,r)}function w(){}e.register=function(t){return(0,i.p)(u.xV,["API/register/called"],void
  0,n.K7.metrics,e.ee),function(e,t,r){const o={};let
  a,s;(0,c.R)(54,"newrelic.register"),e.init.api.allow_registered_children||(a=()=>(0,c.R)(55)),r&&(0,R.I)(r)||(a=()=>(0,c.R)(48,r));const
  d={addPageAction:(e,n={})=>{l(t.addPageAction,[e,{...o,...n}],r)},log:(e,n={})=>{l(t.log,[e,{...n,customAttributes:{...o,...n.customAttributes||{}}}],r)},noticeError:(e,n={})=>{l(t.noticeError,[e,{...o,...n}],r)},setApplicationVersion:e=>{o["application.version"]=e},setCustomAttribute:(e,t)=>{o[e]=t},setUserId:e=>{o["enduser.id"]=e},metadata:{customAttributes:o,target:r,get   
  connected(){return s||Promise.reject(new Error("Failed to connect"))}}};a?a():s=new
  Promise(((t,n)=>{try{const i=e.runtime?.entityManager;let
  a=!!i?.get().entityGuid,s=i?.getEntityGuidFor(r.licenseKey,r.applicationID),c=!!s;if(a&&c)r.entityGuid=s,t(d);else{const     
  u=setTimeout((()=>n(new Error("Failed to connect - Timeout"))),15e3);function
  l(n){(0,R.A)(n,e)?a||=!0:r.licenseKey===n.licenseKey&&r.applicationID===n.applicationID&&(c=!0,r.entityGuid=n.entityGuid),a&&c&&(clearTimeout(u),e.ee.removeEventListener("entity-added",l),t(d))}e.ee.emit("api-send-rum",[o,r]),e.ee.on("entity-added",l)}}catch(f){n(f)}}));const
  l=async(t,r,o)=>{if(a)return a();const
  d=(0,p.t)();(0,i.p)(u.xV,["API/register/".concat(t.name,"/called")],void
  0,n.K7.metrics,e.ee);try{await s;const
  n=e.init.api.duplicate_registered_data;(!0===n||Array.isArray(n)&&n.includes(o.entityGuid))&&t(...r,void
  0,d),t(...r,o.entityGuid,d)}catch(e){(0,c.R)(50,e)}};return
  d}(e,y,t)},e.log=function(e,t){y.log(e,t)},e.wrapLogger=(t,r,{customAttributes:o={},level:a=h.p_.INFO}={})=>{(0,i.p)(u.xV,["API/wrapLogger/called"],void
  0,n.K7.metrics,e.ee),A(e.ee,t,r,{customAttributes:o,level:a})},g.forEach((t=>{e[t]=N(f,t,!0,"api")})),e.addPageAction=function(e,t){y.addPageAction(e,t)},e.recordCustomEvent=N(f,"recordCustomEvent",!0,n.K7.genericEvents),e.setPageViewName=function(t,r){if("string"==typeof
  t)return"/"!==t.charAt(0)&&(t="/"+t),e.runtime.customTransaction=(r||"http://custom.transaction")+t,N(f,"setPageViewName",!0)()},e.setCustomAttribute=function(e,t,r=!1){if("string"==typeof
  e){if(["string","number","boolean"].includes(typeof t)||null===t)return
  b(e,t,"setCustomAttribute",r);(0,c.R)(40,typeof t)}else(0,c.R)(39,typeof
  e)},e.setUserId=function(e){if("string"==typeof e||null===e)return
  b("enduser.id",e,"setUserId",!0);(0,c.R)(41,typeof
  e)},e.setApplicationVersion=function(e){if("string"==typeof e||null===e)return
  b("application.version",e,"setApplicationVersion",!1);(0,c.R)(42,typeof
  e)},e.start=()=>{try{(0,i.p)(u.xV,["API/start/called"],void
  0,n.K7.metrics,e.ee),e.ee.emit("manual-start-all")}catch(e){(0,c.R)(23,e)}},e[l.G4.RECORD]=function(){(0,i.p)(u.xV,["API/recordReplay/called"],void
  0,n.K7.metrics,e.ee),(0,i.p)(l.G4.RECORD,[],void
  0,n.K7.sessionReplay,e.ee)},e[l.G4.PAUSE]=function(){(0,i.p)(u.xV,["API/pauseReplay/called"],void
  0,n.K7.metrics,e.ee),(0,i.p)(l.G4.PAUSE,[],void
  0,n.K7.sessionReplay,e.ee)},e.interaction=function(e){return(new w).get("object"==typeof
  e?e:{})};const x=w.prototype={createTracer:function(t,r){var o={},a=this,s="function"==typeof
  r;return(0,i.p)(u.xV,["API/createTracer/called"],void
  0,n.K7.metrics,e.ee),e.runSoftNavOverSpa||(0,i.p)(v+"tracer",[(0,p.t)(),t,o],a,n.K7.spa,e.ee),function(){if(d.emit((s?"":"no-")+"fn-start",[(0,p.t)(),a,s],o),s)try{return
  r.apply(this,arguments)}catch(e){const t="string"==typeof e?new Error(e):e;throw
  d.emit("fn-err",[arguments,this,t],o),t}finally{d.emit("fn-end",[(0,p.t)()],o)}}}};function
  N(t,r,o,a,s=(0,p.t)()){return function(){return(0,i.p)(u.xV,["API/"+r+"/called"],void
  0,n.K7.metrics,e.ee),(0,E.W)({agentIdentifier:e.agentIdentifier,drained:!!_.B?.[e.agentIdentifier],type:"data",name:"api",feature:t+r,data:{notSpa:o,bufferGroup:a}}),a&&(0,i.p)(t+r,[s,...arguments],o?null:this,a,e.ee),o?void
  0:this}}function
  k(){r.e(296).then(r.bind(r,8778)).then((({setAsyncAPI:t})=>{t(e),(0,o.Ze)(e.agentIdentifier,"api")})).catch((t=>{(0,c.R)(27,t),e.ee.abort()}))}return["actionText","setName","setAttribute","save","ignore","onEnd","getContext","end","get"].forEach((t=>{x[t]=function(){return
  N.apply(this,[v,t,void
  0,e.runSoftNavOverSpa?n.K7.softNav:n.K7.spa]).apply(this,arguments)}})),e.setCurrentRouteName=function(){return
  e.runSoftNavOverSpa?N(v,"routeName",void
  0,n.K7.softNav)(...arguments):N(f,"routeName",!0,n.K7.spa)(...arguments)},e.noticeError=function(e,t){y.noticeError(e,t)},s.RI?(0,a.GG)((()=>k()),!0):k(),!0}var
  k=r(2555),T=r(5217),S=r(8122);const P={accountID:void 0,trustKey:void 0,agentID:void
  0,licenseKey:void 0,applicationID:void 0,xpid:void 0},j={};var O=r(3371);const K=e=>{const
  t=e.startsWith("http");e+="/",r.p=t?e:"https://"+e},V=new Set;function
  M(e,t={},r,n){let{init:i,info:o,loader_config:a,runtime:c={},exposed:u=!0}=t;c.loaderType=r;const
  l=(0,d.pV)();o||(i=l.init,o=l.info,a=l.loader_config),(0,T.xN)(e.agentIdentifier,i||{}),function(e,t){if(!e)throw
  new Error("All loader-config objects require an agent identifier!");j[e]=(0,S.a)(t,P);const
  r=(0,d.nY)(e);r&&(r.loader_config=j[e])}(e.agentIdentifier,a||{}),o.jsAttributes??={},s.bv&&(o.jsAttributes.isWorker=!0),(0,k.x1)(e.agentIdentifier,o);const
  f=e.init,g=[o.beacon,o.errorBeacon];V.has(e.agentIdentifier)||(f.proxy.assets&&(K(f.proxy.assets),g.push(f.proxy.assets)),f.proxy.beacon&&g.push(f.proxy.beacon),x(),(0,d.US)("activatedFeatures",_.B),e.runSoftNavOverSpa&&=!0===f.soft_navigations.enabled&&f.feature_flags.includes("soft_nav")),c.denyList=[...f.ajax.deny_list||[],...f.ajax.block_internal?g:[]],c.ptid=e.agentIdentifier,(0,O.V)(e.agentIdentifier,c),V.has(e.agentIdentifier)||(e.ee=v.ee.get(e.agentIdentifier),e.exposed=u,N(e,n),(0,E.W)({a    


X [ERROR] gentIdentifier:e.agentIdentifier,drained:!!_.B?.[e.agentIdentifier],type:"lifecycle",name:"initialize",feature:void 0,data:e.config})),V.add(e.agentIdentifier)}},8374:(e,t,r)=>{r.nc=(()=>{try{return document?.currentScript?.nonce}catch(e){}return""})()},860:(e,t,r)=>{"use strict";r.d(t,{$J:()=>d,K7:()=>c,P3:()=>u,XX:()=>i,Yy:()=>s,df:()=>o,qY:()=>n,v4:()=>a});const n="events",i="jserrors",o="browser/blobs",a="rum",s="browser/logs",c={ajax:"ajax",genericEvents:"generic_events",jserrors:i,logging:"logging",metrics:"metrics",pageAction:"page_action",pageViewEvent:"page_view_event",pageViewTiming:"page_view_timing",sessionReplay:"session_replay",sessionTrace:"session_trace",softNav:"soft_navigations",spa:"spa"},u={[c.pageViewEvent]:1,[c.pageViewTiming]:2,[c.metrics]:3,[c.jserrors]:4,[c.spa]:5,[c.ajax]:6,[c.sessionTrace]:7,[c.softNav]:8,[c.sessionReplay]:9,[c.logging]:10,[c.genericEvents]:11},d={[c.pageViewEvent]:a,[c.pageViewTiming]:n,[c.ajax]:n,[c.spa]:n,[c.softNav]:n,[c.metrics]:i,[c.jserrors]:i,[c.sessionTrace]:o,[c.sessionReplay]:o,[c.logging]:s,[c.genericEvents]:"ins"}}},n={};function i(e){var t=n[e];if(void 0!==t)return t.exports;var o=n[e]={exports:{}};return r[e](o,o.exports,i),o.exports}i.m=r,i.d=(e,t)=>{for(var r in t)i.o(t,r)&&!i.o(e,r)&&Object.defineProperty(e,r,{enumerable:!0,get:t[r]})},i.f={},i.e=e=>Promise.all(Object.keys(i.f).reduce(((t,r)=>(i.f[r](e,t),t)),[])),i.u=e=>"nr-rum-1.288.1.min.js",i.o=(e,t)=>Object.prototype.hasOwnProperty.call(e,t),e={},t="NRBA-1.288.1.PROD:",i.l=(r,n,o,a)=>{if(e[r])e[r].push(n);else{var s,c;if(void 0!==o)for(var u=document.getElementsByTagName("script"),d=0;d<u.length;d++){var l=u[d];if(l.getAttribute("src")==r||l.getAttribute("data-webpack")==t+o){s=l;break}}if(!s){c=!0;var f={296:"sha512-ZTeBoOHyqpwEEZKgt1JC27NDiYVDbpwM02CQatEAzIxtN4ZrZebWWivrcZuZX8Z0CLJ2Hu2OoCZvtiuB8gaHfQ=="};(s=document.createElement("script")).charset="utf-8",s.timeout=120,i.nc&&s.setAttribute("nonce",i.nc),s.setAttribute("data-webpack",t+o),s.src=r,0!==s.src.indexOf(window.location.origin+"/")&&(s.crossOrigin="anonymous"),f[a]&&(s.integrity=f[a])}e[r]=[n];var g=(t,n)=>{s.onerror=s.onload=null,clearTimeout(p);var i=e[r];if(delete e[r],s.parentNode&&s.parentNode.removeChild(s),i&&i.forEach((e=>e(n))),t)return t(n)},p=setTimeout(g.bind(null,void 0,{type:"timeout",target:s}),12e4);s.onerror=g.bind(null,s.onerror),s.onload=g.bind(null,s.onload),c&&document.head.appendChild(s)}},i.r=e=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},i.p="https://js-agent.newrelic.com/",(()=>{var e={374:0,840:0};i.f.j=(t,r)=>{var n=i.o(e,t)?e[t]:void 0;if(0!==n)if(n)r.push(n[2]);else{var o=new Promise(((r,i)=>n=e[t]=[r,i]));r.push(n[2]=o);var a=i.p+i.u(t),s=new Error;i.l(a,(r=>{if(i.o(e,t)&&(0!==(n=e[t])&&(e[t]=void 0),n)){var o=r&&("load"===r.type?"missing":r.type),a=r&&r.target&&r.target.src;s.message="Loading chunk "+t+" failed.\n("+o+": "+a+")",s.name="ChunkLoadError",s.type=o,s.request=a,n[1](s)}}),"chunk-"+t,t)}};var t=(t,r)=>{var n,o,[a,s,c]=r,u=0;if(a.some((t=>0!==e[t]))){for(n in s)i.o(s,n)&&(i.m[n]=s[n]);if(c)c(i)}for(t&&t(r);u<a.length;u++)o=a[u],i.o(e,o)&&e[o]&&e[o][0](),e[o]=0},r=self["webpackChunk:NRBA-1.288.1.PROD"]=self["webpackChunk:NRBA-1.288.1.PROD"]||[];r.forEach(t.bind(null,0)),r.push=t.bind(null,r.push.bind(r))})(),(()=>{"use strict";i(8374);var e=i(944),t=i(6344),r=i(9566);class n{agentIdentifier;constructor(){this.agentIdentifier=(0,r.LA)(16)}#e(t,...r){if(this[t]!==n.prototype[t])return this[t](...r);(0,e.R)(35,t)}addPageAction(e,t){return this.#e("addPageAction",e,t)}register(e){return this.#e("register",e)}recordCustomEvent(e,t){return this.#e("recordCustomEvent",e,t)}setPageViewName(e,t){return this.#e("setPageViewName",e,t)}setCustomAttribute(e,t,r){return this.#e("setCustomAttribute",e,t,r)}noticeError(e,t){return this.#e("noticeError",e,t)}setUserId(e){return this.#e("setUserId",e)}setApplicationVersion(e){return this.#e("setApplicationVersion",e)}setErrorHandler(e){return this.#e("setErrorHandler",e)}addRelease(e,t){return this.#e("addRelease",e,t)}log(e,t){return this.#e("log",e,t)}}class o extends n{#e(t,...r){if(this[t]!==o.prototype[t]&&this[t]!==n.prototype[t])return this[t](...r);(0,e.R)(35,t)}start(){return this.#e("start")}finished(e){return this.#e("finished",e)}recordReplay(){return this.#e(t.G4.RECORD)}pauseReplay(){return this.#e(t.G4.PAUSE)}addToTrace(e){return this.#e("addToTrace",e)}setCurrentRouteName(e){return this.#e("setCurrentRouteName",e)}interaction(){return this.#e("interaction")}wrapLogger(e,t,r){return this.#e("wrapLogger",e,t,r)}}var a=i(860),s=i(5217);const c=Object.values(a.K7);function u(e){const t={};return c.forEach((r=>{t[r]=function(e,t){return!0===(0,s.gD)(t,"".concat(e,".enabled"))}(r,e)})),t}var d=i(1871);var l=i(9908),f=i(1687),g=i(4234),p=i(5289),m=i(6154),h=i(384);const v=e=>m.RI&&!0===(0,s.gD)(e,"privacy.cookies_enabled");function y(e){return!!(0,h.dV)().o.MO&&v(e)&&!0===(0,s.gD)(e,"session_trace.enabled")}var b=i(6389);class w extends g.W{constructor(e,t,r=!0){super(e.agentIdentifier,t),this.auto=r,this.abortHandler=void 0,this.featAggregate=void 0,this.onAggregateImported=void 0,!1===e.init[this.featureName].autoStart&&(this.auto=!1),this.auto?(0,f.Ak)(e.agentIdentifier,t):this.ee.on("manual-start-all",(0,b.J)((()=>{(0,f.Ak)(e.agentIdentifier,this.featureName),this.auto=!0,this.importAggregator(e)})))}importAggregator(t,r={}){if(this.featAggregate||!this.auto)return;let n;this.onAggregateImported=new Promise((e=>{n=e}));const o=async()=>{let o;try{if(v(this.agentIdentifier)){const{setupAgentSession:e}=await i.e(296).then(i.bind(i,3861));o=e(t)}}catch(t){(0,e.R)(20,t),this.ee.emit("internal-error",[t]),this.featureName===a.K7.sessionReplay&&this.abortHandler?.()}try{if(!this.#t(this.featureName,o))return(0,f.Ze)(this.agentIdentifier,this.featureName),void n(!1);const{lazyFeatureLoader:e}=await i.e(296).then(i.bind(i,6103)),{Aggregate:a}=await e(this.featureName,"aggregate");this.featAggregate=new a(t,r),t.runtime.harvester.initializedAggregates.push(this.featAggregate),n(!0)}catch(t){(0,e.R)(34,t),this.abortHandler?.(),(0,f.Ze)(this.agentIdentifier,this.featureName,!0),n(!1),this.ee&&this.ee.abort()}};m.RI?(0,p.GG)((()=>o()),!0):o()}#t(e,t){switch(e){case a.K7.sessionReplay:return y(this.agentIdentifier)&&!!t;case a.K7.sessionTrace:return!!t;default:return!0}}}var A=i(6630);class R extends w{static featureName=A.T;constructor(e,t=!0){super(e,A.T,t),this.ee.on("api-send-rum",((e,t)=>(0,l.p)("send-rum",[e,t],void 0,this.featureName,this.ee))),this.importAggregator(e)}}var E=i(2843),_=i(3878),x=i(782),I=i(1863);class N extends w{static featureName=x.T;constructor(e,t=!0){super(e,x.T,t),m.RI&&((0,E.u)((()=>(0,l.p)("docHidden",[(0,I.t)()],void 0,x.T,this.ee)),!0),(0,_.sp)("pagehide",(()=>(0,l.p)("winPagehide",[(0,I.t)()],void 0,x.T,this.ee))),this.importAggregator(e))}}var k=i(8154);class T extends w{static featureName=k.TZ;constructor(e,t=!0){super(e,k.TZ,t),m.RI&&document.addEventListener("securitypolicyviolation",(e=>{(0,l.p)(k.xV,["Generic/CSPViolation/Detected"],void 0,this.featureName,this.ee)})),this.importAggregator(e)}}new class extends o{constructor(t){super(),m.gm?(this.features={},(0,h.bQ)(this.agentIdentifier,this),this.desiredFeatures=new Set(t.features||[]),this.desiredFeatures.add(R),this.runSoftNavOverSpa=[...this.desiredFeatures].some((e=>e.featureName===a.K7.softNav)),(0,d.j)(this,t,t.loaderType||"agent"),this.run()):(0,e.R)(21)}get config(){return{info:this.info,init:this.init,loader_config:this.loader_config,runtime:this.runtime}}get api(){return this}run(){try{const t=u(this.agentIdentifier),r=[...this.desiredFeatures];r.sort(((e,t)=>a.P3[e.featureName]-a.P3[t.featureName])),r.forEach((r=>{if(!t[r.featureName]&&r.featureName!==a.K7.pageViewEvent)return;if(this.runSoftNavOverSpa&&r.featureName===a.K7.spa)return;if(!this.runSoftNavOverSpa&&r.featureName===a.K7.softNav)return;const n=function(e){switch(e){case a.K7.ajax:return[a.K7.jserrors];case a.K7.sessionTrace:return[a.K7.ajax,a.K7.pageViewEvent];case a.K7.sessionReplay:return[a.K7.sessionTrace];case a.K7.pageViewTiming:return[a.K7.pageViewEvent];default:return[]}}(r.featureName).filter((e=>!(e in this.features)));n.length>0&&(0,e.R)(36,{targetFeature:r.featureName,missingDependencies:n}),this.features[r.featureName]=new r(this)}))}catch(t){(0,e.R)(22,t);for(const e in this.features)this.features[e].abortHandler?.();const r=(0,h.Zm)();delete r.initializedAgents[this.agentIdentifier]?.features,delete this.sharedAggregator;return r.ee.get(this.agentIdentifier).abort(),!1}}}({features:[R,N,T],loaderType:"lite"})})()})();</script>

          <title>3D-Secure Payment Transaction</title>
      </head>
      <body OnLoad="OnLoadEvent();">
          <form id="secureForm" action="" method="POST" <!--IFRAME_TARGET-->>
          <div>
              <h1 style="text-align: center;">Processing your PayPal Transaction</h1>
              <input type="hidden" name="authOnly" value="" /><input type="hidden"
  name="paypalOrderId" value="2YP01379BP946010P" /><input type="hidden" name="orderId"
  value="5607984" />
              <noscript>
                  <p>JavaScript is currently disabled or is not supported by your
                  browser.</p>
                  <p>Please click Submit to continue the processing of your 3D-Secure Payment
                  transaction.</p>
                  <input type="submit" value="Submit" />
              </noscript>
          </div>
          </form>
          <!--IFRAME-->
          <script type="text/javascript">
              /* <![CDATA[ */
              function OnLoadEvent() {

  window.location.replace('https://www.sandbox.paypal.com/checkoutnow?token=2YP01379BP946010P');
              }
              <!--LISTENER-->
              /* ]]> */
          </script>
      <script
  type="text/javascript">window.NREUM||(NREUM={});NREUM.info={"beacon":"bam.nr-data.net","licenseKey":"d382cfd12d","applicationID":"157885634","transactionName":"blUGZhMCVhdWBkxeX1cfJVEVClcKGBBWXF5WRwo=","queueTime":0,"applicationTime":190,"atts":"QhIFEFsYRRk=","errorBeacon":"bam.nr-data.net","agent":""}</script></body>
  </html> SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
      at JSON.parse (<anonymous>)
      at callStickyApi
  (file:///C:/Users/88Devs/Documents/VsCode/cloudflare-worker-pixel-router/src/lib/sticky.ts:56:39)
      at async handleCheckout
  (file:///C:/Users/88Devs/Documents/VsCode/cloudflare-worker-pixel-router/src/handlers/checkout.ts:263:32)
      at async routeRequest
  (file:///C:/Users/88Devs/Documents/VsCode/cloudflare-worker-pixel-router/src/router.ts:95:20)
      at async jsonError
  (file:///C:/Users/88Devs/Documents/VsCode/cloudflare-worker-pixel-router/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts:22:10)
      at async drainBody
  (file:///C:/Users/88Devs/Documents/VsCode/cloudflare-worker-pixel-router/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts:5:10)


[CheckoutHandler] KV PUT attempted for txn_6279141c-21dc-445c-94d1-7ca5f10a0589 (failed status update)                         
[wrangler:inf] POST / 400 Bad Request (4776ms)                                                                                 
X [ERROR] [CheckoutHandler] Sticky.io NewOrder FAILED for 6279141c-21dc-445c-94d1-7ca5f10a0589: Failed to parse response: <!DOCTYPE html>

  <html>
      <head>
          <meta http-equiv="Content-Type" content="text/html; Charse... {
    _status: 200,
    _ok: true,
    _rawBody: '<!DOCTYPE html>\n' +
      '<html>\n' +
      '    <head>\n' +
      '        <meta http-equiv="Content-Type" content="text/html; Charset=UTF-8"><script
  type="text/javascript">(window.NREUM||(NREUM={})).init={ajax:{deny_list:["bam.nr-data.net"]}};(window.NREUM||(NREUM={})).loader_config={licenseKey:"d382cfd12d",applicationID:"157885634"};;/*!
  For license information please see nr-loader-rum-1.288.1.min.js.LICENSE.txt */\n' +
      '(()=>{var e,t,r={8122:(e,t,r)=>{"use strict";r.d(t,{a:()=>i});var n=r(944);function
  i(e,t){try{if(!e||"object"!=typeof e)return(0,n.R)(3);if(!t||"object"!=typeof
  t)return(0,n.R)(4);const
  r=Object.create(Object.getPrototypeOf(t),Object.getOwnPropertyDescriptors(t)),o=0===Object.keys(r).length?e:r;for(let        
  a in o)if(void
  0!==e[a])try{if(null===e[a]){r[a]=null;continue}Array.isArray(e[a])&&Array.isArray(t[a])?r[a]=Array.from(new
  Set([...e[a],...t[a]])):"object"==typeof e[a]&&"object"==typeof
  t[a]?r[a]=i(e[a],t[a]):r[a]=e[a]}catch(e){(0,n.R)(1,e)}return
  r}catch(e){(0,n.R)(2,e)}}},2555:(e,t,r)=>{"use strict";r.d(t,{fn:()=>s,x1:()=>c});var
  n=r(384),i=r(8122);const o={beacon:n.NT.beacon,errorBeacon:n.NT.errorBeacon,licenseKey:void
  0,applicationID:void 0,sa:void 0,queueTime:void 0,applicationTime:void 0,ttGuid:void 0,user:void
  0,account:void 0,product:void 0,extra:void 0,jsAttributes:{},userAttributes:void 0,atts:void
  0,transactionName:void 0,tNamePlain:void 0},a={};function s(e){try{const t=function(e){if(!e)throw
  new Error("All info objects require an agent identifier!");if(!a[e])throw new Error("Info for
  ".concat(e," was never set"));return
  a[e]}(e);return!!t.licenseKey&&!!t.errorBeacon&&!!t.applicationID}catch(e){return!1}}function
  c(e,t){if(!e)throw new Error("All info objects require an agent
  identifier!");a[e]=(0,i.a)(t,o);const r=(0,n.nY)(e);r&&(r.info=a[e])}},5217:(e,t,r)=>{"use
  strict";r.d(t,{gD:()=>h,xN:()=>m});r(860).K7.genericEvents;const
  n="experimental.marks",i="experimental.measures",o="experimental.resources",a=e=>{if(!e||"string"!=typeof
  e)return!1;try{document.createDocumentFragment().querySelector(e)}catch{return!1}return!0};var
  s=r(2614),c=r(944),u=r(384),d=r(8122);const l="[data-nr-mask]",f=()=>{const
  e={feature_flags:[],experimental:{marks:!1,measures:!1,resources:!1},mask_selector:"*",block_selector:"[data-nr-block]",mask_input_options:{color:!1,date:!1,"datetime-local":!1,email:!1,month:!1,number:!1,range:!1,search:!1,tel:!1,text:!1,time:!1,url:!1,week:!1,textarea:!1,select:!1,password:!0}};return{ajax:{deny_list:void
  0,block_internal:!0,enabled:!0,autoStart:!0},api:{allow_registered_children:!0,duplicate_registered_data:!1},distributed_tracing:{enabled:void
  0,exclude_newrelic_header:void 0,cors_use_newrelic_header:void
  0,cors_use_tracecontext_headers:void 0,allowed_origins:void 0},get feature_flags(){return
  e.feature_flags},set
  feature_flags(t){e.feature_flags=t},generic_events:{enabled:!0,autoStart:!0},harvest:{interval:30},jserrors:{enabled:!0,autoStart:!0},logging:{enabled:!0,autoStart:!0},metrics:{enabled:!0,autoStart:!0},obfuscate:void
  0,page_action:{enabled:!0},page_view_event:{enabled:!0,autoStart:!0},page_view_timing:{enabled:!0,autoStart:!0},performance:{get
  capture_marks(){return e.feature_flags.includes(n)||e.experimental.marks},set
  capture_marks(t){e.experimental.marks=t},get capture_measures(){return
  e.feature_flags.includes(i)||e.experimental.measures},set
  capture_measures(t){e.experimental.measures=t},capture_detail:!0,resources:{get enabled(){return
  e.feature_flags.includes(o)||e.experimental.resources},set
  enabled(t){e.experimental.resources=t},asset_types:[],first_party_domains:[],ignore_newrelic:!0}},privacy:{cookies_enabled:!0},proxy:{assets:void
  0,beacon:void
  0},session:{expiresMs:s.wk,inactiveMs:s.BB},session_replay:{autoStart:!0,enabled:!1,preload:!1,sampling_rate:10,error_sampling_rate:100,collect_fonts:!1,inline_images:!1,fix_stylesheets:!0,mask_all_inputs:!0,get
  mask_text_selector(){return e.mask_selector},set
  mask_text_selector(t){a(t)?e.mask_selector="".concat(t,",").concat(l):""===t||null===t?e.mask_selector=l:(0,c.R)(5,t)},get   
  block_class(){return"nr-block"},get ignore_class(){return"nr-ignore"},get
  mask_text_class(){return"nr-mask"},get block_selector(){return e.block_selector},set
  block_selector(t){a(t)?e.block_selector+=",".concat(t):""!==t&&(0,c.R)(6,t)},get
  mask_input_options(){return e.mask_input_options},set mask_input_options(t){t&&"object"==typeof
  t?e.mask_input_options={...t,password:!0}:(0,c.R)(7,t)}},session_trace:{enabled:!0,autoStart:!0},soft_navigations:{enabled:!0,autoStart:!0},spa:{enabled:!0,autoStart:!0},ssl:void
  0,user_actions:{enabled:!0,elementAttributes:["id","className","tagName","type"]}}},g={},p="All
  configuration objects require an agent identifier!";function m(e,t){if(!e)throw new
  Error(p);g[e]=(0,d.a)(t,f());const r=(0,u.nY)(e);r&&(r.init=g[e])}function h(e,t){if(!e)throw new
  Error(p);var r=function(e){if(!e)throw new Error(p);if(!g[e])throw new Error("Configuration for
  ".concat(e," was never set"));return g[e]}(e);if(r){for(var
  n=t.split("."),i=0;i<n.length-1;i++)if("object"!=typeof(r=r[n[i]]))return;r=r[n[n.length-1]]}return
  r}},3371:(e,t,r)=>{"use strict";r.d(t,{V:()=>f,f:()=>l});var
  n=r(8122),i=r(384),o=r(6154),a=r(9324);let s=0;const
  c={buildEnv:a.F3,distMethod:a.Xs,version:a.xv,originTime:o.WN},u={appMetadata:{},customTransaction:void
  0,denyList:void 0,disabled:!1,entityManager:void 0,harvester:void
  0,isolatedBacklog:!1,loaderType:void 0,maxBytes:3e4,obfuscator:void 0,onerror:void 0,ptid:void
  0,releaseIds:{},session:void 0,timeKeeper:void 0},d={};function l(e){if(!e)throw new Error("All
  runtime objects require an agent identifier!");if(!d[e])throw new Error("Runtime for ".concat(e,"
  was never set"));return d[e]}function f(e,t){if(!e)throw new Error("All runtime objects require an
  agent
  identifier!");d[e]={...(0,n.a)(t,u),...c},Object.hasOwnProperty.call(d[e],"harvestCount")||Object.defineProperty(d[e],"harvestCount",{get:()=>++s});const
  r=(0,i.nY)(e);r&&(r.runtime=d[e])}},9324:(e,t,r)=>{"use
  strict";r.d(t,{F3:()=>i,Xs:()=>o,xv:()=>n});const
  n="1.288.1",i="PROD",o="CDN"},6154:(e,t,r)=>{"use
  strict";r.d(t,{OF:()=>c,RI:()=>i,WN:()=>d,bv:()=>o,gm:()=>a,mw:()=>s,sb:()=>u});var
  n=r(1863);const i="undefined"!=typeof window&&!!window.document,o="undefined"!=typeof
  WorkerGlobalScope&&("undefined"!=typeof self&&self instanceof WorkerGlobalScope&&self.navigator
  instanceof WorkerNavigator||"undefined"!=typeof globalThis&&globalThis instanceof
  WorkerGlobalScope&&globalThis.navigator instanceof WorkerNavigator),a=i?window:"undefined"!=typeof
  WorkerGlobalScope&&("undefined"!=typeof self&&self instanceof
  WorkerGlobalScope&&self||"undefined"!=typeof globalThis&&globalThis instanceof
  WorkerGlobalScope&&globalThis),s=Boolean("hidden"===a?.document?.visibilityState),c=/iPad|iPhone|iPod/.test(a.navigator?.userAgent),u=c&&"undefined"==typeof
  SharedWorker,d=((()=>{const
  e=a.navigator?.userAgent?.match(/Firefox[/\\s](\\d+\\.\\d+)/);Array.isArray(e)&&e.length>=2&&e[1]})(),Date.now()-(0,n.t)())},3241:(e,t,r)=>{"use
  strict";r.d(t,{W:()=>o});var n=r(6154);const i="newrelic";function
  o(e={}){try{n.gm.dispatchEvent(new CustomEvent(i,{detail:e}))}catch(e){}}},1687:(e,t,r)=>{"use
  strict";r.d(t,{Ak:()=>c,Ze:()=>l,x3:()=>u});var n=r(7836),i=r(3606),o=r(860),a=r(2646);const
  s={};function c(e,t){const
  r={staged:!1,priority:o.P3[t]||0};d(e),s[e].get(t)||s[e].set(t,r)}function
  u(e,t){e&&s[e]&&(s[e].get(t)&&s[e].delete(t),g(e,t,!1),s[e].size&&f(e))}function d(e){if(!e)throw
  new Error("agentIdentifier required");s[e]||(s[e]=new Map)}function
  l(e="",t="feature",r=!1){if(d(e),!e||!s[e].get(t)||r)return
  g(e,t);s[e].get(t).staged=!0,f(e)}function f(e){const
  t=Array.from(s[e]);t.every((([e,t])=>t.staged))&&(t.sort(((e,t)=>e[1].priority-t[1].priority)),t.forEach((([t])=>{s[e].delete(t),g(e,t)})))}function
  g(e,t,r=!0){const o=e?n.ee.get(e):n.ee,s=i.i.handlers;if(!o.aborted&&o.backlog&&s){if(r){const
  e=o.backlog[t],r=s[t];if(r){for(let
  t=0;e&&t<e.length;++t)p(e[t],r);Object.entries(r).forEach((([e,t])=>{Object.values(t||{}).forEach((t=>{t[0]?.on&&t[0]?.context()instanceof
  a.y&&t[0].on(e,t[1])}))}))}}o.isolatedBacklog||delete
  s[t],o.backlog[t]=null,o.emit("drain-"+t,[])}}function p(e,t){var
  r=e[1];Object.values(t[r]||{}).forEach((t=>{var r=e[0];if(t[0]===r){var
  n=t[1],i=e[3],o=e[2];n.apply(i,o)}}))}},7836:(e,t,r)=>{"use strict";r.d(t,{P:()=>c,ee:()=>u});var
  n=r(384),i=r(8990),o=r(3371),a=r(2646),s=r(5607);const c="nr@context:".concat(s.W),u=function
  e(t,r){var n={},s={},d={},l=!1;try{l=16===r.length&&(0,o.f)(r).isolatedBacklog}catch(e){}var
  f={on:p,addEventListener:p,removeEventListener:function(e,t){var r=n[e];if(!r)return;for(var
  i=0;i<r.length;i++)r[i]===t&&r.splice(i,1)},emit:function(e,r,n,i,o){!1!==o&&(o=!0);if(u.aborted&&!i)return;t&&o&&t.emit(e,r,n);for(var
  a=g(n),c=m(e),d=c.length,l=0;l<d;l++)c[l].apply(a,r);var p=v()[s[e]];p&&p.push([f,e,r,a]);return
  a},get:h,listeners:m,context:g,buffer:function(e,t){const
  r=v();if(t=t||"feature",f.aborted)return;Object.entries(e||{}).forEach((([e,n])=>{s[n]=t,t in
  r||(r[t]=[])}))},abort:function(){f._aborted=!0,Object.keys(f.backlog).forEach((e=>{delete
  f.backlog[e]}))},isBuffering:function(e){return!!v()[s[e]]},debugId:r,backlog:l?{}:t&&"object"==typeof
  t.backlog?t.backlog:{},isolatedBacklog:l};return Object.defineProperty(f,"aborted",{get:()=>{let
  e=f._aborted||!1;return e||(t&&(e=t.aborted),e)}}),f;function g(e){return e&&e instanceof
  a.y?e:e?(0,i.I)(e,c,(()=>new a.y(c))):new a.y(c)}function p(e,t){n[e]=m(e).concat(t)}function
  m(e){return n[e]||[]}function h(t){return d[t]=d[t]||e(f,t)}function v(){return f.backlog}}(void
  0,"globalEE"),d=(0,n.Zm)();d.ee||(d.ee=u)},2646:(e,t,r)=>{"use strict";r.d(t,{y:()=>n});class
  n{constructor(e){this.contextId=e}}},9908:(e,t,r)=>{"use strict";r.d(t,{d:()=>n,p:()=>i});var
  n=r(7836).ee.get("handle");function
  i(e,t,r,i,o){o?(o.buffer([e],i),o.emit(e,t,r)):(n.buffer([e],i),n.emit(e,t,r))}},3606:(e,t,r)=>{"use
  strict";r.d(t,{i:()=>o});var n=r(9908);o.on=a;var i=o.handlers={};function
  o(e,t,r,o){a(o||n.d,i,e,t,r)}function '... 24728 more characters,
    error_message: 'Failed to parse response: <!DOCTYPE html>\n' +
      '<html>\n' +
      '    <head>\n' +
      '        <meta http-equiv="Content-Type" content="text/html; Charse...'
  }