# Render Deployment Guide

This guide will help you deploy your Let's Cook application to Render.

## Prerequisites

1. A [Render account](https://render.com)
2. Your project pushed to a Git repository (GitHub, GitLab, or Bitbucket)
3. Environment variables ready (see below)

## Deployment Steps

### Option 1: Using render.yaml (Recommended)

1. **Push your code to Git**
   ```bash
   git add render.yaml
   git commit -m "Add Render deployment configuration"
   git push
   ```

2. **Connect your repository to Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Blueprint"
   - Connect your Git repository
   - Render will automatically detect the `render.yaml` file

3. **Set Environment Variables**
   In the Render dashboard, go to your service → Environment tab and add:
   
   **Required:**
   - `NODE_ENV=production` (already in render.yaml)
   - `PORT=10000` (already in render.yaml)
   
   **Optional but Recommended:**
   - `SOLANA_NETWORK` - Set to `mainnet-beta` or `devnet`
   - `PINATA_JWT` - Your Pinata JWT token for IPFS
   - `PINATA_API_KEY` - Your Pinata API key
   - `PINATA_SECRET_KEY` - Your Pinata secret key
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

4. **Deploy**
   - Render will automatically build and deploy your application
   - The build command runs: `cd Frontend && npm install && npm run build`
   - The start command runs: `cd Frontend && npm start`

### Option 2: Manual Setup

1. **Create a new Web Service**
   - Go to Render Dashboard → "New +" → "Web Service"
   - Connect your Git repository

2. **Configure the service:**
   - **Name:** lets-cook-frontend
   - **Environment:** Node
   - **Region:** Oregon (or your preferred region)
   - **Branch:** main (or your default branch)
   - **Root Directory:** (leave empty)
   - **Build Command:** `cd Frontend && npm install && npm run build`
   - **Start Command:** `cd Frontend && npm start`

3. **Set Environment Variables** (same as Option 1)

4. **Deploy**
   - Click "Create Web Service"
   - Render will build and deploy your application

## Environment Variables

### Required
- `NODE_ENV=production`
- `PORT=10000` (Render automatically sets this, but we specify it for clarity)

### Optional
- `SOLANA_NETWORK` - Network to use (`mainnet-beta` or `devnet`)
- `PINATA_JWT` - Pinata JWT for IPFS metadata storage
- `PINATA_API_KEY` - Pinata API key
- `PINATA_SECRET_KEY` - Pinata secret key
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

## Build Process

The deployment process:
1. Installs dependencies: `npm install` in the Frontend directory
2. Builds the application: `npm run build` (builds both client and server)
3. Starts the server: `npm start` (runs the Express server)

## Troubleshooting

### Build Fails
- Check that all dependencies are in `package.json`
- Verify Node.js version compatibility (Render uses Node 18+ by default)
- Check build logs in Render dashboard

### Application Won't Start
- Verify `PORT` environment variable is set (Render sets this automatically)
- Check that the build completed successfully
- Review server logs in Render dashboard

### Environment Variables Not Working
- Ensure variables are set in Render dashboard (not just in render.yaml)
- Variables marked with `sync: false` must be set manually in the dashboard
- Restart the service after adding new environment variables

## Custom Domain

To add a custom domain:
1. Go to your service in Render dashboard
2. Click "Settings" → "Custom Domains"
3. Add your domain and follow DNS configuration instructions

## Auto-Deploy

Render automatically deploys when you push to your connected branch. To disable:
1. Go to Settings → "Auto-Deploy"
2. Toggle off or change the branch

## Monitoring

- View logs in real-time in the Render dashboard
- Set up alerts for deployment failures
- Monitor service health and uptime

## Support

For Render-specific issues, check:
- [Render Documentation](https://render.com/docs)
- [Render Community](https://community.render.com)

