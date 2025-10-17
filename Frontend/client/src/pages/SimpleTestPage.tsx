import React, { useState, useEffect } from 'react';
import { blockchainIntegrationService } from '@/lib/blockchainIntegrationService';

const SimpleTestPage: React.FC = () => {
  const [launches, setLaunches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testBlockchain = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🧪 Testing blockchain integration...');
      const fetchedLaunches = await blockchainIntegrationService.getAllLaunches();
      console.log('✅ Fetched launches:', fetchedLaunches);
      setLaunches(fetchedLaunches);
    } catch (err) {
      console.error('❌ Test failed:', err);
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testBlockchain();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-6">Blockchain Integration Test</h1>
      
      <div className="mb-6">
        <button
          onClick={testBlockchain}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded-lg font-medium"
        >
          {loading ? 'Testing...' : 'Test Blockchain Connection'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-700 rounded-lg">
          <h3 className="font-semibold mb-2">Error:</h3>
          <p>{error}</p>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Results:</h2>
        <p><strong>Launches Found:</strong> {launches.length}</p>
        <p><strong>Program ID:</strong> {blockchainIntegrationService.getProgramId().toBase58()}</p>
      </div>

      {launches.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Launch Details:</h3>
          {launches.map((launch, index) => (
            <div key={launch.id} className="bg-gray-800 p-4 rounded-lg">
              <h4 className="font-semibold">{launch.name}</h4>
              <p><strong>Type:</strong> {launch.launchType}</p>
              <p><strong>Status:</strong> {launch.status}</p>
              <p><strong>Creator:</strong> {launch.creator}</p>
              <p><strong>Page Name:</strong> {launch.pageName}</p>
              <p><strong>Tickets Sold:</strong> {launch.ticketsSold}</p>
              <p><strong>Upvotes:</strong> {launch.upvotes}</p>
              <p><strong>Downvotes:</strong> {launch.downvotes}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 p-4 bg-gray-700 rounded-lg">
        <h3 className="font-semibold mb-2">Console Output:</h3>
        <p>Check your browser's developer console for detailed logs.</p>
      </div>
    </div>
  );
};

export default SimpleTestPage;