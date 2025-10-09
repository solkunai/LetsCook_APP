# Convert wallet array to proper format for GitHub Secrets

# Your wallet array (comma-separated numbers)
WALLET_ARRAY="215,159,206,0,188,230,231,71,252,241,245,16,249,8,201,110,122,47,55,1,34,32,101,128,201,40,61,177,60,167,235,222,173,87,200,72,215,53,132,52,131,227,231,45,17,154,79,172,92,92,144,121,83,103,182,111,52,117,101,42,245,222,238"

echo "Converting wallet array to different formats..."
echo ""

# Method 1: Convert to JSON array format
echo "Method 1: JSON Array Format (for GitHub Secret)"
echo "[$WALLET_ARRAY]" | base64 -w 0
echo ""

# Method 2: Convert to hex format
echo "Method 2: Hex Format"
echo "[$WALLET_ARRAY]" | xxd -p -c 256
echo ""

# Method 3: Direct array format (what you currently have)
echo "Method 3: Direct Array Format (current)"
echo "$WALLET_ARRAY"
echo ""

echo "For GitHub Secrets, use Method 1 (base64 encoded JSON array)"
echo "Copy the base64 string above and use it as your SOLANA_WALLET_KEY secret"