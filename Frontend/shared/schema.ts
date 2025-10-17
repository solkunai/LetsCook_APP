import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  walletAddress: text("wallet_address"),
  saucePoints: integer("sauce_points").notNull().default(0),
  referralCode: text("referral_code").unique(),
  referredBy: text("referred_by"),
});

export const raffles = pgTable("raffles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenName: text("token_name").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  ticketPrice: decimal("ticket_price", { precision: 10, scale: 2 }).notNull(),
  totalTickets: integer("total_tickets").notNull(),
  soldTickets: integer("sold_tickets").notNull().default(0),
  status: text("status").notNull().default("open"), // open, closed, results, failed
  launchDate: timestamp("launch_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  tokenImage: text("token_image"),
  banner: text("banner"),
  createdBy: text("created_by"),
  // Tokenomics
  totalSupply: decimal("total_supply", { precision: 20, scale: 0 }).notNull(),
  decimals: integer("decimals").notNull().default(9),
  // Market making rewards
  marketMakingRewardPercent: decimal("market_making_reward_percent", { precision: 5, scale: 2 }).default("0"),
  // Liquidity threshold
  liquidityThreshold: decimal("liquidity_threshold", { precision: 10, scale: 2 }).notNull(),
  // Winner count
  winnerCount: integer("winner_count").notNull(),
  // Trending metrics
  hypeScore: integer("hype_score").notNull().default(0),
  trendingScore: integer("trending_score").notNull().default(0),
  // AMM integration
  ammProvider: text("amm_provider").default("cook"), // cook, raydium
  liquidityPoolAddress: text("liquidity_pool_address"),
  // Token contract
  tokenMint: text("token_mint").notNull(),
  // Description and social links
  description: text("description"),
  website: text("website"),
  twitter: text("twitter"),
  telegram: text("telegram"),
  discord: text("discord"),
});

export const tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  raffleId: text("raffle_id").notNull(),
  userId: text("user_id").notNull(),
  quantity: integer("quantity").notNull(),
  isWinner: boolean("is_winner").default(false),
  claimed: boolean("claimed").default(false),
  purchaseDate: timestamp("purchase_date").notNull().default(sql`now()`),
});

export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerId: text("referrer_id").notNull(),
  referredUserId: text("referred_user_id").notNull(),
  pointsEarned: integer("points_earned").notNull().default(50),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Market making rewards tracking
export const marketMakingRewards = pgTable("market_making_rewards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  raffleId: text("raffle_id").notNull(),
  userId: text("user_id").notNull(),
  tokenAmount: decimal("token_amount", { precision: 20, scale: 0 }).notNull(),
  solAmount: decimal("sol_amount", { precision: 10, scale: 2 }).notNull(),
  rewardAmount: decimal("reward_amount", { precision: 20, scale: 0 }).notNull(),
  transactionType: text("transaction_type").notNull(), // buy, sell
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Trending data for raffles and tokens
export const trendingData = pgTable("trending_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  raffleId: text("raffle_id").notNull(),
  type: text("type").notNull(), // raffle, token
  score: integer("score").notNull().default(0),
  volume24h: decimal("volume_24h", { precision: 15, scale: 2 }).default("0"),
  trades24h: integer("trades_24h").default(0),
  participants24h: integer("participants_24h").default(0),
  lastUpdated: timestamp("last_updated").notNull().default(sql`now()`),
});

// Liquidity pool tracking
export const liquidityPools = pgTable("liquidity_pools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  raffleId: text("raffle_id").notNull(),
  poolAddress: text("pool_address").notNull(),
  tokenMint: text("token_mint").notNull(),
  solReserve: decimal("sol_reserve", { precision: 15, scale: 2 }).notNull(),
  tokenReserve: decimal("token_reserve", { precision: 20, scale: 0 }).notNull(),
  totalLiquidity: decimal("total_liquidity", { precision: 15, scale: 2 }).notNull(),
  provider: text("provider").notNull(), // cook, raydium
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertRaffleSchema = createInsertSchema(raffles).omit({ id: true });
export const insertTicketSchema = createInsertSchema(tickets).omit({ id: true });
export const insertReferralSchema = createInsertSchema(referrals).omit({ id: true });
export const insertMarketMakingRewardSchema = createInsertSchema(marketMakingRewards).omit({ id: true });
export const insertTrendingDataSchema = createInsertSchema(trendingData).omit({ id: true });
export const insertLiquidityPoolSchema = createInsertSchema(liquidityPools).omit({ id: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertRaffle = z.infer<typeof insertRaffleSchema>;
export type Raffle = typeof raffles.$inferSelect;
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof tickets.$inferSelect;
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referrals.$inferSelect;
export type InsertMarketMakingReward = z.infer<typeof insertMarketMakingRewardSchema>;
export type MarketMakingReward = typeof marketMakingRewards.$inferSelect;
export type InsertTrendingData = z.infer<typeof insertTrendingDataSchema>;
export type TrendingData = typeof trendingData.$inferSelect;
export type InsertLiquidityPool = z.infer<typeof insertLiquidityPoolSchema>;
export type LiquidityPool = typeof liquidityPools.$inferSelect;
