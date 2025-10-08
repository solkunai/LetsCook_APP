import { type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";

// Additional types for launches and tickets
export interface Launch {
  id: string;
  name: string;
  symbol: string;
  uri?: string;
  icon?: string;
  banner?: string;
  description?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  totalSupply: number;
  decimals: number;
  launchDate: number;
  closeDate: number;
  numMints: number;
  ticketPrice: number;
  pageName: string;
  transferFee: number;
  maxTransferFee: number;
  extensions: number;
  ammProvider: number;
  launchType: number;
  whitelistTokens: number;
  whitelistEnd: number;
  status: 'active' | 'closed' | 'completed';
  createdAt: string;
}

export interface Ticket {
  id: string;
  launchId: string;
  walletAddress: string;
  numTickets: number;
  totalCost: number;
  status: 'pending' | 'won' | 'lost' | 'claimed' | 'refunded';
  createdAt: string;
}

export interface InsertLaunch {
  id: string;
  name: string;
  symbol: string;
  uri?: string;
  icon?: string;
  banner?: string;
  description?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  totalSupply: number;
  decimals: number;
  launchDate: number;
  closeDate: number;
  numMints: number;
  ticketPrice: number;
  pageName: string;
  transferFee: number;
  maxTransferFee: number;
  extensions: number;
  ammProvider: number;
  launchType: number;
  whitelistTokens: number;
  whitelistEnd: number;
  status: 'active' | 'closed' | 'completed';
  createdAt: string;
}

export interface InsertTicket {
  id: string;
  launchId: string;
  walletAddress: string;
  numTickets: number;
  totalCost: number;
  status: 'pending' | 'won' | 'lost' | 'claimed' | 'refunded';
  createdAt: string;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Launch methods
  getAllLaunches(): Promise<Launch[]>;
  getLaunchById(id: string): Promise<Launch | undefined>;
  insertLaunch(launch: InsertLaunch): Promise<Launch>;
  updateLaunch(id: string, updates: Partial<Launch>): Promise<Launch | undefined>;
  
  // Ticket methods
  getTicketsByWallet(walletAddress: string): Promise<Ticket[]>;
  getTicketsByLaunch(launchId: string): Promise<Ticket[]>;
  insertTicket(ticket: InsertTicket): Promise<Ticket>;
  updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private launches: Map<string, Launch>;
  private tickets: Map<string, Ticket>;

  constructor() {
    this.users = new Map();
    this.launches = new Map();
    this.tickets = new Map();
    
    // Add some mock data for development
    this.initializeMockData();
  }

  private initializeMockData() {
    // Mock launches
    const mockLaunch1: Launch = {
      id: 'launch_1',
      name: 'ChefCoin',
      symbol: 'CHEF',
      description: 'The ultimate cooking token for chefs worldwide',
      totalSupply: 1000000,
      decimals: 6,
      launchDate: Date.now() + 86400000, // Tomorrow
      closeDate: Date.now() + 172800000, // Day after tomorrow
      numMints: 100,
      ticketPrice: 0.1,
      pageName: 'chefcoin',
      transferFee: 100,
      maxTransferFee: 1000,
      extensions: 0,
      ammProvider: 0,
      launchType: 0,
      whitelistTokens: 0,
      whitelistEnd: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    
    const mockLaunch2: Launch = {
      id: 'launch_2',
      name: 'SauceToken',
      symbol: 'SAUCE',
      description: 'Spice up your portfolio with SauceToken',
      totalSupply: 500000,
      decimals: 6,
      launchDate: Date.now() - 86400000, // Yesterday
      closeDate: Date.now() + 86400000, // Tomorrow
      numMints: 50,
      ticketPrice: 0.05,
      pageName: 'sauctoken',
      transferFee: 50,
      maxTransferFee: 500,
      extensions: 0,
      ammProvider: 1,
      launchType: 1,
      whitelistTokens: 0,
      whitelistEnd: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    
    this.launches.set(mockLaunch1.id, mockLaunch1);
    this.launches.set(mockLaunch2.id, mockLaunch2);
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      walletAddress: insertUser.walletAddress ?? null,
      saucePoints: insertUser.saucePoints ?? 0,
      referralCode: insertUser.referralCode ?? null,
      referredBy: insertUser.referredBy ?? null,
    };
    this.users.set(id, user);
    return user;
  }

  // Launch methods
  async getAllLaunches(): Promise<Launch[]> {
    return Array.from(this.launches.values());
  }

  async getLaunchById(id: string): Promise<Launch | undefined> {
    return this.launches.get(id);
  }

  async insertLaunch(launch: InsertLaunch): Promise<Launch> {
    this.launches.set(launch.id, launch);
    return launch;
  }

  async updateLaunch(id: string, updates: Partial<Launch>): Promise<Launch | undefined> {
    const existing = this.launches.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.launches.set(id, updated);
    return updated;
  }

  // Ticket methods
  async getTicketsByWallet(walletAddress: string): Promise<Ticket[]> {
    return Array.from(this.tickets.values()).filter(
      ticket => ticket.walletAddress === walletAddress
    );
  }

  async getTicketsByLaunch(launchId: string): Promise<Ticket[]> {
    return Array.from(this.tickets.values()).filter(
      ticket => ticket.launchId === launchId
    );
  }

  async insertTicket(ticket: InsertTicket): Promise<Ticket> {
    this.tickets.set(ticket.id, ticket);
    return ticket;
  }

  async updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket | undefined> {
    const existing = this.tickets.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.tickets.set(id, updated);
    return updated;
  }
}

export const storage = new MemStorage();
