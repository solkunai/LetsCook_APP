import React, { useState, useEffect } from 'react';
import { blockchainIntegrationService } from '@/lib/blockchainIntegrationService';

export default function BlockchainDebugPage() {
  const [launches, setLaunches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const testBlockchainConnection = async () => {
    setLoading(true);
    setError(null);
    setDebugInfo(null);
    
    try {
      console.log('🧪 Testing blockchain connection...');
      
      // Run the quick test
      await blockchainIntegrationService.quickTest();
      
      // Fetch launches
      const fetchedLaunches = await blockchainIntegrationService.getAllLaunches();
      setLaunches(fetchedLaunches);
      
      // Get debug info
      setDebugInfo({
        programId: blockchainIntegrationService.getProgramId().toBase58(),
        connection: blockchainIntegrationService.getConnection().rpcEndpoint,
        launchCount: fetchedLaunches.length
      });
      
      console.log('✅ Test completed:', {
        launches: fetchedLaunches.length,
        programId: blockchainIntegrationService.getProgramId().toBase58()
      });
      
    } catch (err) {
      console.error('❌ Test failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const debugSpecificAccount = async () => {
    const accountAddress = prompt('Enter account address to debug:');
    if (accountAddress) {
      try {
        await blockchainIntegrationService.debugAccountData(accountAddress);
      } catch (err) {
        console.error('Debug failed:', err);
        setError(err instanceof Error ? err.message : 'Debug failed');
      }
    }
  };

  const checkAccountInitialization = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await blockchainIntegrationService.checkAccountInitialization();
    } catch (err) {
      console.error('Check failed:', err);
      setError(err instanceof Error ? err.message : 'Check failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-run test on page load
    testBlockchainConnection();
  }, []);

  return (
    <div className="min-h-screen bg-background text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Blockchain Debug Page</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Debug Controls */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Debug Controls</h2>
            
            <div className="space-y-4">
              <button
                onClick={testBlockchainConnection}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded-lg font-medium"
              >
                {loading ? 'Testing...' : 'Test Blockchain Connection'}
              </button>
              
              <button
                onClick={debugSpecificAccount}
                className="w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-medium"
              >
                Debug Specific Account
              </button>
              
              <button
                onClick={checkAccountInitialization}
                disabled={loading}
                className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 px-4 py-2 rounded-lg font-medium"
              >
                {loading ? 'Checking...' : 'Check Account Initialization'}
              </button>
            </div>
            
            {debugInfo && (
              <div className="mt-6 p-4 bg-gray-700 rounded-lg">
                <h3 className="font-semibold mb-2">Debug Info:</h3>
                <pre className="text-sm text-gray-300">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </div>
            )}
            
            {error && (
              <div className="mt-4 p-4 bg-red-900 border border-red-700 rounded-lg">
                <h3 className="font-semibold text-red-300 mb-2">Error:</h3>
                <p className="text-red-200">{error}</p>
              </div>
            )}
          </div>
          
          {/* Results */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">
              Launches Found ({launches.length})
            </h2>
            
            {launches.length === 0 ? (
              <div className="text-gray-400 text-center py-8">
                No launches found. Check the console for debug information.
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {launches.map((launch, index) => (
                  <div key={launch.id || index} className="bg-gray-700 p-4 rounded-lg">
                    <h3 className="font-semibold text-blue-300">{launch.name}</h3>
                    <p className="text-sm text-gray-300">Type: {launch.launchType}</p>
                    <p className="text-sm text-gray-300">Status: {launch.status}</p>
                    <p className="text-sm text-gray-300">Creator: {launch.creator}</p>
                    <p className="text-sm text-gray-300">Tradable: {launch.isTradable ? 'Yes' : 'No'}</p>
                    <p className="text-xs text-gray-400">ID: {launch.id}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Console Instructions */}
        <div className="mt-8 bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Console Debugging</h2>
          <p className="text-gray-300 mb-4">
            Open your browser's developer console (F12) to see detailed debug information.
            The service will log:
          </p>
          <ul className="list-disc list-inside text-gray-300 space-y-2">
            <li>Program ID and connection details</li>
            <li>Number of accounts found for the program</li>
            <li>Account data structure and first bytes</li>
            <li>Borsh deserialization results</li>
            <li>Any errors during parsing</li>
          </ul>
        </div>
      </div>
    </div>
  );
}