// IPFS Image Testing Utility
// Add this to browser console to test IPFS URLs

function testIPFSImage(ipfsHash) {
  const gateways = [
    `https://ipfs.io/ipfs/${ipfsHash}`,
    `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
    `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,
    `https://dweb.link/ipfs/${ipfsHash}`
  ];
  
  console.log(`🧪 Testing IPFS hash: ${ipfsHash}`);
  
  gateways.forEach((url, index) => {
    const img = new Image();
    img.onload = () => console.log(`✅ Gateway ${index + 1} works: ${url}`);
    img.onerror = () => console.log(`❌ Gateway ${index + 1} failed: ${url}`);
    img.src = url;
  });
}

// Usage: testIPFSImage('bafkreibbhjakwodif4dvicltspz7xawyf6jbuhawph7k6o2f5ogcr3ztoi')