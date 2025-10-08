import { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Rocket, 
  Upload, 
  Calendar, 
  DollarSign, 
  Users, 
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Zap,
  Ticket
} from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCreateLaunch } from '@/hooks/useApi';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from '@/hooks/use-toast';
import Header from '@/components/Header';

// Form validation schema
const createLaunchSchema = z.object({
  launchType: z.enum(['raffle', 'instant'], {
    required_error: 'Please select a launch type',
  }),
  name: z.string().min(1, 'Token name is required').max(32, 'Name must be 32 characters or less'),
  symbol: z.string().min(1, 'Symbol is required').max(10, 'Symbol must be 10 characters or less'),
  description: z.string().min(1, 'Description is required').max(500, 'Description must be 500 characters or less'),
  totalSupply: z.number().min(1000, 'Total supply must be at least 1,000').max(1000000000, 'Total supply must be 1 billion or less'),
  decimals: z.number().min(0).max(9, 'Decimals must be 9 or less'),
  ticketPrice: z.number().min(0.001, 'Ticket price must be at least 0.001 SOL').optional(),
  numMints: z.number().min(100, 'Number of mints must be at least 100').max(10000, 'Number of mints must be 10,000 or less').optional(),
  launchDate: z.string().min(1, 'Launch date is required').optional(),
  closeDate: z.string().min(1, 'Close date is required').optional(),
  icon: z.string().url('Icon must be a valid URL').optional(),
  banner: z.string().url('Banner must be a valid URL').optional(),
  website: z.string().url('Website must be a valid URL').optional(),
  twitter: z.string().optional(),
  telegram: z.string().optional(),
  discord: z.string().optional(),
}).refine((data) => {
  if (data.launchType === 'raffle') {
    return data.ticketPrice !== undefined && data.numMints !== undefined && data.launchDate !== undefined && data.closeDate !== undefined;
  }
  return true;
}, {
  message: 'Raffle launch requires ticket price, number of mints, and launch dates',
  path: ['ticketPrice'],
});

type CreateLaunchForm = z.infer<typeof createLaunchSchema>;

