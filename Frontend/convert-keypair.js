#!/usr/bin/env node

/**
 * Convert Array Format Private Key to Metaplex Keypair File
 * 
 * This script converts the array format private key from your .env file
 * to a keypair file that Metaplex CLI can use.
 * 
 * Usage:
 *   node convert-keypair.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function convertKeypairToFile() {
  console.log('🔑 Converting array format private key to Metaplex keypair file...\n');
  
  try {
    // Read the .env file
    const envPath = path.join(__dirname, 'client', '.env');
    if (!fs.existsSync(envPath)) {
      console.error('❌ .env file not found at:', envPath);
      return;
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // Extract the private key array
    const privateKeyMatch = envContent.match(/VITE_ADMIN_PRIVATE_KEY=\[(.+)\]/);
    if (!privateKeyMatch) {
      console.error('❌ VITE_ADMIN_PRIVATE_KEY not found in .env file');
      return;
    }
    
    const privateKeyArray = JSON.parse(`[${privateKeyMatch[1]}]`);
    console.log('✅ Found private key array with', privateKeyArray.length, 'bytes');
    
    // Convert to Uint8Array
    const privateKeyBytes = new Uint8Array(privateKeyArray);
    
    // Create keypair object
    const keypair = {
      publicKey: null, // Will be calculated
      secretKey: Array.from(privateKeyBytes)
    };
    
    // Calculate public key (simplified - in real implementation you'd use proper key derivation)
    // For now, we'll use the public key from the .env file
    const publicKeyMatch = envContent.match(/VITE_ADMIN_PUBLIC_KEY=([A-Za-z0-9]+)/);
    if (publicKeyMatch) {
      keypair.publicKey = publicKeyMatch[1];
      console.log('✅ Found public key:', keypair.publicKey);
    } else {
      console.error('❌ VITE_ADMIN_PUBLIC_KEY not found in .env file');
      return;
    }
    
    // Save to keypair file
    const keypairFile = 'admin-keypair.json';
    fs.writeFileSync(keypairFile, JSON.stringify(keypair, null, 2));
    
    console.log('✅ Keypair file created:', keypairFile);
    console.log('');
    console.log('📋 Keypair Details:');
    console.log('   Public Key:', keypair.publicKey);
    console.log('   Secret Key Length:', keypair.secretKey.length, 'bytes');
    console.log('');
    console.log('🎯 You can now use this keypair file with Metaplex CLI!');
    console.log('');
    console.log('💡 Next steps:');
    console.log('   1. Install Metaplex CLI: npm install -g @metaplex-foundation/metaplex');
    console.log('   2. Add metadata to your token: node add-metadata.js <token_mint> <name> <symbol> <uri>');
    
  } catch (error) {
    console.error('❌ Error converting keypair:', error.message);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  convertKeypairToFile();
}

export { convertKeypairToFile };