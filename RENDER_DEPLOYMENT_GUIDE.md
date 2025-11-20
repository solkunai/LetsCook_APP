# Render Deployment Guide

This guide will help you deploy your Let's Cook application to Render.

## Prerequisites

1. A [Render account](https://render.com)
2. Your project pushed to a Git repository (GitHub, GitLab, or Bitbucket)
3. Environment variables ready (see below)

## Deployment Steps

### Manual Setup (Web Service - Free Tier)

1. **Create a new Web Service**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect your Git repository (`solkunai/LetsCook_APP`)

2. **Configure the service:**
   - **Name:** lets-cook-frontend
   - **Environment:** Node
   - **Region:** Oregon (or your preferred region)
   - **Branch:** main (or your default branch)
   - **Root Directory:** (leave empty)
   - **Build Command:** `cd Frontend && chmod +x build.sh && bash build.sh`
   - **Start Command:** `cd Frontend && npm start`

3. **Set Environment Variables**
   In the Render dashboard, go to your service → Environment tab and add:
   
   **Required:**
   - `NODE_ENV=production`
   - `PORT=10000` (Render automatically sets PORT, but we specify for clarity)
   
   **Optional but Recommended:**
   - `SOLANA_NETWORK` - Set to `mainnet-beta` or `devnet`
   - `PINATA_JWT` - Your Pinata JWT token for IPFS
   - `PINATA_API_KEY` - Your Pinata API key
   - `PINATA_SECRET_KEY` - Your Pinata secret key
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

4. **Deploy**
   - Click "Create Web Service"
   - Render will build and deploy your application
   - The build script ensures devDependencies (like `vite`) are installed

### Option 2: Using Blueprint (Requires Render Pro)

If you have Render Pro, you can use the `render.yaml` file:
1. Go to Render Dashboard → "New +" → "Blueprint"
2. Connect your Git repository
3. Render will automatically detect and use the `render.yaml` file

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
1. Runs the build script: `Frontend/build.sh` which:
   - Unsets NODE_ENV to ensure devDependencies are installed
   - Installs all dependencies (including devDependencies like `vite` and `esbuild`)
   - Builds the application: `npm run build` (builds both client and server)
2. Starts the server: `npm start` (runs the Express server from `dist/index.js`)

## Troubleshooting

### Build Fails with "vite: not found"
- **Solution:** Make sure your Build Command is: `cd Frontend && chmod +x build.sh && bash build.sh`
- The build script ensures devDependencies are installed by unsetting NODE_ENV during `npm install`
- If you're using a different build command, ensure it installs devDependencies

### Build Fails (General)
- Check that all dependencies are in `package.json`
- Verify Node.js version compatibility (Render uses Node 18+ by default)
- Check build logs in Render dashboard
- Ensure the build script has execute permissions (handled by `chmod +x build.sh`)

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

