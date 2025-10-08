import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Rocket, Loader2, CheckCircle } from 'lucide-react';
import { simpleDirectProgramService } from '@/lib/simpleDirectProgram';
import Header from '@/components/Header';

export default function SimpleCreateLaunchPage() {
  const { connected, publicKey, wallet, sendTransaction } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown');
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    description: '',
    totalSupply: 1000000,
    decimals: 9,
  });

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const testProgramConnection = async () => {
    if (!wallet) return;
    
    setIsTestingConnection(true);
    try {
      const isConnected = await simpleDirectProgramService.testProgramConnection();
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
      await simpleDirectProgramService.requestAirdrop(wallet);
    } catch (error) {
      console.error('Airdrop failed:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🔍 Form submit - Wallet state:', { connected, wallet, publicKey });
    
    if (!connected || !wallet) {
      alert('Please connect your wallet first');
      return;
    }

    if (!publicKey) {
      alert('Wallet public key not available. Please reconnect your wallet.');
      return;
    }

    if (!formData.name || !formData.symbol || !formData.description) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    
    try {
      console.log('🚀 Creating launch with direct program interaction...');
      console.log('🔍 Page: Wallet state:', { connected, publicKey, wallet, sendTransaction });
      
      // Create a wallet object with the proper structure
      const walletObject = {
        publicKey,
        sendTransaction,
        signTransaction: wallet?.adapter?.signTransaction,
        ...wallet
      };
      
      const signature = await simpleDirectProgramService.createSimpleLaunch(walletObject, formData);
      
      alert(`Launch created successfully! Transaction: ${signature.slice(0, 8)}...`);
      
      // Reset form
      setFormData({
        name: '',
        symbol: '',
        description: '',
        totalSupply: 1000000,
        decimals: 9,
      });
      
    } catch (error) {
      console.error('Error creating launch:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-background">
        <Header 
          title="Simple Create Launch"
          subtitle="Direct program interaction test"
          showNavigation={true}
        />
        <div className="flex items-center justify-center min-h-screen pt-24">
          <Card className="w-full max-w-md">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-2xl font-bold mb-2">Wallet Required</h2>
              <p className="text-muted-foreground mb-6">
                Please connect your wallet to create a token launch.
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
        title="Simple Create Launch"
        subtitle="Direct program interaction test"
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
                  Cook7kyoaKaiG57VBDUjE2KuPXrWdLEu7d3FdDgsijHU
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
              </div>
            </CardContent>
          </Card>

          {/* Create Launch Form */}
          <Card>
            <CardHeader>
              <CardTitle>Create Token Launch</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Token Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g., Bonk Cook"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="symbol">Token Symbol *</Label>
                  <Input
                    id="symbol"
                    value={formData.symbol}
                    onChange={(e) => handleInputChange('symbol', e.target.value.toUpperCase())}
                    placeholder="e.g., BCK"
                    maxLength={8}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="e.g., The ultimate cooking token"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="totalSupply">Total Supply</Label>
                    <Input
                      id="totalSupply"
                      type="number"
                      value={formData.totalSupply}
                      onChange={(e) => handleInputChange('totalSupply', parseInt(e.target.value) || 0)}
                      min="1000"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="decimals">Decimals</Label>
                    <Input
                      id="decimals"
                      type="number"
                      value={formData.decimals}
                      onChange={(e) => handleInputChange('decimals', parseInt(e.target.value) || 9)}
                      min="0"
                      max="9"
                    />
                  </div>
                </div>
                
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Launch...
                    </>
                  ) : (
                    <>
                      <Rocket className="w-4 h-4 mr-2" />
                      Create Launch
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}