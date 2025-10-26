import { useState } from 'react';
import { useWalletConnection } from '@/lib/wallet';
import { useAPIServices } from '@/lib/apiServices';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Zap, 
  Upload, 
  Save,
  ArrowLeft,
  Info,
  DollarSign,
  Users,
  TrendingUp,
  Clock,
  CheckCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';

interface InstantLaunchFormData {
  // Token Details
  name: string;
  symbol: string;
  description: string;
  icon: string;
  uri: string;
  
  // Social Links
  website: string;
  twitter: string;
  telegram: string;
  discord: string;
}

export default function InstantLaunchPage() {
  const { publicKey, connected, wallet } = useWalletConnection();
  const apiServices = useAPIServices();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<InstantLaunchFormData>({
    name: '',
    symbol: '',
    description: '',
    icon: '',
    uri: '',
    website: '',
    twitter: '',
    telegram: '',
    discord: ''
  });

  const [activeTab, setActiveTab] = useState('token');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: keyof InstantLaunchFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    if (!connected) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to launch a token.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.name || !formData.symbol || !formData.description) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Use the new API service for instant launch
      const signature = await apiServices.launch.createInstantLaunch({
        name: formData.name,
        symbol: formData.symbol,
        uri: formData.uri,
        icon: formData.icon,
        banner: formData.banner || null,
        description: formData.description,
        website: formData.website,
        twitter: formData.twitter,
        telegram: formData.telegram,
        discord: formData.discord,
        totalSupply: 1000000, // Default total supply
        decimals: 9, // Default decimals
        baseAmount: 1000000000, // Default base amount in lamports
        quoteAmount: 1000000000, // Default quote amount in lamports
        wrap: 0, // Default wrap setting
        burnLp: 0, // Default burn LP setting
        lowLiquidity: 0, // Default low liquidity setting
      });
      
      toast({
        title: "Success!",
        description: `Your token ${formData.name} has been launched successfully! Transaction: ${signature.slice(0, 8)}...`,
      });
      
    } catch (error) {
      console.error('Error launching token:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to launch token. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/create-launch">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-heading font-bold">Instant Launch</h1>
              <p className="text-muted-foreground">Launch your token instantly without raffles</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Info Banner */}
        <Card className="mb-6 border-blue-200 bg-blue-50/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900">Instant Launch</h3>
                <p className="text-sm text-blue-700">
                  Launch your token immediately with instant liquidity. No raffles, no waiting - 
                  your token goes live right away with built-in AMM support.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="token">Token Details</TabsTrigger>
            <TabsTrigger value="social">Social Links</TabsTrigger>
          </TabsList>

          <TabsContent value="token" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Token Information</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Basic information about your token
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Token Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="e.g., My Awesome Token"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="symbol">Token Symbol *</Label>
                    <Input
                      id="symbol"
                      value={formData.symbol}
                      onChange={(e) => handleInputChange('symbol', e.target.value)}
                      placeholder="e.g., MAT"
                      maxLength={10}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Describe your token and its purpose..."
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="icon">Token Icon URL</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="icon"
                        value={formData.icon}
                        onChange={(e) => handleInputChange('icon', e.target.value)}
                        placeholder="https://example.com/icon.png"
                      />
                      <Button variant="outline" size="icon">
                        <Upload className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="uri">Metadata URI</Label>
                    <Input
                      id="uri"
                      value={formData.uri}
                      onChange={(e) => handleInputChange('uri', e.target.value)}
                      placeholder="https://example.com/metadata.json"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Instant Launch Features */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  Instant Launch Features
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Clock className="w-5 h-5 text-green-500" />
                    <div>
                      <div className="font-semibold">Instant Liquidity</div>
                      <div className="text-sm text-muted-foreground">AMM pool created immediately</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                    <div>
                      <div className="font-semibold">Trading Ready</div>
                      <div className="text-sm text-muted-foreground">Start trading right away</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Users className="w-5 h-5 text-purple-500" />
                    <div>
                      <div className="font-semibold">Community Access</div>
                      <div className="text-sm text-muted-foreground">Open to all traders</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <DollarSign className="w-5 h-5 text-orange-500" />
                    <div>
                      <div className="font-semibold">Fair Pricing</div>
                      <div className="text-sm text-muted-foreground">Market-driven price discovery</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="social" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Social Links</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Add your social media links to build community
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={formData.website}
                      onChange={(e) => handleInputChange('website', e.target.value)}
                      placeholder="https://example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="twitter">Twitter</Label>
                    <Input
                      id="twitter"
                      value={formData.twitter}
                      onChange={(e) => handleInputChange('twitter', e.target.value)}
                      placeholder="https://twitter.com/username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telegram">Telegram</Label>
                    <Input
                      id="telegram"
                      value={formData.telegram}
                      onChange={(e) => handleInputChange('telegram', e.target.value)}
                      placeholder="https://t.me/username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discord">Discord</Label>
                    <Input
                      id="discord"
                      value={formData.discord}
                      onChange={(e) => handleInputChange('discord', e.target.value)}
                      placeholder="https://discord.gg/invite"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Launch Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Launch Summary</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Review your instant launch configuration
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Token Name:</span>
                    <span className="font-semibold">{formData.name || 'Not specified'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Symbol:</span>
                    <span className="font-semibold">{formData.symbol || 'Not specified'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Launch Type:</span>
                    <Badge className="bg-yellow-500">Instant Launch</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Liquidity:</span>
                    <span className="font-semibold">Auto-created</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Trading:</span>
                    <span className="font-semibold">Immediate</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-green-700">
                    Your token will be live and tradeable immediately after launch
                  </span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Launch Button */}
        <Card className="mt-6">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Info className="w-4 h-4 text-blue-500" />
                <span>Token will be launched instantly on Solana blockchain</span>
              </div>
              
              <Button 
                className="w-full" 
                size="lg"
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.name || !formData.symbol || !formData.description}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Launching Token...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Launch Token Instantly
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
