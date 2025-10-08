// Clear localStorage to fix wallet connection issues
console.log("🧹 Clearing localStorage to fix wallet connection...");

// Clear wallet-related localStorage items
localStorage.removeItem('wallet_connected');
localStorage.removeItem('wallet_public_key');

console.log("✅ localStorage cleared!");
console.log("🔄 Please refresh the page to test the wallet connection");

// Show current localStorage state
console.log("📋 Current localStorage:");
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  console.log(`   ${key}: ${localStorage.getItem(key)}`);
}