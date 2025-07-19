# SolanaWorks Deployment Guide

## Quick Start

### Prerequisites
- Node.js 18+, Yarn, Android Studio
- Solana CLI, Anchor CLI, Rust
- Expo CLI and EAS CLI

### Environment Setup
```bash
git clone https://github.com/kamalbuilds/solanaworks.git
cd solanaworks
yarn install
cp .env.example .env
# Configure environment variables
```

### Key Environment Variables
```bash
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
OPENAI_API_KEY=your_openai_api_key
STUN_SERVERS=stun:stun.l.google.com:19302
SENTRY_DSN=your_sentry_dsn
```

## Development Deployment

### Local Development
```bash
# Start development server
npx expo start --dev-client

# Run on Android
npx expo run:android

# Run tests
yarn test
npx tsc --noEmit
yarn lint
```

### Smart Contract Development
```bash
cd programs/solmobile-compute
anchor build
anchor deploy --provider.cluster devnet
```

## Staging Deployment

### Build Configuration
```bash
# Create preview build
eas build --profile preview --platform android

# Deploy to internal testing
eas submit --profile preview --platform android
```

### Testing
```bash
ENVIRONMENT=staging yarn test:integration
ENVIRONMENT=staging yarn test:p2p
```

## Production Deployment

### Pre-Production Checklist
- [ ] All tests passing
- [ ] Security audit completed
- [ ] Smart contracts audited
- [ ] Monitoring setup verified

### Production Build
```bash
# Deploy smart contracts to mainnet
anchor deploy --provider.cluster mainnet-beta

# Build production app
eas build --profile production --platform android

# Submit to Play Store
eas submit --profile production --platform android
```

### Infrastructure
- STUN/TURN servers for WebRTC
- Monitoring stack (Prometheus, Grafana)
- Load balancers for high availability
- SSL certificates for security

## Monitoring

### Key Metrics
- Device registration rate
- Task completion rate
- Network health score
- P2P connection success rate
- Blockchain transaction success rate

### Error Tracking
```typescript
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});
```

## Security

### Production Security
- SSL/TLS certificates
- Environment variables secured
- API rate limiting
- Input validation
- No hardcoded secrets
- Mobile Wallet Adapter for transactions

## Troubleshooting

### Common Issues
```bash
# Clear caches
npx expo start --clear
expo r -c

# Android issues
cd android && ./gradlew clean && cd ..
adb kill-server && adb start-server

# Network debugging
# Test STUN/TURN connectivity
# Check WebRTC connections
```

For detailed deployment procedures, see the full documentation at [docs.solanaworks.io](https://docs.solanaworks.io). 