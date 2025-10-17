// Simple test script to verify manual parsing works
const { blockchainIntegrationService } = require('./src/lib/blockchainIntegrationService.ts');

async function testParsing() {
  console.log('🧪 Testing manual parsing...');
  
  try {
    const launches = await blockchainIntegrationService.getAllLaunches();
    console.log(`✅ Found ${launches.length} launches`);
    
    if (launches.length > 0) {
      console.log('📋 First launch:', JSON.stringify(launches[0], null, 2));
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testParsing();