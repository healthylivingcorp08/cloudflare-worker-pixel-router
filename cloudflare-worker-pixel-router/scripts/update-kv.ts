/**
 * Script to update Cloudflare KV (PIXEL_CONFIG) with site configs from config/sites.json.
 * Usage: npx ts-node scripts/update-kv.ts
 * Requires: wrangler CLI authenticated and PIXEL_CONFIG namespace bound in wrangler.toml.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const configPath = path.resolve(__dirname, '../config/sites.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const namespace = 'PIXEL_CONFIG';

for (const [site, siteConfig] of Object.entries(config)) {
  const value = JSON.stringify(siteConfig);
  // Use wrangler kv:key put to update the KV store
  const cmd = `npx wrangler kv:key put --binding=${namespace} "${site}" '${value}'`;
  console.log(`Updating KV for site "${site}"...`);
  execSync(cmd, { stdio: 'inherit' });
}

console.log('All site configs updated in Cloudflare KV.');