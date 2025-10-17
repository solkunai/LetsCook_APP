import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Polyfills for Node.js modules needed by Solana web3.js
import { Buffer } from 'buffer';
import process from 'process';

// Make Buffer available globally
window.Buffer = Buffer;

// Make process available globally
window.process = process;

// Additional polyfills for crypto and other Node.js modules
if (typeof global === 'undefined') {
  window.global = window;
}

createRoot(document.getElementById("root")!).render(<App />);
