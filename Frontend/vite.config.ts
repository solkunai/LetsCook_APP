import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { nodePolyfills } from "@esbuild-plugins/node-modules-polyfill";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    root: path.resolve(__dirname, "client"),
    plugins: [
      react(),
      runtimeErrorOverlay(),
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
      esbuildOptions: {
        plugins: [
          nodePolyfills({
            buffer: true,
            process: true,
          }),
        ],
      },
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
