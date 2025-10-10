const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58').default;

// Generate a new keypair
const keypair = Keypair.generate();

console.log('🔑 Generated Base58 Keypair:');
console.log('Public Key:', keypair.publicKey.toBase58());
console.log('Private Key (Base58):', bs58.encode(keypair.secretKey));
console.log('');
console.log('📋 Copy this for your GitHub secret DEVNET_DEPLOYER_KEYPAIR:');
console.log(bs58.encode(keypair.secretKey));
console.log('');
console.log('💾 Saving to file: devnet-deployer-keypair.json');
const fs = require('fs');
fs.writeFileSync('devnet-deployer-keypair.json', JSON.stringify({
  publicKey: keypair.publicKey.toBase58(),
  secretKey: Array.from(keypair.secretKey)
}));
console.log('✅ Keypair saved to devnet-deployer-keypair.json');