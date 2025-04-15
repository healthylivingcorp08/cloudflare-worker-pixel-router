const { spawn } = require('child_process');

const NAMESPACE_ID = 'd6db5d0cfcb14e98b2d7f1bd5567f74f';

// Initial admin credentials
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123'; // Change this in production

// Helper to run wrangler commands
function runWrangler(key, value) {
  return new Promise((resolve, reject) => {
    const process = spawn('npx', [
      'wrangler',
      'kv',
      'key',
      'put',
      key,
      value,
      '--namespace-id',
      NAMESPACE_ID,
      '--remote'
    ], {
      stdio: 'inherit',
      shell: true
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
  });
}

async function main() {
  try {
    console.log('Setting up admin credentials...');
    
    // Store admin password
    await runWrangler(`auth_${ADMIN_USERNAME}`, ADMIN_PASSWORD);
    console.log('Admin user created successfully!');
    console.log('\nDefault credentials:');
    console.log('Username:', ADMIN_USERNAME);
    console.log('Password:', ADMIN_PASSWORD);
    console.log('\nPlease change these credentials in production!');
  } catch (error) {
    console.error('Failed to set up auth:', error);
    process.exit(1);
  }
}

main();