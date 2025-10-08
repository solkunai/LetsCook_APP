import { useState } from 'react';
import { useWalletConnection } from '@/lib/wallet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Image, 
  Upload, 
  Plus, 
  Trash2, 
  Save,
  ArrowLeft,
  Info,
  Users,
  Calendar,
  DollarSign
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';

interface NFTAttribute {
  name: string;
  min: string;
  max: string;
}

interface CollectionFormData {
  // Collection Details
  collectionName: string;
  collectionSymbol: string;
  collectionDescription: string;
  collectionImage: string;
  collectionBanner: string;
  
  // Token Details
  tokenName: string;
  tokenSymbol: string;
  tokenImage: string;
  tokenDecimals: number;
  tokenExtensions: number;
  
  // NFT Details
  nftName: string;
  nftImage: string;
  nftType: string;
  nftUri: string;
  
  // Launch Settings
  collectionType: 'RandomFixedSupply' | 'RandomUnlimited';
  collectionSize: number;
  swapPrice: number;
  swapFee: number;
  pageName: string;
  
  // Social Links
  website: string;
  twitter: string;
  telegram: string;
  discord: string;
  
  // Whitelist
  whitelistTokens: number;
  whitelistEnd: number;
  mintOnly: boolean;
  
  // Attributes
  attributes: NFTAttribute[];
}

