import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Polyfill for Buffer
import { Buffer } from 'buffer';
window.Buffer = Buffer;

createRoot(document.getElementById("root")!).render(<App />);
