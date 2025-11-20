// Polyfills for Node.js modules needed by Solana web3.js - MUST be first
import { Buffer } from 'buffer';
import process from 'process';

// Make Buffer available globally BEFORE anything else
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
  (window as any).process = process;
  if (typeof (window as any).global === 'undefined') {
    (window as any).global = window;
  }
}

// Also set on globalThis for compatibility
if (typeof globalThis !== 'undefined') {
  (globalThis as any).Buffer = Buffer;
  (globalThis as any).process = process;
}

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
