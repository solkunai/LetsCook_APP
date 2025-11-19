/**
 * On-Chain Events Service
 * 
 * Emits on-chain events for explorers and analytics
 * Tracks pool creation, liquidity locking, threshold met, etc.
 */

import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { getConnection } from './connection';

export interface PoolCreationEvent {
  tokenMint: string;
  poolAddress: string;
  dexProvider: 'cook' | 'raydium';
  solAmount: number;
  tokenAmount: number;
  timestamp: number;
  transactionSignature: string;
}

export interface LiquidityLockEvent {
  tokenMint: string;
  lockAddress: string;
  lpTokenMint: string;
  lockedAmount: number;
  lockDuration: number;
  unlockDate: number;
  creator: string;
  timestamp: number;
  transactionSignature: string;
}

export interface ThresholdMetEvent {
  launchId: string;
  thresholdAmount: number;
  currentAmount: number;
  timestamp: number;
  transactionSignature: string;
}

export interface BondingCurveClosedEvent {
  launchId: string;
  finalPrice: number;
  totalLiquidity: number;
  timestamp: number;
  transactionSignature: string;
}

export interface TradingStartedEvent {
  launchId: string;
  poolAddress: string;
  dexProvider: 'cook' | 'raydium';
  timestamp: number;
  transactionSignature: string;
}

export class OnChainEventsService {
  private connection: Connection;
  private events: Map<string, any[]> = new Map();

  constructor(connection?: Connection) {
    this.connection = connection || getConnection('confirmed');
  }

  /**
   * Emit pool creation event
   */
  async emitPoolCreationEvent(event: PoolCreationEvent): Promise<void> {
    try {
      console.log('📡 Emitting pool creation event:', event);

      // In production, this would emit an on-chain event
      // For now, we'll log it and store it locally
      this.storeEvent('pool_creation', event);

      // In production, you would:
      // 1. Create an instruction to emit the event
      // 2. Add it to the transaction
      // 3. The program would emit the event on-chain
      // Example:
      // const eventInstruction = new TransactionInstruction({
      //   keys: [...],
      //   programId: EVENT_PROGRAM_ID,
      //   data: Buffer.from(JSON.stringify(event))
      // });
      // transaction.add(eventInstruction);
    } catch (error) {
      console.error('❌ Error emitting pool creation event:', error);
    }
  }

  /**
   * Emit liquidity lock event
   */
  async emitLiquidityLockEvent(event: LiquidityLockEvent): Promise<void> {
    try {
      console.log('📡 Emitting liquidity lock event:', event);

      this.storeEvent('liquidity_lock', event);
    } catch (error) {
      console.error('❌ Error emitting liquidity lock event:', error);
    }
  }

  /**
   * Emit threshold met event
   */
  async emitThresholdMetEvent(event: ThresholdMetEvent): Promise<void> {
    try {
      console.log('📡 Emitting threshold met event:', event);

      this.storeEvent('threshold_met', event);
    } catch (error) {
      console.error('❌ Error emitting threshold met event:', error);
    }
  }

  /**
   * Emit bonding curve closed event
   */
  async emitBondingCurveClosedEvent(event: BondingCurveClosedEvent): Promise<void> {
    try {
      console.log('📡 Emitting bonding curve closed event:', event);

      this.storeEvent('bonding_curve_closed', event);
    } catch (error) {
      console.error('❌ Error emitting bonding curve closed event:', error);
    }
  }

  /**
   * Emit trading started event
   */
  async emitTradingStartedEvent(event: TradingStartedEvent): Promise<void> {
    try {
      console.log('📡 Emitting trading started event:', event);

      this.storeEvent('trading_started', event);
    } catch (error) {
      console.error('❌ Error emitting trading started event:', error);
    }
  }

  /**
   * Get events for a token
   */
  async getEvents(tokenMint: string, eventType?: string): Promise<any[]> {
    try {
      const key = eventType ? `${tokenMint}_${eventType}` : tokenMint;
      return this.events.get(key) || [];
    } catch (error) {
      console.error('❌ Error getting events:', error);
      return [];
    }
  }

  /**
   * Store event in Supabase
   */
  private async storeEvent(eventType: string, event: any): Promise<void> {
    try {
      const key = `${event.tokenMint || event.launchId}_${eventType}`;
      const existingEvents = this.events.get(key) || [];
      existingEvents.push(event);
      this.events.set(key, existingEvents);

      // Save to Supabase
      const { supabaseEventService } = await import('./supabaseEventService');
      await supabaseEventService.storeEvent({
        event_type: eventType,
        token_mint: event.tokenMint,
        launch_id: event.launchId,
        event_data: event,
        transaction_signature: event.transactionSignature,
        block_time: Math.floor((event.timestamp || Date.now()) / 1000)
      });
    } catch (error) {
      console.error('❌ Error storing event:', error);
    }
  }

  /**
   * Load events from Supabase
   */
  async loadEvents(tokenMint: string, eventType?: string): Promise<any[]> {
    try {
      const { supabaseEventService } = await import('./supabaseEventService');
      const events = await supabaseEventService.getEvents(tokenMint, undefined, eventType);
      
      // Convert to format expected by the service
      const formattedEvents = events.map(e => e.event_data);
      
      // Update memory cache
      const key = eventType ? `${tokenMint}_${eventType}` : tokenMint;
      this.events.set(key, formattedEvents);
      
      return formattedEvents;
    } catch (error) {
      console.error('❌ Error loading events:', error);
      return [];
    }
  }

  /**
   * Clear events
   */
  clearEvents(): void {
    this.events.clear();
  }
}

export const onChainEventsService = new OnChainEventsService();