export default function CollectionLaunchPage() {
  const { publicKey, connected } = useWalletConnection();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<CollectionFormData>({
    collectionName: '',
    collectionSymbol: '',
    collectionDescription: '',
    collectionImage: '',
    collectionBanner: '',
    tokenName: '',
    tokenSymbol: '',
    tokenImage: '',
    tokenDecimals: 9,
    tokenExtensions: 0,
    nftName: '',
    nftImage: '',
    nftType: '',
    nftUri: '',
    collectionType: 'RandomFixedSupply',
    collectionSize: 1000,
    swapPrice: 0.1,
    swapFee: 250,
    pageName: '',
    website: '',
    twitter: '',
    telegram: '',
    discord: '',
    whitelistTokens: 0,
    whitelistEnd: 0,
    mintOnly: false,
    attributes: []
  });

  const [activeTab, setActiveTab] = useState('collection');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: keyof CollectionFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addAttribute = () => {
    setFormData(prev => ({
      ...prev,
      attributes: [...prev.attributes, { name: '', min: '', max: '' }]
    }));
  };

  const removeAttribute = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attributes: prev.attributes.filter((_, i) => i !== index)
    }));
  };

  const updateAttribute = (index: number, field: keyof NFTAttribute, value: string) => {
    setFormData(prev => ({
      ...prev,
      attributes: prev.attributes.map((attr, i) => 
        i === index ? { ...attr, [field]: value } : attr
      )
    }));
  };

  const handleSubmit = async () => {
    if (!connected) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to launch a collection.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // TODO: Implement actual collection launch transaction
      // This would call the LaunchCollection instruction from your Solana program
      
      toast({
        title: "Collection Launch",
        description: "Your NFT collection is being launched on the blockchain...",
      });
      
      // Simulate transaction
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Success!",
        description: "Your NFT collection has been launched successfully!",
      });
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to launch collection. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const generatePageName = () => {
    const name = formData.collectionName.toLowerCase().replace(/\s+/g, '-');
    handleInputChange('pageName', name);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/collections">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-heading font-bold">Launch NFT Collection</h1>
              <p className="text-muted-foreground">Create and launch your NFT collection on Let's Cook</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="collection">Collection</TabsTrigger>
            <TabsTrigger value="token">Token</TabsTrigger>
            <TabsTrigger value="nft">NFT</TabsTrigger>
            <TabsTrigger value="launch">Launch</TabsTrigger>
          </TabsList>

          <TabsContent value="collection" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Collection Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="collectionName">Collection Name *</Label>
                    <Input
                      id="collectionName"
                      value={formData.collectionName}
                      onChange={(e) => handleInputChange('collectionName', e.target.value)}
                      placeholder="e.g., Chef Punks"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="collectionSymbol">Collection Symbol *</Label>
                    <Input
                      id="collectionSymbol"
                      value={formData.collectionSymbol}
                      onChange={(e) => handleInputChange('collectionSymbol', e.target.value)}
                      placeholder="e.g., CHEFPUNK"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="collectionDescription">Description *</Label>
                  <Textarea
                    id="collectionDescription"
                    value={formData.collectionDescription}
                    onChange={(e) => handleInputChange('collectionDescription', e.target.value)}
                    placeholder="Describe your NFT collection..."
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="collectionImage">Collection Image *</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="collectionImage"
                        value={formData.collectionImage}
                        onChange={(e) => handleInputChange('collectionImage', e.target.value)}
                        placeholder="https://example.com/image.png"
                      />
                      <Button variant="outline" size="icon">
                        <Upload className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="collectionBanner">Banner Image *</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="collectionBanner"
                        value={formData.collectionBanner}
                        onChange={(e) => handleInputChange('collectionBanner', e.target.value)}
                        placeholder="https://example.com/banner.png"
                      />
                      <Button variant="outline" size="icon">
                        <Upload className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pageName">Page Name *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="pageName"
                      value={formData.pageName}
                      onChange={(e) => handleInputChange('pageName', e.target.value)}
                      placeholder="chef-punks"
                    />
                    <Button variant="outline" onClick={generatePageName}>
                      Generate
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="token" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Token Details</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Configure the token that will be used for NFT swaps
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tokenName">Token Name *</Label>
                    <Input
                      id="tokenName"
                      value={formData.tokenName}
                      onChange={(e) => handleInputChange('tokenName', e.target.value)}
                      placeholder="e.g., Chef Token"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tokenSymbol">Token Symbol *</Label>
                    <Input
                      id="tokenSymbol"
                      value={formData.tokenSymbol}
                      onChange={(e) => handleInputChange('tokenSymbol', e.target.value)}
                      placeholder="e.g., CHEF"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tokenImage">Token Image *</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="tokenImage"
                      value={formData.tokenImage}
                      onChange={(e) => handleInputChange('tokenImage', e.target.value)}
                      placeholder="https://example.com/token.png"
                    />
                    <Button variant="outline" size="icon">
                      <Upload className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tokenDecimals">Decimals</Label>
                    <Input
                      id="tokenDecimals"
                      type="number"
                      value={formData.tokenDecimals}
                      onChange={(e) => handleInputChange('tokenDecimals', parseInt(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tokenExtensions">Extensions</Label>
                    <Select 
                      value={formData.tokenExtensions.toString()} 
                      onValueChange={(value) => handleInputChange('tokenExtensions', parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">None</SelectItem>
                        <SelectItem value="1">Transfer Fee</SelectItem>
                        <SelectItem value="2">Permanent Delegate</SelectItem>
                        <SelectItem value="4">Transfer Hook</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="nft" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>NFT Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nftName">NFT Name *</Label>
                    <Input
                      id="nftName"
                      value={formData.nftName}
                      onChange={(e) => handleInputChange('nftName', e.target.value)}
                      placeholder="e.g., Chef Punk"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nftType">NFT Type *</Label>
                    <Input
                      id="nftType"
                      value={formData.nftType}
                      onChange={(e) => handleInputChange('nftType', e.target.value)}
                      placeholder="e.g., Character"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nftImage">NFT Image *</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="nftImage"
                      value={formData.nftImage}
                      onChange={(e) => handleInputChange('nftImage', e.target.value)}
                      placeholder="https://example.com/nft.png"
                    />
                    <Button variant="outline" size="icon">
                      <Upload className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nftUri">NFT Metadata URI *</Label>
                  <Input
                    id="nftUri"
                    value={formData.nftUri}
                    onChange={(e) => handleInputChange('nftUri', e.target.value)}
                    placeholder="https://example.com/metadata.json"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>NFT Attributes</Label>
                    <Button variant="outline" size="sm" onClick={addAttribute}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Attribute
                    </Button>
                  </div>
                  
                  {formData.attributes.map((attr, index) => (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label>Attribute Name</Label>
                        <Input
                          value={attr.name}
                          onChange={(e) => updateAttribute(index, 'name', e.target.value)}
                          placeholder="e.g., Hat"
                        />
                      </div>
                      <div className="flex-1">
                        <Label>Min Value</Label>
                        <Input
                          value={attr.min}
                          onChange={(e) => updateAttribute(index, 'min', e.target.value)}
                          placeholder="e.g., Baseball Cap"
                        />
                      </div>
                      <div className="flex-1">
                        <Label>Max Value</Label>
                        <Input
                          value={attr.max}
                          onChange={(e) => updateAttribute(index, 'max', e.target.value)}
                          placeholder="e.g., Chef Hat"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => removeAttribute(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="launch" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Launch Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="collectionType">Collection Type *</Label>
                  <Select 
                    value={formData.collectionType} 
                    onValueChange={(value: 'RandomFixedSupply' | 'RandomUnlimited') => handleInputChange('collectionType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RandomFixedSupply">Fixed Supply</SelectItem>
                      <SelectItem value="RandomUnlimited">Unlimited Supply</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.collectionType === 'RandomFixedSupply' && (
                  <div className="space-y-2">
                    <Label htmlFor="collectionSize">Collection Size *</Label>
                    <Input
                      id="collectionSize"
                      type="number"
                      value={formData.collectionSize}
                      onChange={(e) => handleInputChange('collectionSize', parseInt(e.target.value))}
                      placeholder="1000"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="swapPrice">Swap Price (SOL) *</Label>
                    <Input
                      id="swapPrice"
                      type="number"
                      step="0.01"
                      value={formData.swapPrice}
                      onChange={(e) => handleInputChange('swapPrice', parseFloat(e.target.value))}
                      placeholder="0.1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="swapFee">Swap Fee (basis points) *</Label>
                    <Input
                      id="swapFee"
                      type="number"
                      value={formData.swapFee}
                      onChange={(e) => handleInputChange('swapFee', parseInt(e.target.value))}
                      placeholder="250"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <Label>Social Links</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Launch Collection</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Review your settings and launch your NFT collection
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Info className="w-4 h-4 text-blue-500" />
                    <span>Collection will be launched on Solana blockchain</span>
                  </div>
                  
                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Launching Collection...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Launch Collection
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