export default function CreateLaunchPage() {
  const { connected, publicKey } = useWallet();
  const createLaunchMutation = useCreateLaunch();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    setValue,
  } = useForm<CreateLaunchForm>({
    resolver: zodResolver(createLaunchSchema),
    defaultValues: {
      launchType: 'raffle',
      decimals: 9,
      totalSupply: 1000000,
      ticketPrice: 0.1,
      numMints: 1000,
    },
  });

  // Debug form state
  console.log('🔍 Form state:', { 
    isValid, 
    errors, 
    isSubmitting, 
    isPending: createLaunchMutation.isPending,
    connected,
    publicKey: publicKey?.toString()
  });

  const watchedValues = watch();

  const onSubmit = async (data: CreateLaunchForm) => {
    console.log('🚀 Create Launch Form Submitted:', data);
    
    if (!connected || !publicKey) {
      console.log('❌ Wallet not connected');
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to create a launch.",
        variant: "destructive",
      });
      return;
    }

    console.log('✅ Wallet connected, starting submission...');
    setIsSubmitting(true);

    try {
      // Convert form data to launch data format based on launch type
      const launchData = {
        launchType: data.launchType,
        name: data.name,
        symbol: data.symbol,
        uri: '', // This would be generated from metadata
        icon: data.icon || '',
        banner: data.banner || '',
        description: data.description,
        website: data.website || '',
        twitter: data.twitter || '',
        telegram: data.telegram || '',
        discord: data.discord || '',
        totalSupply: data.totalSupply,
        decimals: data.decimals,
        pageName: data.name.toLowerCase().replace(/\s+/g, '-'),
        transferFee: 0,
        maxTransferFee: 0,
        extensions: 0,
        ammProvider: 0,
        whitelistTokens: 0,
        whitelistEnd: 0,
        // Raffle-specific fields
        ...(data.launchType === 'raffle' && {
          launchDate: Math.floor(new Date(data.launchDate!).getTime() / 1000),
          closeDate: Math.floor(new Date(data.closeDate!).getTime() / 1000),
          numMints: data.numMints!,
          ticketPrice: Math.floor(data.ticketPrice! * 1e9), // Convert SOL to lamports
        }),
      };

      console.log('📝 Launch data prepared:', launchData);
      
      // Create the launch
      console.log('🔄 Calling createLaunchMutation...');
      const signature = await createLaunchMutation.mutateAsync(launchData);
      console.log('✅ Launch created successfully! Signature:', signature);

        toast({
        title: "Launch Created Successfully!",
        description: `Your token launch has been created. Transaction: ${signature.slice(0, 8)}...`,
      });

      // Reset form
      // You could redirect to the launch page here
      
    } catch (error) {
      console.error('❌ Error creating launch:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        error
      });
      toast({
        title: "Launch Creation Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
        variant: "destructive",
      });
    } finally {
      console.log('🏁 Create launch process finished');
      setIsSubmitting(false);
    }
  };

  if (!connected) {
  return (
      <div className="min-h-screen bg-background">
        <Header 
          title="Create Launch"
          subtitle="Launch your token on Solana"
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
        title="Create Launch"
        subtitle="Launch your token on Solana"
        showNavigation={true}
      />
      <div className="pt-24 pb-12">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto"
        >
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-4">
              <Rocket className="w-8 h-8 text-primary mr-3" />
              <h1 className="text-4xl font-bold">Create Token Launch</h1>
                    </div>
            <p className="text-xl text-muted-foreground">
              Launch your token with fair distribution through our raffle system
                    </p>
            <div className="mt-4 space-x-2">
              <Button 
                variant="outline" 
                onClick={() => window.location.href = '/simple-create'}
                className="mr-2"
              >
                🧪 Test Simple Launch (Direct Program)
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.location.href = '/ultra-test'}
                className="mr-2"
              >
                🔬 Ultra Simple Test
              </Button>
            </div>
                  </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" onInvalid={(e) => console.log('❌ Form validation failed:', e)}>
            {/* Launch Type Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Rocket className="w-5 h-5 mr-2" />
                  Launch Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={watchedValues.launchType}
                  onValueChange={(value) => setValue('launchType', value as 'raffle' | 'instant')}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="raffle" id="raffle" />
                    <Label htmlFor="raffle" className="flex-1 cursor-pointer">
                      <div className="flex items-center space-x-3">
                        <Ticket className="w-6 h-6 text-primary" />
                        <div>
                          <div className="font-semibold">Raffle Launch</div>
                          <div className="text-sm text-muted-foreground">
                            Fair distribution through ticket-based raffle system
                          </div>
                        </div>
                      </div>
                      </Label>
                    </div>
                  <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="instant" id="instant" />
                    <Label htmlFor="instant" className="flex-1 cursor-pointer">
                      <div className="flex items-center space-x-3">
                        <Zap className="w-6 h-6 text-primary" />
                        <div>
                          <div className="font-semibold">Instant Launch</div>
                          <div className="text-sm text-muted-foreground">
                            Immediate token launch with instant trading
                          </div>
                        </div>
                      </div>
                    </Label>
                  </div>
            </RadioGroup>
                {errors.launchType && (
                  <p className="text-sm text-destructive mt-2">{errors.launchType.message}</p>
                )}
              </CardContent>
          </Card>

            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Token Name *</Label>
              <Input
                id="name"
                      {...register('name')}
                      placeholder="My Awesome Token"
                      className={errors.name ? 'border-destructive' : ''}
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="symbol">Symbol *</Label>
                    <Input
                      id="symbol"
                      {...register('symbol')}
                      placeholder="MAT"
                      className={errors.symbol ? 'border-destructive' : ''}
                    />
                    {errors.symbol && (
                      <p className="text-sm text-destructive">{errors.symbol.message}</p>
                    )}
                  </div>
            </div>

            <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                    {...register('description')}
                    placeholder="Describe your token and its purpose..."
                rows={4}
                    className={errors.description ? 'border-destructive' : ''}
                  />
                  {errors.description && (
                    <p className="text-sm text-destructive">{errors.description.message}</p>
                  )}
            </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
                    <Label htmlFor="icon">Icon URL (Optional)</Label>
              <Input
                      id="icon"
                      {...register('icon')}
                      placeholder="https://example.com/icon.png"
                      className={errors.icon ? 'border-destructive' : ''}
                    />
                    {errors.icon && (
                      <p className="text-sm text-destructive">{errors.icon.message}</p>
                    )}
            </div>
            <div className="space-y-2">
                    <Label htmlFor="banner">Banner URL (Optional)</Label>
              <Input
                      id="banner"
                      {...register('banner')}
                      placeholder="https://example.com/banner.png"
                      className={errors.banner ? 'border-destructive' : ''}
                    />
                    {errors.banner && (
                      <p className="text-sm text-destructive">{errors.banner.message}</p>
                    )}
                  </div>
            </div>
              </CardContent>
            </Card>

            {/* Social Media & Links */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Social Media & Links
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
                    <Label htmlFor="website">Website URL (Optional)</Label>
              <Input
                id="website"
                      {...register('website')}
                      placeholder="https://example.com"
                      className={errors.website ? 'border-destructive' : ''}
                    />
                    {errors.website && (
                      <p className="text-sm text-destructive">{errors.website.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="twitter">Twitter Handle (Optional)</Label>
                    <Input
                      id="twitter"
                      {...register('twitter')}
                      placeholder="@yourhandle"
                      className={errors.twitter ? 'border-destructive' : ''}
                    />
                    {errors.twitter && (
                      <p className="text-sm text-destructive">{errors.twitter.message}</p>
                    )}
                        </div>
                      </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="telegram">Telegram (Optional)</Label>
                    <Input
                      id="telegram"
                      {...register('telegram')}
                      placeholder="https://t.me/yourgroup"
                      className={errors.telegram ? 'border-destructive' : ''}
                    />
                    {errors.telegram && (
                      <p className="text-sm text-destructive">{errors.telegram.message}</p>
                    )}
                    </div>
                  <div className="space-y-2">
                    <Label htmlFor="discord">Discord (Optional)</Label>
                          <Input
                      id="discord"
                      {...register('discord')}
                      placeholder="https://discord.gg/yourinvite"
                      className={errors.discord ? 'border-destructive' : ''}
                    />
                    {errors.discord && (
                      <p className="text-sm text-destructive">{errors.discord.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Token Economics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="w-5 h-5 mr-2" />
                  Token Economics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
                    <Label htmlFor="totalSupply">Total Supply *</Label>
                        <Input
                      id="totalSupply"
                          type="number"
                      {...register('totalSupply', { valueAsNumber: true })}
                      className={errors.totalSupply ? 'border-destructive' : ''}
                    />
                    {errors.totalSupply && (
                      <p className="text-sm text-destructive">{errors.totalSupply.message}</p>
                    )}
                      </div>
                  <div className="space-y-2">
                    <Label htmlFor="decimals">Decimals *</Label>
                    <Input
                      id="decimals"
                      type="number"
                      {...register('decimals', { valueAsNumber: true })}
                      className={errors.decimals ? 'border-destructive' : ''}
                    />
                    {errors.decimals && (
                      <p className="text-sm text-destructive">{errors.decimals.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Raffle-Specific Settings */}
            {watchedValues.launchType === 'raffle' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Ticket className="w-5 h-5 mr-2" />
                    Raffle Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="ticketPrice">Ticket Price (SOL) *</Label>
                          <Input
                        id="ticketPrice"
                            type="number"
                        step="0.001"
                        {...register('ticketPrice', { valueAsNumber: true })}
                        className={errors.ticketPrice ? 'border-destructive' : ''}
                      />
                      {errors.ticketPrice && (
                        <p className="text-sm text-destructive">{errors.ticketPrice.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="numMints">Number of Tickets *</Label>
                          <Input
                        id="numMints"
                            type="number"
                        {...register('numMints', { valueAsNumber: true })}
                        className={errors.numMints ? 'border-destructive' : ''}
                      />
                      {errors.numMints && (
                        <p className="text-sm text-destructive">{errors.numMints.message}</p>
                      )}
                        </div>
                      </div>
                  <p className="text-sm text-muted-foreground">
                    This determines how many tickets will be available for purchase
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Launch Schedule */}
            {watchedValues.launchType === 'raffle' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="w-5 h-5 mr-2" />
                    Launch Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="launchDate">Launch Date *</Label>
                      <Input
                        id="launchDate"
                        type="datetime-local"
                        {...register('launchDate')}
                        className={errors.launchDate ? 'border-destructive' : ''}
                      />
                      {errors.launchDate && (
                        <p className="text-sm text-destructive">{errors.launchDate.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="closeDate">Close Date *</Label>
                          <Input
                        id="closeDate"
                        type="datetime-local"
                        {...register('closeDate')}
                        className={errors.closeDate ? 'border-destructive' : ''}
                      />
                      {errors.closeDate && (
                        <p className="text-sm text-destructive">{errors.closeDate.message}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    The raffle will be open for ticket purchases during this time period
                  </p>
                </CardContent>
          </Card>
        )}
            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Launch Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                      <h4 className="font-semibold">Token Details</h4>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>Name: {watchedValues.name || 'Not specified'}</p>
                        <p>Symbol: {watchedValues.symbol || 'Not specified'}</p>
                        <p>Supply: {watchedValues.totalSupply?.toLocaleString() || 'Not specified'}</p>
                        <p>Decimals: {watchedValues.decimals || 'Not specified'}</p>
              </div>
                </div>
              </div>
                  <div className="space-y-4">
              <div>
                      <h4 className="font-semibold">Launch Details</h4>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>Tickets: {watchedValues.numMints?.toLocaleString() || 'Not specified'}</p>
                        <p>Price: {watchedValues.ticketPrice || 'Not specified'} SOL</p>
                        <p>Total Value: {watchedValues.numMints && watchedValues.ticketPrice 
                          ? (watchedValues.numMints * watchedValues.ticketPrice).toFixed(2) + ' SOL'
                          : 'Not specified'}</p>
                </div>
              </div>
                  </div>
                </div>
              </CardContent>
          </Card>

            {/* Submit Button */}
            <div className="flex justify-center">
            <Button
                type="submit"
                size="lg"
                disabled={isSubmitting || createLaunchMutation.isPending}
                className="min-w-[200px]"
                onClick={() => console.log('🔘 Create Launch button clicked!', { isSubmitting, isPending: createLaunchMutation.isPending })}
              >
                {isSubmitting || createLaunchMutation.isPending ? (
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
        </div>
          </form>
        </motion.div>
        </div>
      </div>
    </div>
  );
}