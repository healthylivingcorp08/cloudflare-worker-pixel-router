# Example KV Structure for PIXEL_CONFIG Namespace

This document outlines an example structure for storing site configuration within the `PIXEL_CONFIG` Cloudflare KV namespace. This example uses `drivebright` as the `siteId`.

## Naming Convention

Keys generally follow the pattern: `{siteId}_{type}_{name}`

*   `{siteId}`: e.g., `drivebright`
*   `{type}`: `rule` (for decision logic parameters) or `action` (for defining specific pixels/scripts)
*   `{name}`: Describes the specific rule or action

## Example Keys and Values for `drivebright`

Values marked as `(JSON String)` should be stored in KV as a string containing valid JSON.

---

1.  **Key:** `drivebright_rule_scrubPercent`
    *   **Type:** Simple Value
    *   **Value:** `20`
    *   **Description:** The percentage of checkouts to designate as "scrub".

---

2.  **Key:** `drivebright_rule_pageRules`
    *   **Type:** JSON String
    *   **Value:**
        ```json
        [
          { "pattern": "/checkout/thank-you", "type": "checkout" },
          { "pattern": "/pre", "type": "presell" },
          { "pattern": "/inter", "type": "interstitial" }
        ]
        ```
    *   **Description:** Rules for mapping URL path patterns to page types. The backend logic determines how patterns are matched (e.g., `startsWith`).

---

3.  **Key:** `drivebright_action_efClick`
    *   **Type:** JSON String
    *   **Value:**
        ```json
        {
          "type": "everflowClick",
          "scriptSrc": "https://www.c6orlterk.com/scripts/sdk/everflow.js",
          "params": {
            "offer_id": "PARAM:c2",
            "affiliate_id": "PARAM:c1",
            "sub1": "PARAM:sub1",
            "sub2": "PARAM:sub2",
            "sub3": "PARAM:sub3",
            "sub4": "PARAM:sub4",
            "sub5": "PARAM:sub5",
            "uid": "PARAM:uid",
            "source_id": "PARAM:source_id",
            "transaction_id": "PARAM:_ef_transaction_id"
          }
        }
        ```
    *   **Description:** Defines how to execute an Everflow click action. `PARAM:key` tells the frontend to get the value from the URL query parameter `key`.

---

4.  **Key:** `drivebright_action_efConversion`
    *   **Type:** JSON String
    *   **Value:**
        ```json
        {
          "type": "everflowConversion",
          "scriptSrc": "https://www.c6orlterk.com/scripts/sdk/everflow.js",
          "params": {
            "offer_id": "VALUE:YOUR_OFFER_ID",
            "affiliate_id": "CONTEXT:affid",
            "transaction_id": "CONTEXT:clickid",
            "amount": "CONTEXT:total",
            "adv1": "CONTEXT:affid"
          }
        }
        ```
    *   **Description:** Defines how to execute an Everflow conversion action. `VALUE:literal` uses the literal string. `CONTEXT:key` tells the frontend to use data passed back from the backend API context (e.g., from `/api/process-checkout`).

---

5.  **Key:** `drivebright_action_fbPurchase`
    *   **Type:** JSON String
    *   **Value:**
        ```json
        {
          "type": "imagePixel",
          "template": "https://www.facebook.com/tr?id=YOUR_FB_PIXEL_ID&ev=Purchase&noscript=1&value={TOTAL}&currency=USD"
        }
        ```
    *   **Description:** Defines an image pixel action. Placeholders like `{TOTAL}` need filling (likely by backend).

---

6.  **Key:** `drivebright_action_scrubPixel`
    *   **Type:** JSON String
    *   **Value:**
        ```json
        {
          "type": "imagePixel",
          "template": "https://scrub.example.com/pixel?site=drivebright&txid={CLICK_ID}"
        }
        ```
    *   **Description:** Defines the image pixel to fire for scrubbed checkouts.

---

7.  **Key:** `drivebright_rule_checkoutNormalActions`
    *   **Type:** JSON String
    *   **Value:**
        ```json
        ["drivebright_action_fbPurchase", "drivebright_action_efConversion"]
        ```
    *   **Description:** List of action keys to execute for a normal (non-scrubbed) checkout.

---

8.  **Key:** `drivebright_rule_checkoutScrubActions`
    *   **Type:** JSON String
    *   **Value:**
        ```json
        ["drivebright_action_scrubPixel"]
        ```
    *   **Description:** List of action keys to execute for a scrubbed checkout.

---

9.  **Key:** `drivebright_rule_checkoutCampIdRules` *(Optional)*
    *   **Type:** JSON String
    *   **Value:**
        ```json
        [
          { "campId": "CAMP123", "actions": ["drivebright_action_scrubPixel"] },
          { "campId": "CAMP456", "actions": [] }
        ]
        ```
    *   **Description:** Optional rules to override default checkout actions based on `campId`. Backend logic applies these *after* the initial scrub decision.

---

10. **Key:** `drivebright_rule_interstitialAffIdRules`
    *   **Type:** JSON String
    *   **Value:**
        ```json
        [
          { "affId": "nva", "actions": ["drivebright_action_efClick"] },
          { "affId": "default", "actions": [] }
        ]
        ```
    *   **Description:** Rules for interstitial pages. Backend matches page type, finds the rule matching `affid` (or 'default'), and returns the specified actions.

---

11. **Key:** `drivebright_rule_presellAffIdRules`
    *   **Type:** JSON String
    *   **Value:**
        ```json
        [
          { "affId": "nva", "actions": ["drivebright_action_efClick"] },
          { "affId": "default", "actions": [] }
        ]
        ```
    *   **Description:** Rules for presell pages. Backend matches page type, finds the rule matching `affid` (or 'default'), and returns the specified actions.

---