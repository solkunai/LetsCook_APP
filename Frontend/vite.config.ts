import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { bufferPolyfillPlugin } from "./vite-plugin-buffer-polyfill";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    root: path.resolve(__dirname, "client"),
    plugins: [
      react(),
      runtimeErrorOverlay(),
      bufferPolyfillPlugin(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "client/src"),
        "@shared": path.resolve(__dirname, "shared"),
        "@assets": path.resolve(__dirname, "attached_assets"),
        buffer: "buffer", // Polyfill for Buffer
      },
    },
    define: {
      global: "globalThis",
      "process.env": env,
      "process.env.NODE_ENV": JSON.stringify(mode),
      "process.browser": true,
    },
    optimizeDeps: {
      include: ["buffer", "process", "@solana/web3.js"],
    },
    build: {
      outDir: path.resolve(__dirname, "dist/public"),
      emptyOutDir: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
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
