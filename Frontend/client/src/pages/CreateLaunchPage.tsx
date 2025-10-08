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
import { 
  Rocket, 
  AlertCircle,
  Loader2,
  CheckCircle,
  ExternalLink
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import { SimpleDirectProgramService } from '@/lib/simpleDirectProgram';

// Simplified form validation schema
const createLaunchSchema = z.object({
  name: z.string().min(1, 'Token name is required').max(32, 'Name must be 32 characters or less'),
  symbol: z.string().min(1, 'Symbol is required').max(10, 'Symbol must be 10 characters or less'),
  description: z.string().min(1, 'Description is required').max(500, 'Description must be 500 characters or less'),
  totalSupply: z.number().min(1000, 'Total supply must be at least 1,000').max(1000000000, 'Total supply must be 1 billion or less'),
  decimals: z.number().min(0).max(9, 'Decimals must be 9 or less'),
});

type CreateLaunchForm = z.infer<typeof createLaunchSchema>;

export default function CreateLaunchPage() {
  const { connected, publicKey, wallet } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    reset,
  } = useForm<CreateLaunchForm>({
    resolver: zodResolver(createLaunchSchema),
    defaultValues: {
      decimals: 9,
      totalSupply: 1000000,
    },
  });

  const watchedValues = watch();

  const onSubmit = async (data: CreateLaunchForm) => {
    console.log('🚀 Create Launch Form Submitted:', data);
    
    if (!connected || !publicKey || !wallet) {
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
      // Create the launch data
      const launchData = {
        name: data.name,
        symbol: data.symbol,
        description: data.description,
        totalSupply: data.totalSupply,
        decimals: data.decimals,
      };

      console.log('📝 Launch data prepared:', launchData);
      
      // Use SimpleDirectProgramService for direct program interaction
      const programService = new SimpleDirectProgramService();
      
      console.log('🔄 Calling createSimpleLaunch...');
      const signature = await programService.createSimpleLaunch(wallet, launchData);
      
      console.log('✅ Launch created successfully! Signature:', signature);
      setLastTransaction(signature);

      toast({
        title: "Launch Created Successfully!",
        description: `Your token launch has been created. Transaction: ${signature.slice(0, 8)}...`,
      });

      // Reset form
      reset();
      
    } catch (error) {
      console.error('❌ Error creating launch:', error);
      
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      
      toast({
        title: "Launch Creation Failed",
        description: errorMessage,
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
            className="max-w-2xl mx-auto"
          >
            {/* Header */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center mb-4">
                <Rocket className="w-8 h-8 text-primary mr-3" />
                <h1 className="text-3xl font-bold">Create Token Launch</h1>
              </div>
              <p className="text-lg text-muted-foreground">
                Launch your token with our simplified system
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
                        Launch created successfully!
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

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Rocket className="w-5 h-5 mr-2" />
                    Token Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Token Name *</Label>
                      <Input
                        id="name"
                        {...register('name')}
                        placeholder="My Awesome Token"
                        className={errors.name ? 'border-destructive' : ''}
                        disabled={isSubmitting}
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
                        disabled={isSubmitting}
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
                      rows={3}
                      className={errors.description ? 'border-destructive' : ''}
                      disabled={isSubmitting}
                    />
                    {errors.description && (
                      <p className="text-sm text-destructive">{errors.description.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="totalSupply">Total Supply *</Label>
                      <Input
                        id="totalSupply"
                        type="number"
                        {...register('totalSupply', { valueAsNumber: true })}
                        className={errors.totalSupply ? 'border-destructive' : ''}
                        disabled={isSubmitting}
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
                        disabled={isSubmitting}
                      />
                      {errors.decimals && (
                        <p className="text-sm text-destructive">{errors.decimals.message}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Launch Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-medium">{watchedValues.name || 'Not specified'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Symbol:</span>
                      <span className="font-medium">{watchedValues.symbol || 'Not specified'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Supply:</span>
                      <span className="font-medium">{watchedValues.totalSupply?.toLocaleString() || 'Not specified'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Decimals:</span>
                      <span className="font-medium">{watchedValues.decimals || 'Not specified'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Submit Button */}
              <div className="flex justify-center">
                <Button
                  type="submit"
                  size="lg"
                  disabled={isSubmitting || !isValid}
                  className="min-w-[200px]"
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
              </div>
            </form>

            {/* Debug Info */}
            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="text-sm">Debug Information</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                <div>Wallet Connected: {connected ? 'Yes' : 'No'}</div>
                <div>Public Key: {publicKey?.toString().slice(0, 8)}...</div>
                <div>Form Valid: {isValid ? 'Yes' : 'No'}</div>
                <div>Is Submitting: {isSubmitting ? 'Yes' : 'No'}</div>
                <div>Program ID: {import.meta.env.VITE_MAIN_PROGRAM_ID || 'Using fallback'}</div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}