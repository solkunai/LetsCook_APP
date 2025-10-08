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
  status: text("status").notNull().default("open"), // open, closed, results
  launchDate: timestamp("launch_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  tokenImage: text("token_image"),
  createdBy: text("created_by"),
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

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertRaffleSchema = createInsertSchema(raffles).omit({ id: true });
export const insertTicketSchema = createInsertSchema(tickets).omit({ id: true });
export const insertReferralSchema = createInsertSchema(referrals).omit({ id: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertRaffle = z.infer<typeof insertRaffleSchema>;
export type Raffle = typeof raffles.$inferSelect;
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof tickets.$inferSelect;
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referrals.$inferSelect;
