# Let's Cook 🍳

> **The Safest Launches in Crypto** - A fair token distribution platform built on Solana

Let's Cook is a revolutionary token launch platform that democratizes crypto token distribution through raffle-based mechanics, ensuring fair launches without dev dumps. Built on Solana with a chef-themed gamification system.

## 🌟 Features

### 🎫 Fair Token Launches
- **Raffle-based Distribution**: Buy tickets for token allocations
- **No Dev Dumps**: Transparent, fair launch process
- **Multiple Launch Types**: Standard, instant, and collection launches
- **Random Selection**: Uses Orao VRF for provably fair winner selection

### 💰 Complete Trading Ecosystem
- **Built-in AMM**: Custom Cook AMM + Raydium integration
- **Token Swapping**: SOL ↔ Token and Token ↔ Token swaps
- **Liquidity Provision**: Automatic market making after launch
- **Price Discovery**: Real-time price feeds and charts

### 🎮 Gamification System
- **Sauce Points**: Earn rewards through referrals and trading
- **Badge Progression**: "Spicy Starter" → "Master Chef" tiers
- **Leaderboards**: Compete with other users
- **Achievement System**: Unlock rewards for milestones
- **Referral Program**: Earn points for bringing new users

### 🖼️ NFT Collections
- **Collection Launches**: Launch NFT collections with metadata
- **NFT Trading**: Buy, sell, and list NFTs
- **Metadata Support**: Rich NFT metadata and attributes
- **Collection Management**: Full lifecycle NFT management

## 🏗️ Architecture

### Frontend Stack
- **React 18** with TypeScript
- **Vite** for build tooling and development
- **Tailwind CSS** with custom "moonshot" theme
- **Wouter** for client-side routing
- **TanStack Query** for state management
- **Radix UI** for accessible components
- **Express.js** server for API endpoints

### Backend Stack
- **Rust** Solana program
- **Solana Program Library** integration
- **Orao VRF** for randomness
- **SPL Token** standards
- **MPL Core** for NFT support
- **Custom AMM** implementation

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Rust 1.70+
- Solana CLI tools
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd lets-cook
   ```

2. **Install Frontend Dependencies**
   ```bash
   cd Frontend
   npm install
   ```

3. **Install Backend Dependencies**
   ```bash
   cd Backend/program
   cargo build
   ```

### Development

1. **Start Frontend Development Server**
   ```bash
   cd Frontend
   npm run dev
   ```

2. **Build Solana Program**
   ```bash
   cd Backend/program
   cargo build-bpf
   ```

3. **Deploy Program** (to devnet)
   ```bash
   solana program deploy target/deploy/lets_cook.so --url devnet
   ```

## 📱 User Journey

### 1. Onboarding
- Connect wallet (Phantom, Solflare, etc.)
- Create username
- Opt into referral program
- Complete chef-themed tutorial

### 2. Browse & Participate
- View active token launches
- Check ticket prices and odds
- Purchase tickets for desired allocations
- Track your ticket status

### 3. Results & Claims
- Wait for random selection results
- Claim tokens if you win
- Receive refunds if you don't win
- View transaction history

### 4. Trade & Earn
- Swap tokens on integrated AMM
- Provide liquidity for rewards
- Earn Sauce Points through trading
- Refer friends for bonus points

## 🎨 Design System

### Color Palette
- **Space Navy**: `240 30% 8%` - Deep space backgrounds
- **Golden Moon**: `45 100% 60%` - Primary accent (success, "to the moon")
- **Purple Nebula**: `265 85% 65%` - Secondary accent (cosmic vibes)
- **Cyan Stars**: `200 100% 55%` - Tertiary accent (highlights)

### Typography
- **Headings**: Space Grotesk (Bold 700) - Tech/cyberpunk aesthetic
- **Body**: Inter (Regular 400, Medium 500) - Clean readability

### Components
- Mobile-first responsive design
- Chef-themed illustrations and animations
- Confetti celebrations for achievements
- Smooth micro-interactions

## 🔧 Technical Details

### Solana Program Features
- **30+ Instructions**: Comprehensive functionality
- **Transfer Hooks**: Additional transfer logic
- **Multi-token Support**: SPL Token 2022 compatibility
- **AMM Integration**: Custom + Raydium support
- **NFT Support**: MPL Core integration
- **Randomness**: Orao VRF integration

### Smart Contract Security
- **Program ID**: `Cook7kyoaKaiG57VBDUjE2KuPXrWdLEu7d3FdDgsijHU`
- **Account Validation**: Comprehensive account checks
- **Error Handling**: Detailed error messages
- **Upgrade Authority**: Controlled program upgrades

## 📊 Key Metrics

- **100% Fair Launch**: No dev token allocations
- **5K+ Active Users**: Growing community
- **Multiple AMM Support**: Raydium + Custom Cook AMM
- **NFT Collections**: Full metadata support
- **Referral System**: Active user acquisition

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Development Guidelines
- Follow Rust best practices for the Solana program
- Use TypeScript strict mode for frontend code
- Follow the established design system
- Write comprehensive tests
- Document new features

## 📄 License

This project is licensed under the WTFPL License - see the [LICENSE](Backend/program/LICENSE) file for details.


## 🙏 Acknowledgments

- Solana Foundation for the amazing blockchain
- Orao Network for VRF services
- Raydium for AMM integration
- MPL Core for NFT standards
- The entire Solana ecosystem

---

**Built with ❤️ by the Let's Cook team**

*"Let's heat up this raffle!" 🔥*
