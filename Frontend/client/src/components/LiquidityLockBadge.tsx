/**
 * Liquidity Lock Badge Component
 * 
 * Displays liquidity lock status with badge and countdown timer
 */

import React, { useState, useEffect } from 'react';
import { Lock, Shield, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface LiquidityLockInfo {
  isLocked: boolean;
  lockAddress?: string;
  unlockDate?: Date;
  lockDuration?: number; // in days
  lockedAmount?: number;
  lpTokenMint?: string;
}

interface LiquidityLockBadgeProps {
  lockInfo: LiquidityLockInfo;
  className?: string;
}

export const LiquidityLockBadge: React.FC<LiquidityLockBadgeProps> = ({ lockInfo, className = '' }) => {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!lockInfo.isLocked || !lockInfo.unlockDate) {
      return;
    }

    const updateCountdown = () => {
      const now = new Date().getTime();
      const unlock = new Date(lockInfo.unlockDate!).getTime();
      const diff = unlock - now;

      if (diff <= 0) {
        setIsExpired(true);
        setTimeRemaining('Unlocked');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [lockInfo.unlockDate, lockInfo.isLocked]);

  if (!lockInfo.isLocked || isExpired) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Badge variant="outline" className="bg-yellow-500/10 border-yellow-500/20 text-yellow-400 px-3 py-1">
        <Lock className="w-3 h-3 mr-1" />
        <span className="text-xs font-medium">Liquidity Locked</span>
      </Badge>
      {timeRemaining && (
        <Badge variant="outline" className="bg-slate-800/50 border-slate-700 text-slate-300 px-3 py-1">
          <Clock className="w-3 h-3 mr-1" />
          <span className="text-xs font-mono">{timeRemaining}</span>
        </Badge>
      )}
      {lockInfo.lockDuration && (
        <div className="flex items-center space-x-1 text-xs text-slate-400">
          <Shield className="w-3 h-3" />
          <span>{lockInfo.lockDuration} days</span>
        </div>
      )}
    </div>
  );
};

export default LiquidityLockBadge;

