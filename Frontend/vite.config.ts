import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(async ({ mode }) => {
  // Load environment variables from .env files
  const env = loadEnv(mode, process.cwd(), '');
  
  // Debug: Log environment variables
  console.log('🔍 Vite config loading env vars:', {
    mode,
    VITE_MAIN_PROGRAM_ID: env.VITE_MAIN_PROGRAM_ID,
    allViteVars: Object.keys(env).filter(key => key.startsWith('VITE_'))
  });
  
  return {
  plugins: [
    react(),
    runtimeErrorOverlay(),
    // Add Buffer polyfill
    {
      name: 'buffer-polyfill',
      configResolved(config) {
        config.define = config.define || {};
        config.define.global = 'globalThis';
      }
    },
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  define: {
    global: 'globalThis',
    'process.env': env, // Ensure process.env is defined for Vite
    'process.env.NODE_ENV': JSON.stringify(mode),
    'process.browser': true,
  },
  optimizeDeps: {
    include: [
      'buffer',
      'process',
      '@solana/web3.js',
      '@solana/wallet-adapter-base',
      '@solana/wallet-adapter-react',
      '@solana/wallet-adapter-react-ui',
      '@solana/wallet-adapter-wallets',
    ],
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      external: [],
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  };
});