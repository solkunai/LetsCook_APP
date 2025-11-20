import { useState } from 'react';
import { useWalletConnection } from '@/lib/wallet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Image, 
  ShoppingCart, 
  TrendingUp, 
  Users, 
  Calendar,
  Star,
  Filter,
  Search,
  Plus,
  Eye,
  Heart,
  Share2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Types for NFT Collections
interface NFTCollection {
  id: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  banner: string;
  totalSupply: number;
  numAvailable: number;
  swapPrice: number;
  swapFee: number;
  positiveVotes: number;
  negativeVotes: number;
  totalMMBuyAmount: number;
  totalMMSellAmount: number;
  socials: string[];
  collectionType: 'RandomFixedSupply' | 'RandomUnlimited';
  attributes: NFTAttribute[];
  status: 'active' | 'completed' | 'upcoming';
  launchDate: string;
  creator: string;
}

interface NFTAttribute {
  name: string;
  min: string;
  max: string;
}

interface NFTListing {
  id: string;
  collectionId: string;
  nftIndex: number;
  price: number;
  seller: string;
  image: string;
  name: string;
  attributes: NFTAttribute[];
}

// Mock data - replace with real blockchain data
const mockCollections: NFTCollection[] = [
  {
    id: 'chef-punks',
    name: 'Chef Punks',
    symbol: 'CHEFPUNK',
    description: 'A collection of 10,000 unique chef-themed NFTs with various cooking attributes.',
    image: '/api/placeholder/300/300?text=Chef+Punks&bg=6366f1&color=ffffff',
    banner: '/api/placeholder/800/200?text=Chef+Punks+Collection&bg=6366f1&color=ffffff',
    totalSupply: 10000,
    numAvailable: 7500,
    swapPrice: 0.5,
    swapFee: 250,
    positiveVotes: 156,
    negativeVotes: 12,
    totalMMBuyAmount: 2500,
    totalMMSellAmount: 1800,
    socials: ['https://twitter.com/chefpunks', 'https://discord.gg/chefpunks'],
    collectionType: 'RandomFixedSupply',
    attributes: [
      { name: 'Hat', min: 'Baseball Cap', max: 'Chef Hat' },
      { name: 'Apron', min: 'None', max: 'Full Apron' },
      { name: 'Tool', min: 'Spatula', max: 'Knife' }
    ],
    status: 'active',
    launchDate: '2025-02-15',
    creator: 'ChefMaster'
  },
  {
    id: 'spicy-cats',
    name: 'Spicy Cats',
    symbol: 'SPICYCAT',
    description: 'Unlimited supply of spicy cat NFTs with random traits.',
    image: '/api/placeholder/300/300?text=Chef+Punks&bg=6366f1&color=ffffff',
    banner: '/api/placeholder/800/200?text=Chef+Punks+Collection&bg=6366f1&color=ffffff',
    totalSupply: 0, // Unlimited
    numAvailable: 0,
    swapPrice: 0.1,
    swapFee: 100,
    positiveVotes: 89,
    negativeVotes: 5,
    totalMMBuyAmount: 1200,
    totalMMSellAmount: 800,
    socials: ['https://twitter.com/spicycats'],
    collectionType: 'RandomUnlimited',
    attributes: [
      { name: 'Fur Color', min: 'Orange', max: 'Red' },
      { name: 'Spice Level', min: 'Mild', max: 'Extra Hot' }
    ],
    status: 'active',
    launchDate: '2025-02-20',
    creator: 'SpiceMaster'
  }
];

const mockListings: NFTListing[] = [
  {
    id: 'chef-punk-1',
    collectionId: 'chef-punks',
    nftIndex: 1,
    price: 0.8,
    seller: 'ChefTrader',
    image: '/api/placeholder/200/200?text=NFT&bg=10b981&color=ffffff',
    name: 'Chef Punk #1',
    attributes: [
      { name: 'Hat', min: 'Chef Hat', max: 'Chef Hat' },
      { name: 'Apron', min: 'Full Apron', max: 'Full Apron' }
    ]
  },
  {
    id: 'chef-punk-2',
    collectionId: 'chef-punks',
    nftIndex: 2,
    price: 1.2,
    seller: 'NFTCollector',
    image: '/api/placeholder/200/200?text=NFT&bg=10b981&color=ffffff',
    name: 'Chef Punk #2',
    attributes: [
      { name: 'Hat', min: 'Baseball Cap', max: 'Baseball Cap' },
      { name: 'Tool', min: 'Knife', max: 'Knife' }
    ]
  }
];

