import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { debugProgramService } from '@/lib/debugProgram';
import { SolanaProgramService } from '@/lib/solanaProgram';

export default function DebugPage() {
  const { connected, publicKey, wallet, sendTransaction } = useWallet();
  const [results, setResults] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  const addResult = (message: string) => {
    setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const clearResults = () => {
    setResults([]);
  };

  const testSystemProgram = async () => {
    if (!connected || !wallet) {
      addResult('❌ Please connect your wallet first');
      return;
    }

    setTesting(true);
    addResult('🧪 Testing System Program...');
    
    try {
      // Create a wallet object with the proper structure
      const walletObject = {
        publicKey,
        sendTransaction,
        signTransaction: wallet?.adapter?.signTransaction,
        adapter: wallet?.adapter,
        ...wallet
      };
      
      const signature = await debugProgramService.testSystemProgram(walletObject);
      addResult(`✅ System Program test successful: ${signature}`);
    } catch (error) {
      addResult(`❌ System Program test failed: ${error}`);
    }
    
    setTesting(false);
  };

  const testOurProgram = async () => {
    if (!connected || !wallet) {
      addResult('❌ Please connect your wallet first');
      return;
    }

    setTesting(true);
    addResult('🧪 Testing our program...');
    
    try {
      // Create a wallet object with the proper structure
      const walletObject = {
        publicKey,
        sendTransaction,
        signTransaction: wallet?.adapter?.signTransaction,
        adapter: wallet?.adapter,
        ...wallet
      };
      
      const signature = await debugProgramService.testOurProgram(walletObject);
      addResult(`✅ Our program test successful: ${signature}`);
    } catch (error) {
      addResult(`❌ Our program test failed: ${error}`);
    }
    
    setTesting(false);
  };

  const checkProgram = async () => {
    addResult('🔍 Checking if program exists...');
    
    try {
      const exists = await debugProgramService.checkProgramExists();
      if (exists) {
        addResult('✅ Program exists and is deployed');
      } else {
        addResult('❌ Program not found');
      }
    } catch (error) {
      addResult(`❌ Error checking program: ${error}`);
    }
  };

  const testDifferentProgram = async () => {
    if (!connected || !wallet) {
      addResult('❌ Please connect your wallet first');
      return;
    }

    setTesting(true);
    addResult('🧪 Testing System Program instruction to our program...');
    
    try {
      // Create a wallet object with the proper structure
      const walletObject = {
        publicKey,
        sendTransaction,
        signTransaction: wallet?.adapter?.signTransaction,
        adapter: wallet?.adapter,
        ...wallet
      };
      
      const signature = await debugProgramService.testDifferentProgram(walletObject);
      addResult(`✅ System Program instruction to our program successful: ${signature}`);
    } catch (error) {
      addResult(`❌ System Program instruction to our program failed: ${error}`);
    }
    
    setTesting(false);
  };

  const simulateTransaction = async () => {
    if (!connected || !wallet) {
      addResult('❌ Please connect your wallet first');
      return;
    }

    setTesting(true);
    addResult('🔍 Simulating transaction to see detailed error...');
    
    try {
      // Create a wallet object with the proper structure
      const walletObject = {
        publicKey,
        sendTransaction,
        signTransaction: wallet?.adapter?.signTransaction,
        adapter: wallet?.adapter,
        ...wallet
      };
      
      await debugProgramService.simulateTransaction(walletObject);
      addResult(`✅ Simulation completed - check console for details`);
    } catch (error) {
      addResult(`❌ Simulation failed: ${error}`);
    }
    
    setTesting(false);
  };

  const testAccountCombinations = async () => {
    if (!connected || !wallet) {
      addResult('❌ Please connect your wallet first');
      return;
    }

    setTesting(true);
    addResult('🧪 Testing different account combinations...');
    
    try {
      // Create a wallet object with the proper structure
      const walletObject = {
        publicKey,
        sendTransaction,
        signTransaction: wallet?.adapter?.signTransaction,
        adapter: wallet?.adapter,
        ...wallet
      };
      
      const signature = await debugProgramService.testAccountCombinations(walletObject);
      addResult(`✅ Account combinations test successful: ${signature}`);
    } catch (error) {
      addResult(`❌ Account combinations test failed: ${error}`);
    }
    
    setTesting(false);
  };

  const testInstructionDataFormats = async () => {
    if (!connected || !wallet) {
      addResult('❌ Please connect your wallet first');
      return;
    }

    setTesting(true);
    addResult('🧪 Testing different instruction data formats...');
    
    try {
      // Create a wallet object with the proper structure
      const walletObject = {
        publicKey,
        sendTransaction,
        signTransaction: wallet?.adapter?.signTransaction,
        adapter: wallet?.adapter,
        ...wallet
      };
      
      const signature = await debugProgramService.testInstructionDataFormats(walletObject);
      addResult(`✅ Instruction data formats test successful: ${signature}`);
    } catch (error) {
      addResult(`❌ Instruction data formats test failed: ${error}`);
    }
    
    setTesting(false);
  };

  const testMinimalTransaction = async () => {
    if (!connected || !wallet) {
      addResult('❌ Please connect your wallet first');
      return;
    }

    setTesting(true);
    addResult('🔍 Testing minimal transaction with only our instruction...');
    
    try {
      // Create a wallet object with the proper structure
      const walletObject = {
        publicKey,
        sendTransaction,
        signTransaction: wallet?.adapter?.signTransaction,
        adapter: wallet?.adapter,
        ...wallet
      };
      
      const signature = await debugProgramService.testMinimalTransaction(walletObject);
      addResult(`✅ Minimal transaction test successful: ${signature}`);
    } catch (error) {
      addResult(`❌ Minimal transaction test failed: ${error}`);
    }
    
    setTesting(false);
  };

  const testWithProgramDataAccount = async () => {
    if (!connected || !wallet) {
      addResult('❌ Please connect your wallet first');
      return;
    }

    setTesting(true);
    addResult('🎯 Testing with correct program data account...');
    
    try {
      // Create a wallet object with the proper structure
      const walletObject = {
        publicKey,
        sendTransaction,
        signTransaction: wallet?.adapter?.signTransaction,
        adapter: wallet?.adapter,
        ...wallet
      };
      
      const signature = await debugProgramService.testWithProgramDataAccount(walletObject);
      addResult(`✅ Program data account test successful: ${signature}`);
    } catch (error) {
      addResult(`❌ Program data account test failed: ${error}`);
    }
    
    setTesting(false);
  };

  const testFindProgramDataAccount = async () => {
    if (!connected || !wallet) {
      addResult('❌ Please connect your wallet first');
      return;
    }

    setTesting(true);
    addResult('🔍 Finding correct program data account automatically...');
    
    try {
      // Create a wallet object with the proper structure
      const walletObject = {
        publicKey,
        sendTransaction,
        signTransaction: wallet?.adapter?.signTransaction,
        adapter: wallet?.adapter,
        ...wallet
      };
      
      const signature = await debugProgramService.testFindProgramDataAccount(walletObject);
      addResult(`✅ Found working program data account: ${signature}`);
    } catch (error) {
      addResult(`❌ Find program data account failed: ${error}`);
    }
    
    setTesting(false);
  };

  const testSimpleLaunch = async () => {
    if (!connected || !wallet || !publicKey) {
      addResult('❌ Please connect your wallet first');
      return;
    }

    setTesting(true);
    addResult('🚀 Testing simple launch functionality...');
    
    try {
      const programService = new SolanaProgramService();
      
      // Create a proper wallet object with publicKey
      const walletObject = {
        ...wallet,
        publicKey: publicKey
      };
      
      const launchData = {
        name: 'Debug Test Token',
        symbol: 'DEBUG',
        description: 'A test token for debugging launch functionality',
        totalSupply: 1000000,
        decimals: 9,
        launchType: 'instant' as const,
        programId: 'Cook7kyoaKaiG57VBDUjE2KuPXrWdLEu7d3FdDgsijHU',
        walletAddress: publicKey.toString(),
        initialPrice: 0.01,
        liquidityAmount: 1,
      };
      
      const signature = await programService.createInstantLaunch(walletObject, launchData);
      addResult(`✅ Simple launch test successful: ${signature}`);
    } catch (error) {
      addResult(`❌ Simple launch test failed: ${error}`);
    }
    
    setTesting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 pt-24">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-white mb-8 text-center">
            🔧 Program Debug Page
          </h1>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-8">
            <h2 className="text-2xl font-semibold text-white mb-6">System Status</h2>
            <div className="space-y-2">
              <p className="text-white">
                <span className="font-semibold">Connected:</span> {connected ? '✅ Yes' : '❌ No'}
              </p>
              <p className="text-white">
                <span className="font-semibold">Public Key:</span> {publicKey?.toString() || 'Not available'}
              </p>
              <p className="text-white">
                <span className="font-semibold">Wallet:</span> {wallet?.adapter?.name || 'Not available'}
              </p>
              <p className="text-white">
                <span className="font-semibold">Program ID:</span> Cook7kyoaKaiG57VBDUjE2KuPXrWdLEu7d3FdDgsijHU
              </p>
              <p className="text-white">
                <span className="font-semibold">Network:</span> Devnet
              </p>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-8">
            <h2 className="text-2xl font-semibold text-white mb-6">Debug Tests</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <button
                onClick={checkProgram}
                disabled={testing}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                🔍 Check Program
              </button>
              
              <button
                onClick={testSystemProgram}
                disabled={testing || !connected}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                🧪 Test System Program
              </button>
              
              <button
                onClick={testOurProgram}
                disabled={testing || !connected}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                🚀 Test Our Program
              </button>
              
              <button
                onClick={testDifferentProgram}
                disabled={testing || !connected}
                className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                🔄 Test System→Our Program
              </button>
              
              <button
                onClick={simulateTransaction}
                disabled={testing || !connected}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                🔍 Simulate Transaction
              </button>
              
              <button
                onClick={testAccountCombinations}
                disabled={testing || !connected}
                className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                🧪 Test Account Combinations
              </button>
              
              <button
                onClick={testInstructionDataFormats}
                disabled={testing || !connected}
                className="bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                📝 Test Instruction Data
              </button>
              
              <button
                onClick={testMinimalTransaction}
                disabled={testing || !connected}
                className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                🔍 Test Minimal Transaction
              </button>
              
              <button
                onClick={testWithProgramDataAccount}
                disabled={testing || !connected}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                🎯 Test Program Data Account
              </button>
              
              <button
                onClick={testFindProgramDataAccount}
                disabled={testing || !connected}
                className="bg-violet-600 hover:bg-violet-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                🔍 Find Program Data Account
              </button>
              
              <button
                onClick={testSimpleLaunch}
                disabled={testing || !connected}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                🚀 Test Simple Launch
              </button>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold text-white">Debug Results</h2>
              <button
                onClick={clearResults}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm"
              >
                Clear
              </button>
            </div>
            <div className="bg-black/50 rounded-lg p-4 h-96 overflow-y-auto">
              {results.length === 0 ? (
                <p className="text-gray-400">No results yet. Run some tests above.</p>
              ) : (
                <div className="space-y-1">
                  {results.map((result, index) => (
                    <p key={index} className="text-green-400 font-mono text-sm">
                      {result}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}