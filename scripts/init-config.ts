const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const NAMESPACE_ID = 'd6db5d0cfcb14e98b2d7f1bd5567f74f';

// Helper to run wrangler commands
function runWrangler(args) {
  return new Promise((resolve, reject) => {
    const process = spawn('npx', ['wrangler', ...args], {
      stdio: 'inherit',
      shell: true
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
  });
}

async function main() {
  try {
    console.log('Initializing KV store with configuration...');

    // Read the site configuration
    const configPath = path.resolve(__dirname, '../config/sites/siteA.json');
    const siteConfig = fs.readFileSync(configPath, 'utf-8');

    // Initial KV values
    const initialValues = {
      // Site configuration
      'site_config_siteA': siteConfig,
      
      // Dynamic values
      'siteA_presell_offer_id': '746',
      'siteA_landing_offer_id': '746',
      'siteA_checkout_offer_id': '746',
      'siteA_checkout_campaign_id': '123',
      'siteA_checkout_product_id': '456',
      'stickyio_api_endpoint': 'https://api.stickyio.com/order'
    };

    // Update each value in KV
    for (const [key, value] of Object.entries(initialValues)) {
      console.log(`Setting ${key}...`);
      await runWrangler([
        'kv:key',
        'put',
        '--namespace-id',
        NAMESPACE_ID,
        key,
        value,
        '--remote'
      ]);
    }

    console.log('Configuration initialized successfully!');
  } catch (error) {
    console.error('Failed to initialize configuration:', error);
    process.exit(1);
  }
}

main();