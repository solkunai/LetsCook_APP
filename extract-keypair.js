// Extract keypair from your existing SOLANA_KEYPAIR secret
// Run this to get the byte array format

const fs = require('fs');

// If you have the keypair JSON file locally, read it
try {
  const keypairPath = process.argv[2] || '~/.config/solana/id.json';
  const keypair = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  
  console.log('🔑 Your keypair as byte array:');
  console.log('='.repeat(50));
  console.log(JSON.stringify(keypair));
  console.log('='.repeat(50));
  console.log('');
  console.log('📋 Copy this entire array for your GitHub secrets:');
  console.log('DEVNET_DEPLOYER_KEYPAIR: ' + JSON.stringify(keypair));
  console.log('PROGRAM_ADDRESS_KEYPAIR: ' + JSON.stringify(keypair));
  
} catch (error) {
  console.log('❌ Could not read keypair file');
  console.log('Please provide the path to your keypair file:');
  console.log('node extract-keypair.js /path/to/your/keypair.json');
  console.log('');
  console.log('Or if you have the keypair JSON content, paste it here:');
  console.log('Example: [3,45,23,67,89,12,34,56,78,90,...]');
}