#!/bin/bash

# Script to populate local Cloudflare KV (PIXEL_CONFIG binding) with example drivebright data.
# Assumes JSON files are located in ./kv-data/ relative to this script.
# Run this script from the project root directory (cloudflare-worker-pixel-router).

echo "Populating local KV for drivebright..."

# --- Simple Values ---
npx wrangler kv key put drivebright_rule_scrubPercent "20" --binding PIXEL_CONFIG --local

# --- JSON Values (from files) ---
# Ensure the corresponding .json files exist in ./scripts/kv-data/

KV_DATA_DIR="./scripts/kv-data"

# Page Rules
npx wrangler kv key put drivebright_rule_pageRules --path "${KV_DATA_DIR}/drivebright_rule_pageRules.json" --binding PIXEL_CONFIG --local

# Action Definitions
npx wrangler kv key put drivebright_action_efClick --path "${KV_DATA_DIR}/drivebright_action_efClick.json" --binding PIXEL_CONFIG --local
npx wrangler kv key put drivebright_action_efConversion --path "${KV_DATA_DIR}/drivebright_action_efConversion.json" --binding PIXEL_CONFIG --local
npx wrangler kv key put drivebright_action_fbPurchase --path "${KV_DATA_DIR}/drivebright_action_fbPurchase.json" --binding PIXEL_CONFIG --local
npx wrangler kv key put drivebright_action_scrubPixel --path "${KV_DATA_DIR}/drivebright_action_scrubPixel.json" --binding PIXEL_CONFIG --local

# Rule Actions
npx wrangler kv key put drivebright_rule_checkoutNormalActions --path "${KV_DATA_DIR}/drivebright_rule_checkoutNormalActions.json" --binding PIXEL_CONFIG --local
npx wrangler kv key put drivebright_rule_checkoutScrubActions --path "${KV_DATA_DIR}/drivebright_rule_checkoutScrubActions.json" --binding PIXEL_CONFIG --local
npx wrangler kv key put drivebright_rule_checkoutCampIdRules --path "${KV_DATA_DIR}/drivebright_rule_checkoutCampIdRules.json" --binding PIXEL_CONFIG --local
npx wrangler kv key put drivebright_rule_interstitialAffIdRules --path "${KV_DATA_DIR}/drivebright_rule_interstitialAffIdRules.json" --binding PIXEL_CONFIG --local
npx wrangler kv key put drivebright_rule_presellAffIdRules --path "${KV_DATA_DIR}/drivebright_rule_presellAffIdRules.json" --binding PIXEL_CONFIG --local

echo "Local KV population complete (check for any errors above)."