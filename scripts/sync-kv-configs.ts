import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { SitesConfig, SiteConfig } from '../src/types'; // Assuming types are correctly exported

// Define the path to the main configuration file relative to the script location
// Adjust this path if your config file is located elsewhere in the monorepo
const CONFIG_FILE_PATH = path.resolve(__dirname, '../config/sites.json');
const KV_NAMESPACE_BINDING = 'PIXEL_CONFIG'; // Match the binding in wrangler.toml

function loadConfigFromFile(filePath: string): SitesConfig {
  try {
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const config = JSON.parse(rawData);
    // Basic validation (can be enhanced)
    if (typeof config !== 'object' || config === null) {
      throw new Error('Invalid format: root should be an object.');
    }
    // Add more validation based on SitesConfig structure if needed
    return config as SitesConfig; // Return the loaded config here
  } catch (error: any) {
    console.error(`Error reading or parsing config file at ${filePath}:`, error.message);
    process.exit(1);
  }
}

function syncSiteConfigToKV(siteId: string, siteConfig: SiteConfig): void {
  const kvKey = `site_config_${siteId}`;
  const value = JSON.stringify(siteConfig);

  // Escape quotes for the shell command
  const escapedValue = value.replace(/"/g, '\\"');

  try {
    // Use wrangler to put the stringified config value into KV
    // Ensure wrangler is installed and configured
    const command = `wrangler kv:key put --binding=${KV_NAMESPACE_BINDING} "${kvKey}" "${escapedValue}"`;

    console.log(`\nSyncing config for site: ${siteId}`);
    console.log(`KV Key: ${kvKey}`);
    // console.log(`Value: ${value}`); // Avoid logging potentially large/sensitive config

    execSync(command, { stdio: 'inherit' });

    console.log(`Successfully synced config for ${siteId} to KV.`);

  } catch (error) {
    console.error(`\nFailed to sync config for site ${siteId} to KV:`, error);
    // Decide if you want to exit on first error or continue
    // process.exit(1);
  }
}

function main() {
  console.log(`Loading configuration from: ${CONFIG_FILE_PATH}`);
  const sitesConfig = loadConfigFromFile(CONFIG_FILE_PATH);

  console.log('Starting KV configuration sync...');

  // Iterate through the sites defined in the config file
  for (const [siteId, siteConfig] of Object.entries(sitesConfig)) {
    // Ensure the siteConfig has the siteId embedded if your structure requires it
    // If not already present, you might want to add it:
    // if (!siteConfig.siteId) {
    //   siteConfig.siteId = siteId;
    // }
    syncSiteConfigToKV(siteId, siteConfig);
  }

  console.log('\nKV configuration sync finished.');
}

// Run the main function
main();