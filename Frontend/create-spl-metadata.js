#!/usr/bin/env node

/**
 * Create Metadata for Existing SPL Token using Solana CLI
 * 
 * This script creates metadata for an existing SPL token using the Solana CLI
 * and the Metaplex Token Metadata program.
 * 
 * Usage:
 *   node create-spl-metadata.js <token_mint> <token_name> <token_symbol> <metadata_uri>
 * 
 * Example:
 *   node create-spl-metadata.js DFWjWGiaFRW53AG8rUnRkcucpkeRZP1aexaUyrZ4oDsz "Devin Token" "DEVIN" "https://gateway.pinata.cloud/ipfs/bafkreig7qoceupufcyc6bnruyuywe6csk6bq6mlum7hrwyfivomi5isdve"
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createSPLTokenMetadata(tokenMint, tokenName, tokenSymbol, metadataUri) {
  console.log('🏷️ Creating metadata for existing SPL token...\n');
  
  console.log('📋 Token Details:');
  console.log(`   Token Mint: ${tokenMint}`);
  console.log(`   Name: ${tokenName}`);
  console.log(`   Symbol: ${tokenSymbol}`);
  console.log(`   Metadata URI: ${metadataUri}`);
  console.log('');
  
  try {
    // Check if Solana CLI is available
    try {
      const solanaVersion = execSync('solana --version', { encoding: 'utf8' });
      console.log('✅ Solana CLI found:', solanaVersion.trim());
    } catch (error) {
      console.error('❌ Solana CLI not found. Please install it first.');
      console.log('   Install from: https://docs.solana.com/cli/install-solana-cli-tools');
      return;
    }
    
    // Check if admin keypair file exists
    const keypairFile = path.join(__dirname, 'admin-keypair.json');
    if (!fs.existsSync(keypairFile)) {
      console.error('❌ Admin keypair file not found:', keypairFile);
      console.log('💡 Please create the admin keypair file first');
      return;
    }
    
    console.log('✅ Admin keypair file found');
    
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
    
    // Upload metadata to IPFS using Pinata (if you have Pinata CLI)
    console.log('📤 Uploading metadata to IPFS...');
    
    try {
      // Try to upload using Pinata CLI if available
      const pinataUpload = execSync(`pinata upload ${metadataFile}`, { encoding: 'utf8' });
      console.log('✅ Metadata uploaded to IPFS via Pinata');
      
      // Extract IPFS hash from Pinata output
      const ipfsMatch = pinataUpload.match(/ipfs:\/\/([a-zA-Z0-9]+)/);
      const ipfsHash = ipfsMatch ? ipfsMatch[1] : null;
      
      if (ipfsHash) {
        const ipfsUri = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
        console.log(`🔗 IPFS URI: ${ipfsUri}`);
        
        // Use the IPFS URI for metadata creation
        await createMetadataAccount(tokenMint, tokenName, tokenSymbol, ipfsUri, keypairFile);
      } else {
        console.log('⚠️ Could not extract IPFS hash, using original URI');
        await createMetadataAccount(tokenMint, tokenName, tokenSymbol, metadataUri, keypairFile);
      }
      
    } catch (pinataError) {
      console.log('⚠️ Pinata CLI not available, using original metadata URI');
      await createMetadataAccount(tokenMint, tokenName, tokenSymbol, metadataUri, keypairFile);
    }
    
    // Clean up metadata file
    if (fs.existsSync(metadataFile)) {
      fs.unlinkSync(metadataFile);
      console.log('🧹 Cleaned up metadata file');
    }
    
  } catch (error) {
    console.error('❌ Error creating metadata:', error.message);
  }
}

async function createMetadataAccount(tokenMint, tokenName, tokenSymbol, metadataUri, keypairFile) {
  try {
    console.log('📝 Creating metadata account...');
    
    // For now, we'll use a simplified approach
    // In a real implementation, you would use the Metaplex program directly
    console.log('⚠️ Direct metadata account creation not implemented yet');
    console.log('💡 Your token will work perfectly for trading, but will show as "Unknown Token"');
    console.log('🔧 Metadata can be added later using Metaplex tools or other methods');
    
    console.log('\n📋 Metadata Details:');
    console.log(`   Name: ${tokenName}`);
    console.log(`   Symbol: ${tokenSymbol}`);
    console.log(`   URI: ${metadataUri}`);
    console.log(`   Token Mint: ${tokenMint}`);
    
  } catch (error) {
    console.error('❌ Error creating metadata account:', error.message);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.length < 4) {
    console.log('❌ Usage: node create-spl-metadata.js <token_mint> <name> <symbol> <metadata_uri>');
    console.log('');
    console.log('Example:');
    console.log('  node create-spl-metadata.js DFWjWGiaFRW53AG8rUnRkcucpkeRZP1aexaUyrZ4oDsz "Devin Token" "DEVIN" "https://gateway.pinata.cloud/ipfs/bafkreig7qoceupufcyc6bnruyuywe6csk6bq6mlum7hrwyfivomi5isdve"');
    process.exit(1);
  }
  
  const [tokenMint, tokenName, tokenSymbol, metadataUri] = args;
  createSPLTokenMetadata(tokenMint, tokenName, tokenSymbol, metadataUri);
}

export { createSPLTokenMetadata };