export default function CollectionsPage() {
  const { publicKey, connected } = useWalletConnection();
  const [activeTab, setActiveTab] = useState('collections');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [userVotes, setUserVotes] = useState<{ [key: string]: 'up' | 'down' | null }>({});
  const { toast } = useToast();

  const filteredCollections = mockCollections.filter(collection => {
    const matchesSearch = collection.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         collection.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || collection.status === filterStatus;
    const matchesType = filterType === 'all' || collection.collectionType === filterType;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const handleVote = (collectionId: string, voteType: 'up' | 'down') => {
    if (!connected) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to vote.",
        variant: "destructive"
      });
      return;
    }

    setUserVotes(prev => {
      const currentVote = prev[collectionId];
      const newVote = currentVote === voteType ? null : voteType;
      return {
        ...prev,
        [collectionId]: newVote
      };
    });

    toast({
      title: `Vote ${voteType === 'up' ? 'Up' : 'Down'}`,
      description: `Your vote has been recorded for this collection.`,
    });
  };

  const handleMintNFT = (collectionId: string) => {
    if (!connected) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to mint NFTs.",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Mint NFT",
      description: `Minting NFT from ${collectionId} collection...`,
    });
  };

  const handleBuyNFT = (listingId: string) => {
    if (!connected) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to buy NFTs.",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Buy NFT",
      description: `Purchasing NFT ${listingId}...`,
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-3 sm:mb-4">
            <h1 className="text-xl sm:text-2xl font-heading font-bold">NFT Collections</h1>
            <Button className="flex items-center gap-2 w-full sm:w-auto text-sm sm:text-base min-h-[44px]">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Launch Collection</span>
              <span className="sm:hidden">Launch</span>
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search collections..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-base min-h-[44px]"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-40 min-h-[44px] text-base">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-40 min-h-[44px] text-base">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="RandomFixedSupply">Fixed Supply</SelectItem>
                <SelectItem value="RandomUnlimited">Unlimited</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-6">
            <TabsTrigger value="collections" className="text-sm sm:text-base min-h-[44px]">Collections</TabsTrigger>
            <TabsTrigger value="marketplace" className="text-sm sm:text-base min-h-[44px]">Marketplace</TabsTrigger>
          </TabsList>

          <TabsContent value="collections" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filteredCollections.map((collection) => (
                <Card key={collection.id} className="overflow-hidden hover-elevate">
                  <div className="relative">
                    <img
                      src={collection.banner}
                      alt={collection.name}
                      className="w-full h-32 object-cover"
                    />
                    <div className="absolute top-4 right-4 flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleVote(collection.id, 'up')}
                        className={`${userVotes[collection.id] === 'up' ? 'bg-green-500 text-white' : ''}`}
                      >
                        <TrendingUp className="w-4 h-4" />
                        {collection.positiveVotes}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleVote(collection.id, 'down')}
                        className={`${userVotes[collection.id] === 'down' ? 'bg-red-500 text-white' : ''}`}
                      >
                        <TrendingUp className="w-4 h-4 rotate-180" />
                        {collection.negativeVotes}
                      </Button>
                    </div>
                  </div>
                  
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{collection.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">${collection.symbol}</p>
                      </div>
                      <Badge variant={collection.status === 'active' ? 'default' : 'secondary'}>
                        {collection.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {collection.description}
                    </p>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label className="text-muted-foreground">Supply</Label>
                        <p className="font-semibold">
                          {collection.totalSupply === 0 ? 'Unlimited' : `${collection.totalSupply.toLocaleString()}`}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Available</Label>
                        <p className="font-semibold">
                          {collection.numAvailable.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Price</Label>
                        <p className="font-semibold">{collection.swapPrice} SOL</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Fee</Label>
                        <p className="font-semibold">{collection.swapFee / 100}%</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        className="flex-1 text-sm sm:text-base min-h-[44px]" 
                        onClick={() => handleMintNFT(collection.id)}
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        <span className="hidden sm:inline">Mint NFT</span>
                        <span className="sm:hidden">Mint</span>
                      </Button>
                      <Button variant="outline" size="icon" className="min-h-[44px] min-w-[44px]">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="min-h-[44px] min-w-[44px]">
                        <Heart className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="min-h-[44px] min-w-[44px]">
                        <Share2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="marketplace" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {mockListings.map((listing) => (
                <Card key={listing.id} className="overflow-hidden hover-elevate">
                  <img
                    src={listing.image}
                    alt={listing.name}
                    className="w-full h-48 object-cover"
                  />
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-sm mb-2">{listing.name}</h3>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-lg font-bold">{listing.price} SOL</span>
                      <Badge variant="outline">#{listing.nftIndex}</Badge>
                    </div>
                    <div className="space-y-2">
                      {listing.attributes.slice(0, 2).map((attr, index) => (
                        <div key={index} className="text-xs">
                          <span className="text-muted-foreground">{attr.name}:</span>
                          <span className="ml-1">{attr.min}</span>
                        </div>
                      ))}
                    </div>
                    <Button 
                      className="w-full mt-3 text-sm sm:text-base min-h-[44px]" 
                      onClick={() => handleBuyNFT(listing.id)}
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Buy Now
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

    </div>
  );
}
