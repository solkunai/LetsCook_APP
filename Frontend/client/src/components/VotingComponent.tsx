import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

interface VotingComponentProps {
  launchId: string;
  currentVotes?: {
    upvotes: number;
    downvotes: number;
  };
  userVote?: 'up' | 'down' | null;
  onVote?: (vote: 'up' | 'down') => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function VotingComponent({
  launchId,
  currentVotes = { upvotes: 0, downvotes: 0 },
  userVote = null,
  onVote,
  disabled = false,
  size = 'md'
}: VotingComponentProps) {
  const [isVoting, setIsVoting] = useState(false);
  const [votes, setVotes] = useState(currentVotes);
  const [userCurrentVote, setUserCurrentVote] = useState(userVote);

  const handleVote = async (voteType: 'up' | 'down') => {
    if (disabled || isVoting) return;

    setIsVoting(true);
    
    try {
      // If user is voting the same way, remove the vote
      if (userCurrentVote === voteType) {
        setVotes(prev => ({
          upvotes: voteType === 'up' ? prev.upvotes - 1 : prev.upvotes,
          downvotes: voteType === 'down' ? prev.downvotes - 1 : prev.downvotes
        }));
        setUserCurrentVote(null);
        
        toast({
          title: "Vote Removed",
          description: `Your ${voteType}vote has been removed.`,
        });
      } else {
        // If user is changing vote, update both counts
        const newVotes = { ...votes };
        if (userCurrentVote === 'up') {
          newVotes.upvotes -= 1;
        } else if (userCurrentVote === 'down') {
          newVotes.downvotes -= 1;
        }
        
        if (voteType === 'up') {
          newVotes.upvotes += 1;
        } else {
          newVotes.downvotes += 1;
        }
        
        setVotes(newVotes);
        setUserCurrentVote(voteType);
        
        toast({
          title: "Vote Submitted",
          description: `Your ${voteType}vote has been recorded!`,
        });
      }

      // Call the onVote callback if provided
      if (onVote) {
        onVote(userCurrentVote === voteType ? null : voteType);
      }

      // Here you would typically call your backend API to record the vote
      // await voteService.submitVote(launchId, voteType);
      
    } catch (error) {
      console.error('Error voting:', error);
      toast({
        title: "Vote Failed",
        description: "Failed to submit vote. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVoting(false);
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          button: 'p-1 h-6 w-6',
          icon: 'w-3 h-3',
          text: 'text-xs'
        };
      case 'lg':
        return {
          button: 'p-2 h-10 w-10',
          icon: 'w-5 h-5',
          text: 'text-sm'
        };
      default:
        return {
          button: 'p-1.5 h-8 w-8',
          icon: 'w-4 h-4',
          text: 'text-xs'
        };
    }
  };

  const sizeClasses = getSizeClasses();

  return (
    <div className="flex items-center gap-2">
      {/* Upvote Button */}
      <Button
        variant="ghost"
        size="sm"
        className={`${sizeClasses.button} transition-all duration-200 ${
          userCurrentVote === 'up'
            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
            : 'hover:bg-green-500/10 hover:text-green-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => handleVote('up')}
        disabled={disabled || isVoting}
      >
        <ThumbsUp className={sizeClasses.icon} />
      </Button>

      {/* Vote Count */}
      <div className={`${sizeClasses.text} text-muted-foreground min-w-[3rem] text-center`}>
        <div className="flex items-center justify-center gap-1">
          <span className="text-green-400">{votes.upvotes}</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-red-400">{votes.downvotes}</span>
        </div>
      </div>

      {/* Downvote Button */}
      <Button
        variant="ghost"
        size="sm"
        className={`${sizeClasses.button} transition-all duration-200 ${
          userCurrentVote === 'down'
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
            : 'hover:bg-red-500/10 hover:text-red-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => handleVote('down')}
        disabled={disabled || isVoting}
      >
        <ThumbsDown className={sizeClasses.icon} />
      </Button>
    </div>
  );
}
