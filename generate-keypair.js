// Generate a new Solana keypair for GitHub secrets
const { Keypair } = require('@solana/web3.js');

// Generate a new keypair
const keypair = Keypair.generate();

console.log('🔑 NEW KEYPAIR GENERATED');
console.log('='.repeat(50));
console.log('Public Key:', keypair.publicKey.toString());
console.log('');
console.log('📋 Copy this for your GitHub secrets:');
console.log('='.repeat(50));
console.log('DEVNET_DEPLOYER_KEYPAIR:', JSON.stringify(Array.from(keypair.secretKey)));
console.log('PROGRAM_ADDRESS_KEYPAIR:', JSON.stringify(Array.from(keypair.secretKey)));
console.log('='.repeat(50));
console.log('');
console.log('🔗 Also add this secret:');
console.log('DEVNET_SOLANA_DEPLOY_URL: https://api.devnet.solana.com');