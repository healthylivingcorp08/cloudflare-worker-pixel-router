import { execSync } from 'child_process';
// Use dynamic imports for fs and path
// import fs from 'fs';
// import path from 'path';

interface SyncOptions {
  site: string;
  file: string;
}

interface SiteConfigs {
  [siteId: string]: {
    [key: string]: any; // Allow any value type
  };
}

function parseArgs(): SyncOptions {
  const args = process.argv.slice(2);
  const options: Partial<SyncOptions> = {
    file: 'config/sites.json' // Default config file
  };

  for (const arg of args) {
    const [key, value] = arg.replace('--', '').split('=');
    if (key && value) {
      options[key as keyof SyncOptions] = value;
    }
  }

  if (!options.site) {
    console.error('Missing required argument: --site=<siteId>');
    console.error('Usage: npm run sync-kv -- --site=siteA [--file=path/to/config.json]');
    process.exit(1);
  }

  return options as SyncOptions;
}

async function syncKV({ site, file }: SyncOptions): Promise<void> { // Make function async
  // Dynamically import fs and path
  const fs = await import('fs');
  const path = await import('path');

  const filePath = path.resolve(process.cwd(), file);
  console.log(`Reading configuration from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`Error: Configuration file not found at ${filePath}`);
    process.exit(1);
  }

  let allConfigs: SiteConfigs;
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    allConfigs = JSON.parse(fileContent);
  } catch (error: any) {
    console.error(`Error reading or parsing configuration file ${filePath}:`, error.message);
    process.exit(1);
  }

  const siteConfig = allConfigs[site];
  if (!siteConfig) {
    console.error(`Error: Site ID "${site}" not found in configuration file ${filePath}`);
    process.exit(1);
  }

  console.log(`\nSyncing configuration for site: ${site}`);
  console.log('------------------------------------');

  let successCount = 0;
  let errorCount = 0;

  for (const [key, value] of Object.entries(siteConfig)) {
    const kvKey = `${site}:${key}`;
    // Ensure value is stringified if it's an object/array, otherwise use as is
    const kvValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

    try {
      // Escape double quotes within the value for the command line
      const escapedValue = kvValue.replace(/"/g, '\\"');
      const command = `wrangler kv:key put --binding=PIXEL_CONFIG "${kvKey}" "${escapedValue}"`;

      console.log(`Updating key: ${kvKey}`);
      // console.log(`  Value: ${kvValue.substring(0, 50)}${kvValue.length > 50 ? '...' : ''}`); // Log truncated value
      // console.log(`  Command: ${command}`); // Uncomment for debugging command

      execSync(command, { stdio: 'pipe' }); // Use 'pipe' to suppress wrangler output unless error
      successCount++;

    } catch (error: any) {
      console.error(`\nFailed to update key "${kvKey}":`);
      // Try to print stderr from the failed command
      if (error.stderr) {
        console.error(error.stderr.toString());
      } else {
        console.error(error.message);
      }
      errorCount++;
    }
  }

  console.log('------------------------------------');
  console.log(`Sync complete for site: ${site}`);
  console.log(`Successfully updated keys: ${successCount}`);
  console.log(`Failed updates: ${errorCount}`);

  if (errorCount > 0) {
    process.exit(1); // Exit with error code if any updates failed
  }
}

// Run the script
async function main() {
  const options = parseArgs();
  await syncKV(options); // Await the async function
}

main().catch(error => {
  console.error("Script failed:", error);
  process.exit(1);
});