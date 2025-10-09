import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Rocket, 
  Loader2,
  CheckCircle,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import { SolanaProgramService } from '@/lib/solanaProgram';

export default function TestLaunchPage() {
  const { connected, publicKey, wallet } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: 'Test Token',
    symbol: 'TEST',
    description: 'A simple test token for testing the launch functionality',
    totalSupply: 1000000,
    decimals: 9,
  });

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const onSubmit = async () => {
    console.log('🧪 Test Launch Form Submitted:', formData);
    
    if (!connected || !publicKey || !wallet) {
      console.log('❌ Wallet not connected');
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to test the launch.",
        variant: "destructive",
      });
      return;
    }

    console.log('✅ Wallet connected, starting test submission...');
    setIsSubmitting(true);

    try {
      // Create the test launch data
      const launchData = {
        name: formData.name,
        symbol: formData.symbol,
        description: formData.description,
        totalSupply: formData.totalSupply,
        decimals: formData.decimals,
        launchType: 'instant' as const,
        programId: 'Cook7kyoaKaiG57VBDUjE2KuPXrWdLEu7d3FdDgsijHU',
        walletAddress: publicKey.toString(),
        initialPrice: 0.01,
        liquidityAmount: 1,
      };

      console.log('📝 Test launch data prepared:', launchData);
      
      // Use SimpleDirectProgramService for direct program interaction
      const programService = new SolanaProgramService();
      
      console.log('🔄 Calling createInstantLaunch...');
      // Pass the original wallet object to maintain proper this context
      // Add publicKey to the wallet object for the service
      const walletObject = {
        ...wallet,
        publicKey: publicKey
      };
      
      const signature = await programService.createInstantLaunch(walletObject, launchData);
      
      console.log('✅ Test launch created successfully! Signature:', signature);
      setLastTransaction(signature);

      toast({
        title: "Test Launch Successful!",
        description: `Test token launch completed. Transaction: ${signature.slice(0, 8)}...`,
      });
      
    } catch (error) {
      console.error('❌ Error creating test launch:', error);
      
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      
      toast({
        title: "Test Launch Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      console.log('🏁 Test launch process finished');
      setIsSubmitting(false);
    }
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-background">
        <Header 
          title="Test Launch"
          subtitle="Simple test page for launch functionality"
          showNavigation={true}
        />
        <div className="flex items-center justify-center min-h-screen pt-24">
          <Card className="w-full max-w-md">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-2xl font-bold mb-2">Wallet Required</h2>
              <p className="text-muted-foreground mb-6">
                Please connect your wallet to test the launch functionality.
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
        title="Test Launch"
        subtitle="Simple test page for launch functionality"
        showNavigation={true}
      />
      <div className="pt-24 pb-12">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center mb-4">
                <Rocket className="w-8 h-8 text-primary mr-3" />
                <h1 className="text-3xl font-bold">Test Token Launch</h1>
              </div>
              <p className="text-lg text-muted-foreground">
                Simple test page to verify launch functionality
              </p>
            </div>

            {/* Success Message */}
            {lastTransaction && (
              <Card className="mb-6 border-green-200 bg-green-50">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-800">
                        Test launch successful!
                      </p>
                      <p className="text-xs text-green-600">
                        Transaction: {lastTransaction.slice(0, 8)}...{lastTransaction.slice(-8)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`https://explorer.solana.com/tx/${lastTransaction}?cluster=devnet`, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Test Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Rocket className="w-5 h-5 mr-2" />
                  Test Token Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Token Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Test Token"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="symbol">Symbol</Label>
                    <Input
                      id="symbol"
                      value={formData.symbol}
                      onChange={(e) => handleInputChange('symbol', e.target.value)}
                      placeholder="TEST"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Test token description"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="totalSupply">Total Supply</Label>
                    <Input
                      id="totalSupply"
                      type="number"
                      value={formData.totalSupply}
                      onChange={(e) => handleInputChange('totalSupply', parseInt(e.target.value) || 0)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="decimals">Decimals</Label>
                    <Input
                      id="decimals"
                      type="number"
                      value={formData.decimals}
                      onChange={(e) => handleInputChange('decimals', parseInt(e.target.value) || 0)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Test Launch Button */}
                <div className="flex justify-center pt-4">
                  <Button
                    onClick={onSubmit}
                    size="lg"
                    disabled={isSubmitting}
                    className="min-w-[200px]"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Testing Launch...
                      </>
                    ) : (
                      <>
                        <Rocket className="w-4 h-4 mr-2" />
                        Test Launch
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Test Info */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-sm">Test Information</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                <div>Wallet Connected: {connected ? 'Yes' : 'No'}</div>
                <div>Public Key: {publicKey?.toString().slice(0, 8)}...</div>
                <div>Is Testing: {isSubmitting ? 'Yes' : 'No'}</div>
                <div>Launch Type: Instant Launch (Test)</div>
                <div>Initial Price: 0.01 SOL</div>
                <div>Liquidity: 1 SOL</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}