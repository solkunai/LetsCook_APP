import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Rocket, Loader2, CheckCircle } from 'lucide-react';
import { ultraSimpleProgramService } from '@/lib/ultraSimpleProgram';
import { launchService } from '@/lib/launchService';
import Header from '@/components/Header';

export default function UltraSimpleTestPage() {
  const { connected, publicKey, wallet, sendTransaction } = useWallet();
  const [isTesting, setIsTesting] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown');
  const [isDebugging, setIsDebugging] = useState(false);

  const debugAccountTypes = async () => {
    setIsDebugging(true);
    try {
      console.log('🔍 Starting account type debugging...');
      await launchService.debugAccountTypes();
      console.log('✅ Debugging complete! Check console for results.');
    } catch (error) {
      console.error('❌ Debug error:', error);
    } finally {
      setIsDebugging(false);
    }
  };

  const clearCache = () => {
    launchService.clearCache();
    console.log('🗑️ Cache cleared!');
  };

  const testAllAccounts = async () => {
    setIsDebugging(true);
    try {
      console.log('🔍 Testing raw account fetching...');
      await launchService.fetchAllAccountsRaw();
      console.log('✅ Raw account test complete! Check console for results.');
    } catch (error) {
      console.error('❌ Raw account test error:', error);
    } finally {
      setIsDebugging(false);
    }
  };

  const testRawFetching = async () => {
    setIsDebugging(true);
    try {
      console.log('🔍 Testing raw account fetching...');
      await launchService.testRawFetching();
      console.log('✅ Raw fetching test complete! Check console for results.');
    } catch (error) {
      console.error('❌ Raw fetching test error:', error);
    } finally {
      setIsDebugging(false);
    }
  };

  const analyzeTransaction = async () => {
    setIsDebugging(true);
    try {
      console.log('🔍 Analyzing your launch transaction...');
      const signature = '2uSynTL5BTC9nbo61fQZ8PnfuBq9HPU8d4SCeaTdCdjEPiCnNMYVwMX37A5PXy8r5aQsb2nrUhkgbFnv1x9rRMtM';
      await launchService.analyzeTransaction(signature);
      console.log('✅ Transaction analysis complete! Check console for results.');
    } catch (error) {
      console.error('❌ Transaction analysis error:', error);
    } finally {
      setIsDebugging(false);
    }
  };

  const testProgramConnection = async () => {
    if (!wallet) return;
    
    setIsTestingConnection(true);
    try {
      const isConnected = await ultraSimpleProgramService.testProgramConnection();
      setConnectionStatus(isConnected ? 'connected' : 'failed');
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionStatus('failed');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const requestAirdrop = async () => {
    if (!wallet) return;
    
    try {
      await ultraSimpleProgramService.requestAirdrop(wallet);
    } catch (error) {
      console.error('Airdrop failed:', error);
    }
  };

  const testProgramCall = async () => {
    if (!connected || !wallet) {
      alert('Please connect your wallet first');
      return;
    }

    setIsTesting(true);
    
    try {
      console.log('🧪 Testing ultra simple program call...');
      
      // Create a wallet object with the proper structure
      const walletObject = {
        publicKey,
        sendTransaction,
        ...wallet
      };
      
      const signature = await ultraSimpleProgramService.testProgramCall(walletObject);
      
      alert(`Test successful! Transaction: ${signature.slice(0, 8)}...`);
      
    } catch (error) {
      console.error('Test failed:', error);
      alert(`Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTesting(false);
    }
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-background">
        <Header 
          title="Ultra Simple Test"
          subtitle="Basic program interaction test"
          showNavigation={true}
        />
        <div className="flex items-center justify-center min-h-screen pt-24">
          <Card className="w-full max-w-md">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-2xl font-bold mb-2">Wallet Required</h2>
              <p className="text-muted-foreground mb-6">
                Please connect your wallet to test the program.
              </p>
              <Button className="w-full">
                Connect Wallet
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header 
        title="Ultra Simple Test"
        subtitle="Basic program interaction test"
        showNavigation={true}
      />
      
      <div className="container mx-auto px-4 py-8 pt-24">
        <div className="max-w-2xl mx-auto space-y-6">
          
          {/* Program Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Rocket className="w-5 h-5 mr-2" />
                Program Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Program ID:</span>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                J3Qr5TAMocTrPXrJbjH86jLQ3bCXJaS4hFgaE54zT2jg
                </code>
              </div>
              
              <div className="flex items-center justify-between">
                <span>Connection Status:</span>
                <div className="flex items-center space-x-2">
                  {connectionStatus === 'connected' && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {connectionStatus === 'failed' && <AlertCircle className="w-4 h-4 text-red-500" />}
                  <span className={connectionStatus === 'connected' ? 'text-green-500' : connectionStatus === 'failed' ? 'text-red-500' : 'text-muted-foreground'}>
                    {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'failed' ? 'Failed' : 'Unknown'}
                  </span>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <Button 
                  onClick={testProgramConnection}
                  disabled={isTestingConnection}
                  variant="outline"
                  size="sm"
                >
                  {isTestingConnection ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test Connection'
                  )}
                </Button>
                
                <Button 
                  onClick={requestAirdrop}
                  variant="outline"
                  size="sm"
                >
                  Request Airdrop
                </Button>
                
                <Button 
                  onClick={debugAccountTypes}
                  disabled={isDebugging}
                  variant="outline"
                  size="sm"
                >
                  {isDebugging ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Debugging...
                    </>
                  ) : (
                    'Debug Accounts'
                  )}
                </Button>
                
                <Button 
                  onClick={clearCache}
                  variant="outline"
                  size="sm"
                >
                  Clear Cache
                </Button>
                
                <Button 
                  onClick={testAllAccounts}
                  disabled={isDebugging}
                  variant="outline"
                  size="sm"
                >
                  {isDebugging ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test All Accounts'
                  )}
                </Button>
                
                <Button 
                  onClick={testRawFetching}
                  disabled={isDebugging}
                  variant="outline"
                  size="sm"
                >
                  {isDebugging ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test Raw Fetching'
                  )}
                </Button>
                
                <Button 
                  onClick={analyzeTransaction}
                  disabled={isDebugging}
                  variant="outline"
                  size="sm"
                >
                  {isDebugging ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    'Analyze Transaction'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Test Program Call */}
          <Card>
            <CardHeader>
              <CardTitle>Test Program Call</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                This will send a very simple instruction to our deployed program to test if it works.
              </p>
              
              <Button
                onClick={testProgramCall}
                disabled={isTesting}
                className="w-full"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testing Program Call...
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4 mr-2" />
                    Test Program Call
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}