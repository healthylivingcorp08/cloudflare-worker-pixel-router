// Script to update KV store values using wrangler
// Usage: npm run update-kv -- --site=siteA --key=checkout_offer_id --value=123

import { execSync } from 'child_process';

interface KVUpdateOptions {
  site: string;
  key: string;
  value: string;
}

function parseArgs(): KVUpdateOptions {
  const args = process.argv.slice(2);
  const options: Partial<KVUpdateOptions> = {};

  for (const arg of args) {
    const [key, value] = arg.replace('--', '').split('=');
    if (key && value) {
      options[key as keyof KVUpdateOptions] = value;
    }
  }

  if (!options.site || !options.key || !options.value) {
    console.error('Missing required arguments!');
    console.error('Usage: npm run update-kv -- --site=siteA --key=checkout_offer_id --value=123');
    process.exit(1);
  }

  return options as KVUpdateOptions;
}

function updateKV({ site, key, value }: KVUpdateOptions): void {
  try {
    // The full key in KV will be prefixed with the site ID, using a colon separator
    const kvKey = `${site}:${key}`; // Changed underscore to colon

    // Use wrangler to put the value in KV
    const command = `wrangler kv:key put --binding=PIXEL_CONFIG "${kvKey}" "${value}"`;
    
    console.log(`Updating KV store...`);
    console.log(`Key: ${kvKey}`);
    console.log(`Value: ${value}`);
    
    execSync(command, { stdio: 'inherit' });
    
    console.log('\nKV store updated successfully!');
    
  } catch (error) {
    console.error('\nFailed to update KV store:', error);
    process.exit(1);
  }
}

// Run the script
const options = parseArgs();
updateKV(options);

/* Example KV keys that need to be set for siteA:
siteA_presell_offer_id
siteA_landing_offer_id
siteA_checkout_offer_id
siteA_checkout_campaign_id
siteA_checkout_product_id
siteA_upsell1_offer_id
siteA_upsell1_campaign_id
siteA_upsell1_product_id
siteA_upsell2_offer_id
siteA_upsell2_campaign_id
siteA_upsell2_product_id
stickyio_api_endpoint
*/