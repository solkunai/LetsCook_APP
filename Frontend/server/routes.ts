import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";

// Solana connection
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

export async function registerRoutes(app: Express): Promise<Server> {
  // Solana program routes
  app.post('/api/solana/transaction', async (req, res) => {
    try {
      const { transaction, walletAddress } = req.body;
      
      if (!transaction || !walletAddress) {
        return res.status(400).json({ error: 'Missing transaction or wallet address' });
      }

      // In a real implementation, you would:
      // 1. Verify the transaction signature
      // 2. Send the transaction to Solana
      // 3. Return the transaction signature
      
      // For now, we'll simulate a successful transaction
      const mockSignature = 'mock_signature_' + Date.now();
      
      res.json({ 
        success: true, 
        signature: mockSignature,
        message: 'Transaction submitted successfully' 
      });
    } catch (error) {
      console.error('Transaction error:', error);
      res.status(500).json({ error: 'Failed to process transaction' });
    }
  });

  // Get account info
  app.get('/api/solana/account/:address', async (req, res) => {
    try {
      const { address } = req.params;
      const publicKey = new PublicKey(address);
      
      const accountInfo = await connection.getAccountInfo(publicKey);
      const balance = await connection.getBalance(publicKey);
      
      res.json({
        address: address,
        balance: balance / 1e9, // Convert lamports to SOL
        exists: accountInfo !== null,
        data: accountInfo?.data,
        owner: accountInfo?.owner.toString(),
      });
    } catch (error) {
      console.error('Account info error:', error);
      res.status(500).json({ error: 'Failed to get account info' });
    }
  });

  // Get program accounts
  app.get('/api/solana/program-accounts', async (req, res) => {
    try {
      const { programId } = req.query;
      
      if (!programId) {
        return res.status(400).json({ error: 'Missing program ID' });
      }

      const accounts = await connection.getProgramAccounts(new PublicKey(programId as string));
      
      res.json({
        accounts: accounts.map(account => ({
          pubkey: account.pubkey.toString(),
          account: {
            data: account.account.data,
            executable: account.account.executable,
            lamports: account.account.lamports,
            owner: account.account.owner.toString(),
            rentEpoch: account.account.rentEpoch,
          }
        }))
      });
    } catch (error) {
      console.error('Program accounts error:', error);
      res.status(500).json({ error: 'Failed to get program accounts' });
    }
  });

  // Create launch endpoint
  app.post('/api/launches/create', async (req, res) => {
    try {
      const launchData = req.body;
      
      // Validate required fields
      const requiredFields = ['name', 'symbol', 'totalSupply', 'ticketPrice'];
      for (const field of requiredFields) {
        if (!launchData[field]) {
          return res.status(400).json({ error: `Missing required field: ${field}` });
        }
      }

      // Store launch data in database
      const launch = await storage.insertLaunch({
        id: `launch_${Date.now()}`,
        name: launchData.name,
        symbol: launchData.symbol,
        totalSupply: launchData.totalSupply,
        ticketPrice: launchData.ticketPrice,
        status: 'active',
        createdAt: new Date().toISOString(),
        ...launchData
      });

      res.json({ 
        success: true, 
        launch,
        message: 'Launch created successfully' 
      });
    } catch (error) {
      console.error('Create launch error:', error);
      res.status(500).json({ error: 'Failed to create launch' });
    }
  });

  // Buy tickets endpoint
  app.post('/api/tickets/buy', async (req, res) => {
    try {
      const { launchId, numTickets, walletAddress } = req.body;
      
      if (!launchId || !numTickets || !walletAddress) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Get launch info
      const launch = await storage.getLaunchById(launchId);
      if (!launch) {
        return res.status(404).json({ error: 'Launch not found' });
      }

      // Calculate total cost
      const totalCost = launch.ticketPrice * numTickets;

      // Create ticket purchase record
      const ticket = await storage.insertTicket({
        id: `ticket_${Date.now()}`,
        launchId,
        walletAddress,
        numTickets,
        totalCost,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      res.json({ 
        success: true, 
        ticket,
        totalCost,
        message: 'Tickets purchased successfully' 
      });
    } catch (error) {
      console.error('Buy tickets error:', error);
      res.status(500).json({ error: 'Failed to buy tickets' });
    }
  });

  // Get user tickets
  app.get('/api/tickets/user/:walletAddress', async (req, res) => {
    try {
      const { walletAddress } = req.params;
      
      const tickets = await storage.getTicketsByWallet(walletAddress);
      
      res.json({ tickets });
    } catch (error) {
      console.error('Get tickets error:', error);
      res.status(500).json({ error: 'Failed to get tickets' });
    }
  });

  // Get all launches
  app.get('/api/launches', async (req, res) => {
    try {
      const launches = await storage.getAllLaunches();
      res.json({ launches });
    } catch (error) {
      console.error('Get launches error:', error);
      res.status(500).json({ error: 'Failed to get launches' });
    }
  });

  // Get launch by ID
  app.get('/api/launches/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const launch = await storage.getLaunchById(id);
      
      if (!launch) {
        return res.status(404).json({ error: 'Launch not found' });
      }
      
      res.json({ launch });
    } catch (error) {
      console.error('Get launch error:', error);
      res.status(500).json({ error: 'Failed to get launch' });
    }
  });

  // Pinata IPFS proxy endpoint (bypasses CORS)
  // Accepts base64 file data from frontend
  app.post('/api/pinata/upload', async (req, res) => {
    try {
      // Get Pinata credentials from environment
      const PINATA_JWT = process.env.PINATA_JWT || process.env.VITE_PINATA_JWT || '';
      const PINATA_API_KEY = process.env.PINATA_API_KEY || process.env.VITE_PINATA_API_KEY || '';
      const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY || process.env.VITE_PINATA_SECRET_KEY || '';

      if (!PINATA_JWT && (!PINATA_API_KEY || !PINATA_SECRET_KEY)) {
        return res.status(500).json({ error: 'Pinata credentials not configured on server' });
      }

      const { fileData, filename, contentType, metadata, options } = req.body;

      if (!fileData) {
        return res.status(400).json({ error: 'Missing fileData (base64 encoded file)' });
      }

      // Convert base64 to buffer
      // Remove data URL prefix if present (e.g., "data:image/png;base64,")
      const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
      const fileBuffer = Buffer.from(base64Data, 'base64');

      // Forward the request to Pinata API
      const authHeaders: Record<string, string> = {};
      if (PINATA_JWT) {
        authHeaders['Authorization'] = `Bearer ${PINATA_JWT}`;
      } else {
        authHeaders['pinata_api_key'] = PINATA_API_KEY;
        authHeaders['pinata_secret_api_key'] = PINATA_SECRET_KEY;
      }

      // Use node-fetch and form-data
      const fetch = (await import('node-fetch')).default;
      const FormData = (await import('form-data')).default;
      
      const pinataFormData = new FormData();
      pinataFormData.append('file', fileBuffer, {
        filename: filename || 'file',
        contentType: contentType || 'application/octet-stream',
      });

      if (metadata) {
        pinataFormData.append('pinataMetadata', JSON.stringify(metadata));
      }

      if (options) {
        pinataFormData.append('pinataOptions', JSON.stringify(options));
      }

      const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          ...authHeaders,
          ...pinataFormData.getHeaders(),
        },
        body: pinataFormData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Pinata API error:', errorText);
        return res.status(response.status).json({ 
          error: `Pinata API error: ${response.status} ${response.statusText}`,
          details: errorText 
        });
      }

      const result = await response.json();
      
      res.json({
        success: true,
        cid: result.IpfsHash,
        size: result.PinSize || fileBuffer.length,
        name: result.Name || filename || 'file',
      });
    } catch (error) {
      console.error('❌ Pinata proxy error:', error);
      res.status(500).json({ 
        error: 'Failed to upload to Pinata',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Pinata JSON upload proxy
  app.post('/api/pinata/upload-json', async (req, res) => {
    try {
      const PINATA_JWT = process.env.PINATA_JWT || process.env.VITE_PINATA_JWT || '';
      const PINATA_API_KEY = process.env.PINATA_API_KEY || process.env.VITE_PINATA_API_KEY || '';
      const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY || process.env.VITE_PINATA_SECRET_KEY || '';

      if (!PINATA_JWT && (!PINATA_API_KEY || !PINATA_SECRET_KEY)) {
        return res.status(500).json({ error: 'Pinata credentials not configured on server' });
      }

      const { jsonData, filename, metadata, options } = req.body;

      if (!jsonData) {
        return res.status(400).json({ error: 'Missing jsonData' });
      }

      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (PINATA_JWT) {
        authHeaders['Authorization'] = `Bearer ${PINATA_JWT}`;
      } else {
        authHeaders['pinata_api_key'] = PINATA_API_KEY;
        authHeaders['pinata_secret_api_key'] = PINATA_SECRET_KEY;
      }

      const pinataData: any = {
        pinataContent: jsonData,
      };

      if (metadata) {
        pinataData.pinataMetadata = metadata;
      }

      if (options) {
        pinataData.pinataOptions = options;
      }

      const fetch = (await import('node-fetch')).default;
      const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(pinataData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ 
          error: `Pinata API error: ${response.status}`,
          details: errorText 
        });
      }

      const result = await response.json();
      
      res.json({
        success: true,
        cid: result.IpfsHash,
        size: result.PinSize || 0,
      });
    } catch (error) {
      console.error('❌ Pinata JSON proxy error:', error);
      res.status(500).json({ 
        error: 'Failed to upload JSON to Pinata',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Placeholder image API
  app.get('/api/placeholder/:width/:height', async (req, res) => {
    try {
      const { width, height } = req.params;
      const { text, bg, color } = req.query;
      
      const w = parseInt(width) || 300;
      const h = parseInt(height) || 200;
      const placeholderText = (text as string) || `${w}x${h}`;
      const backgroundColor = (bg as string) || '6366f1';
      const textColor = (color as string) || 'ffffff';
      
      // Create SVG placeholder
      const svg = `
        <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#${backgroundColor}"/>
          <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="16" 
                fill="#${textColor}" text-anchor="middle" dominant-baseline="middle">
            ${placeholderText}
          </text>
        </svg>
      `;
      
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      res.send(svg);
    } catch (error) {
      console.error('Placeholder image error:', error);
      res.status(500).json({ error: 'Failed to generate placeholder image' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
