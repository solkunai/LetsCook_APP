import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  X, 
  Ticket, 
  DollarSign, 
  Loader2, 
  CheckCircle,
  AlertCircle,
  Minus,
  Plus
} from 'lucide-react';
import { useBuyTickets } from '@/hooks/useApi';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from '@/hooks/use-toast';

// Form validation schema
const buyTicketsSchema = z.object({
  numTickets: z.number().min(1, 'Must buy at least 1 ticket').max(100, 'Cannot buy more than 100 tickets at once'),
});

type BuyTicketsForm = z.infer<typeof buyTicketsSchema>;

interface BuyTicketsModalProps {
  isOpen: boolean;
  onClose: () => void;
  launch: {
    id: string;
    name: string;
    symbol: string;
    ticketPrice: number;
    totalTicketsSold: number;
    numMints: number;
  };
}

export function BuyTicketsModal({ isOpen, onClose, launch }: BuyTicketsModalProps) {
  const { connected, publicKey } = useWallet();
  const buyTicketsMutation = useBuyTickets();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [numTickets, setNumTickets] = useState(1);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<BuyTicketsForm>({
    resolver: zodResolver(buyTicketsSchema),
    defaultValues: {
      numTickets: 1,
    },
  });

  const watchedTickets = watch('numTickets') || numTickets;
  const totalCost = watchedTickets * (launch.ticketPrice / 1e9); // Convert lamports to SOL
  const ticketsRemaining = launch.numMints - launch.totalTicketsSold;

  const onSubmit = async (data: BuyTicketsForm) => {
    if (!connected || !publicKey) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to buy tickets.",
        variant: "destructive",
      });
      return;
    }

    if (data.numTickets > ticketsRemaining) {
      toast({
        title: "Not Enough Tickets",
        description: `Only ${ticketsRemaining} tickets remaining.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const signature = await buyTicketsMutation.mutateAsync({
        launchId: launch.id,
        numTickets: data.numTickets,
      });

      toast({
        title: "Tickets Purchased Successfully!",
        description: `You bought ${data.numTickets} tickets. Transaction: ${signature.slice(0, 8)}...`,
      });

      onClose();
    } catch (error) {
      console.error('Error buying tickets:', error);
      toast({
        title: "Purchase Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTicketChange = (change: number) => {
    const newValue = Math.max(1, Math.min(100, watchedTickets + change));
    setNumTickets(newValue);
    setValue('numTickets', newValue);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="flex items-center">
                <Ticket className="w-5 h-5 mr-2" />
                Buy Tickets
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Launch Info */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{launch.name}</h3>
                    <p className="text-sm text-muted-foreground">{launch.symbol}</p>
                  </div>
                  <Badge variant="secondary">
                    {ticketsRemaining} remaining
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Ticket Price:</span>
                  <span className="font-medium">{(launch.ticketPrice / 1e9).toFixed(3)} SOL</span>
                </div>
              </div>

              {/* Ticket Selection */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <Label htmlFor="numTickets">Number of Tickets</Label>
                  <div className="flex items-center space-x-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleTicketChange(-1)}
                      disabled={watchedTickets <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    
                    <div className="flex-1">
                      <Input
                        id="numTickets"
                        type="number"
                        min="1"
                        max={Math.min(100, ticketsRemaining)}
                        value={watchedTickets}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 1;
                          setNumTickets(value);
                          setValue('numTickets', value);
                        }}
                        className="text-center"
                      />
                    </div>
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleTicketChange(1)}
                      disabled={watchedTickets >= Math.min(100, ticketsRemaining)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {errors.numTickets && (
                    <p className="text-sm text-destructive">{errors.numTickets.message}</p>
                  )}
                </div>

                {/* Cost Summary */}
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Tickets:</span>
                    <span className="text-sm font-medium">{watchedTickets}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Price per ticket:</span>
                    <span className="text-sm font-medium">{(launch.ticketPrice / 1e9).toFixed(3)} SOL</span>
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Total Cost:</span>
                      <span className="font-bold text-lg">{totalCost.toFixed(3)} SOL</span>
                    </div>
                  </div>
                </div>

                {/* Warning */}
                {ticketsRemaining < 100 && (
                  <div className="flex items-start space-x-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Only {ticketsRemaining} tickets remaining. Purchase quickly!
                    </p>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting || buyTicketsMutation.isPending || !connected}
                >
                  {isSubmitting || buyTicketsMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : !connected ? (
                    'Connect Wallet to Buy'
                  ) : (
                    <>
                      <DollarSign className="w-4 h-4 mr-2" />
                      Buy {watchedTickets} Ticket{watchedTickets > 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default BuyTicketsModal;