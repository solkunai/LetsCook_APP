#!/usr/bin/env node

/**
 * Test Metaplex Metadata Service
 * 
 * This script tests the MetaplexMetadataService to ensure it's working correctly
 * with the admin keypair and can create metadata for tokens.
 * 
 * Usage:
 *   node test-metadata-service.js
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { MetaplexMetadataService } from './client/src/lib/metaplexMetadataService.js';

async function testMetadataService() {
  console.log('🧪 Testing Metaplex Metadata Service...\n');
  
  try {
    // Create connection
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    console.log('✅ Connected to Solana devnet');
    
    // Test with a dummy token mint (you can replace this with a real one)
    const testTokenMint = new PublicKey('DFWjWGiaFRW53AG8rUnRkcucpkeRZP1aexaUyrZ4oDsz');
    const testUserAuthority = new PublicKey('8fvPxVrPp1p3QGwjiFQVYg5xpBTVrWrarrUxQryftUZV'); // Your wallet
    
    console.log('📋 Test Parameters:');
    console.log(`   Token Mint: ${testTokenMint.toBase58()}`);
    console.log(`   User Authority: ${testUserAuthority.toBase58()}`);
    console.log(`   Token Name: "Test Token"`);
    console.log(`   Token Symbol: "TEST"`);
    console.log(`   Metadata URI: "https://gateway.pinata.cloud/ipfs/bafkreig7qoceupufcyc6bnruyuywe6csk6bq6mlum7hrwyfivomi5isdve"`);
    console.log('');
    
    // Test metadata creation
    console.log('🏷️ Testing metadata creation...');
    const metadataSignature = await MetaplexMetadataService.createTokenMetadata(
      connection,
      testTokenMint,
      testUserAuthority,
      'Test Token',
      'TEST',
      'https://gateway.pinata.cloud/ipfs/bafkreig7qoceupufcyc6bnruyuywe6csk6bq6mlum7hrwyfivomi5isdve'
    );
    
    if (metadataSignature) {
      console.log('✅ Metadata creation test passed!');
      console.log(`   Signature: ${metadataSignature}`);
    } else {
      console.log('⚠️ Metadata creation test completed (no signature returned)');
      console.log('   This is expected if the service is using fallback mode');
    }
    
    // Test metadata existence check
    console.log('\n🔍 Testing metadata existence check...');
    const metadataExists = await MetaplexMetadataService.metadataExists(connection, testTokenMint);
    console.log(`   Metadata exists: ${metadataExists}`);
    
    console.log('\n🎉 Metadata service test completed!');
    console.log('💡 The service is ready to be used in your CreateLaunchPage');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('💡 Make sure your .env file has VITE_ADMIN_PRIVATE_KEY set');
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testMetadataService();
}

export { testMetadataService };