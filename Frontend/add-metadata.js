#!/usr/bin/env node

/**
 * Add Metaplex Metadata to Existing Token
 * 
 * This script adds metadata to an existing token using Metaplex CLI
 * 
 * Usage:
 *   node add-metadata.js <token_mint_address> <token_name> <token_symbol> <metadata_uri>
 * 
 * Example:
 *   node add-metadata.js DFWjWGiaFRW53AG8rUnRkcucpkeRZP1aexaUyrZ4oDsz "Devin Token" "DEVIN" "https://gateway.pinata.cloud/ipfs/bafkreig7qoceupufcyc6bnruyuywe6csk6bq6mlum7hrwyfivomi5isdve"
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function addMetadataToToken(tokenMint, tokenName, tokenSymbol, metadataUri) {
  console.log('🏷️ Adding Metaplex metadata to token...\n');
  
  console.log('📋 Token Details:');
  console.log(`   Token Mint: ${tokenMint}`);
  console.log(`   Name: ${tokenName}`);
  console.log(`   Symbol: ${tokenSymbol}`);
  console.log(`   Metadata URI: ${metadataUri}`);
  console.log('');
  
  try {
    // Check if Metaplex CLI is installed
    try {
      execSync('metaplex --version', { stdio: 'pipe' });
      console.log('✅ Metaplex CLI found');
    } catch (error) {
      console.log('❌ Metaplex CLI not found. Installing...');
      console.log('   Run: npm install -g @metaplex-foundation/metaplex');
      console.log('   Or: yarn global add @metaplex-foundation/metaplex');
      return;
    }
    
    // Create metadata JSON file
    const metadataJson = {
      name: tokenName,
      symbol: tokenSymbol,
      description: `${tokenName} - A token created on Let's Cook platform`,
      image: metadataUri,
      attributes: [
        {
          trait_type: "Platform",
          value: "Let's Cook"
        },
        {
          trait_type: "Type",
          value: "Instant Launch"
        }
      ],
      properties: {
        files: [
          {
            uri: metadataUri,
            type: "image/jpeg"
          }
        ],
        category: "image",
        creators: [
          {
            address: "EXxrr4binqy7W9zUCuPKCGtz1DkmuMm1jQRnkX2UPqV", // Admin wallet
            share: 100
          }
        ]
      }
    };
    
    const metadataFile = `metadata-${tokenMint}.json`;
    fs.writeFileSync(metadataFile, JSON.stringify(metadataJson, null, 2));
    console.log(`📄 Created metadata file: ${metadataFile}`);
    
    // Upload metadata to IPFS (if needed)
    console.log('📤 Uploading metadata to IPFS...');
    const uploadCommand = `metaplex upload ${metadataFile} --env devnet`;
    console.log(`Running: ${uploadCommand}`);
    
    try {
      const uploadResult = execSync(uploadCommand, { encoding: 'utf8' });
      console.log('✅ Metadata uploaded to IPFS');
      console.log('Upload result:', uploadResult);
      
      // Extract the IPFS URI from the result
      const ipfsMatch = uploadResult.match(/https:\/\/[^\s]+/);
      const ipfsUri = ipfsMatch ? ipfsMatch[0] : metadataUri;
      
      console.log(`🔗 IPFS URI: ${ipfsUri}`);
      
      // Create metadata account
      console.log('📝 Creating metadata account...');
      const createCommand = `metaplex create_metadata_accounts --env devnet --keypair admin-keypair.json --mint ${tokenMint} --uri "${ipfsUri}"`;
      console.log(`Running: ${createCommand}`);
      
      try {
        const createResult = execSync(createCommand, { encoding: 'utf8' });
        console.log('✅ Metadata account created successfully!');
        console.log('Create result:', createResult);
        
        console.log('\n🎉 Metadata added successfully!');
        console.log('🎯 Your token will now show up in wallets with proper metadata!');
        
      } catch (createError) {
        console.error('❌ Failed to create metadata account:', createError.message);
        console.log('💡 You may need to create the admin keypair file first');
        console.log('   Run: solana-keygen new --outfile admin-keypair.json');
      }
      
    } catch (uploadError) {
      console.error('❌ Failed to upload metadata:', uploadError.message);
      console.log('💡 Using provided metadata URI instead');
      
      // Try to create metadata account with provided URI
      console.log('📝 Creating metadata account with provided URI...');
      const createCommand = `metaplex create_metadata_accounts --env devnet --keypair admin-keypair.json --mint ${tokenMint} --uri "${metadataUri}"`;
      
      try {
        const createResult = execSync(createCommand, { encoding: 'utf8' });
        console.log('✅ Metadata account created successfully!');
        console.log('Create result:', createResult);
        
        console.log('\n🎉 Metadata added successfully!');
        console.log('🎯 Your token will now show up in wallets with proper metadata!');
        
      } catch (createError) {
        console.error('❌ Failed to create metadata account:', createError.message);
        console.log('💡 You may need to create the admin keypair file first');
        console.log('   Run: solana-keygen new --outfile admin-keypair.json');
      }
    }
    
    // Clean up metadata file
    if (fs.existsSync(metadataFile)) {
      fs.unlinkSync(metadataFile);
      console.log('🧹 Cleaned up metadata file');
    }
    
  } catch (error) {
    console.error('❌ Error adding metadata:', error.message);
    console.log('💡 Make sure Metaplex CLI is installed and configured');
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.length < 4) {
    console.log('❌ Usage: node add-metadata.js <token_mint> <name> <symbol> <metadata_uri>');
    console.log('');
    console.log('Example:');
    console.log('  node add-metadata.js DFWjWGiaFRW53AG8rUnRkcucpkeRZP1aexaUyrZ4oDsz "Devin Token" "DEVIN" "https://gateway.pinata.cloud/ipfs/bafkreig7qoceupufcyc6bnruyuywe6csk6bq6mlum7hrwyfivomi5isdve"');
    process.exit(1);
  }
  
  const [tokenMint, tokenName, tokenSymbol, metadataUri] = args;
  addMetadataToToken(tokenMint, tokenName, tokenSymbol, metadataUri);
}

export { addMetadataToToken };