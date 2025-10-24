#!/usr/bin/env node

/**
 * Generate Admin Keypair for Metaplex Metadata Creation
 * 
 * This script generates a new Solana keypair that can be used as an admin wallet
 * for creating Metaplex metadata for tokens created through the platform.
 * 
 * Usage:
 *   node generate-admin-keypair.js
 * 
 * The script will:
 * 1. Generate a new keypair
 * 2. Display the public key and private key
 * 3. Provide instructions on how to add it to your .env file
 * 4. Show how to fund the wallet
 */

const { Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

function generateAdminKeypair() {
  console.log('🔑 Generating Admin Keypair for Metaplex Metadata Creation...\n');
  
  // Generate a new keypair
  const keypair = Keypair.generate();
  
  // Get the private key as base58 string
  const privateKeyBase58 = Buffer.from(keypair.secretKey).toString('base64');
  
  console.log('✅ Admin Keypair Generated Successfully!\n');
  console.log('📋 Keypair Details:');
  console.log('   Public Key:', keypair.publicKey.toBase58());
  console.log('   Private Key (Base64):', privateKeyBase58);
  console.log('');
  
  console.log('📝 Next Steps:');
  console.log('1. Add the following line to your .env file:');
  console.log(`   VITE_ADMIN_PRIVATE_KEY=${privateKeyBase58}`);
  console.log('');
  console.log('2. Fund the admin wallet with SOL for transaction fees:');
  console.log(`   solana transfer ${keypair.publicKey.toBase58()} 0.01 --from <your-main-wallet> --url devnet`);
  console.log('');
  console.log('3. Restart your development server to load the new environment variable');
  console.log('');
  
  console.log('⚠️  Security Notes:');
  console.log('   - Keep the private key secure and never commit it to version control');
  console.log('   - This keypair will be used to create metadata for all tokens');
  console.log('   - Only fund it with the minimum SOL needed for transaction fees');
  console.log('');
  
  // Try to update the .env file automatically
  try {
    const envPath = path.join(__dirname, '.env');
    const envContent = `# Admin Keypair for Metaplex Metadata Creation
VITE_ADMIN_PRIVATE_KEY=${privateKeyBase58}

# Add this line to your existing .env file
`;
    
    if (fs.existsSync(envPath)) {
      console.log('📄 Found existing .env file, appending admin keypair...');
      fs.appendFileSync(envPath, `\n# Admin Keypair for Metaplex Metadata Creation\nVITE_ADMIN_PRIVATE_KEY=${privateKeyBase58}\n`);
      console.log('✅ Admin keypair added to .env file');
    } else {
      console.log('📄 Creating new .env file with admin keypair...');
      fs.writeFileSync(envPath, envContent);
      console.log('✅ New .env file created with admin keypair');
    }
  } catch (error) {
    console.log('⚠️  Could not automatically update .env file:', error.message);
    console.log('   Please manually add the VITE_ADMIN_PRIVATE_KEY to your .env file');
  }
  
  console.log('\n🎉 Setup Complete! Your tokens will now show up in wallets with proper metadata.');
}

// Run the script
if (require.main === module) {
  generateAdminKeypair();
}

module.exports = { generateAdminKeypair };