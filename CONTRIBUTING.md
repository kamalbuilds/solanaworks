# Contributing to SolanaWorks

Welcome to **SolanaWorks**! We're excited to have you contribute to building the future of mobile DePIN infrastructure. This guide will help you get started with contributing to our project.

## 🚀 Getting Started

### Prerequisites
- **Node.js 18+** and **Yarn**
- **Android Studio** and **Android SDK**
- **Solana CLI** and **Anchor**
- **Git** knowledge and **GitHub account**

### Development Setup
```bash
# Fork and clone the repository
git clone https://github.com/your-username/solanaworks.git
cd solanaworks

# Install dependencies
yarn install

# Copy environment configuration
cp .env.example .env
# Edit .env with your configuration

# Start development server
npx expo start --dev-client
```

## 📋 How to Contribute

### Types of Contributions
- **Bug Reports**: Help us identify and fix issues
- **Feature Requests**: Suggest new functionality
- **Code Contributions**: Implement features or fix bugs
- **Documentation**: Improve our guides and API docs
- **Testing**: Add tests and improve coverage
- **Security**: Report security vulnerabilities

### Reporting Issues
Before creating a new issue, please:
1. Search existing issues to avoid duplicates
2. Use our issue templates
3. Provide detailed reproduction steps
4. Include device information and logs

### Feature Requests
For new features:
1. Check our roadmap and existing feature requests
2. Create a detailed proposal with use cases
3. Include mockups or wireframes if applicable
4. Consider the mobile-first and DePIN-specific requirements

## 🔧 Development Workflow

### Branch Strategy
```bash
# Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# Create bug fix branch
git checkout -b fix/issue-description

# Create documentation branch
git checkout -b docs/documentation-improvement
```

### Coding Standards

#### TypeScript Guidelines
```typescript
// ✅ Good: Explicit types and interfaces
interface IDeviceMetrics {
  cpu: {
    usage: number;
    temperature: number;
  };
  memory: {
    available: number;
    total: number;
  };
}

// ✅ Good: Descriptive function names
async function collectDeviceMetrics(): Promise<IDeviceMetrics> {
  // Implementation
}

// ❌ Bad: Using 'any' type
function processData(data: any): any {
  // Avoid this pattern
}
```

#### React Native Best Practices
```typescript
// ✅ Good: Functional components with hooks
const DeviceMonitorScreen: React.FC = () => {
  const [metrics, setMetrics] = useState<IDeviceMetrics | null>(null);
  
  const deviceMonitor = useMemo(() => new DeviceMonitor(), []);
  
  useEffect(() => {
    deviceMonitor.startMonitoring();
    return () => deviceMonitor.stopMonitoring();
  }, [deviceMonitor]);
  
  return (
    <Screen>
      {/* Component content */}
    </Screen>
  );
};

// ✅ Good: Performance optimization
const ExpensiveComponent = React.memo<Props>(({ data }) => {
  const computedValue = useMemo(() => expensiveCalculation(data), [data]);
  
  return <View>{computedValue}</View>;
});
```

#### File Organization
```
src/
├── components/
│   ├── feature-name/
│   │   ├── feature-data-access.tsx    # Data layer
│   │   ├── feature-feature.tsx        # Business logic
│   │   └── feature-ui.tsx             # UI components
│   └── ui/
├── services/
│   ├── agents/
│   ├── p2p/
│   └── ServiceName.ts
├── utils/
└── types/
```

### Code Quality Requirements

#### Linting and Formatting
```bash
# Run before committing
yarn lint
yarn format
npx tsc --noEmit
```

#### Testing Requirements
```bash
# Unit tests (required for new features)
yarn test

# Integration tests
yarn test:integration

# Coverage threshold: 80% for new code
yarn test --coverage
```

#### Documentation Standards
```typescript
/**
 * Monitors device performance metrics in real-time
 * @example
 * ```typescript
 * const monitor = new DeviceMonitor();
 * await monitor.startMonitoring();
 * const metrics = monitor.getCurrentMetrics();
 * ```
 */
class DeviceMonitor {
  /**
   * Start collecting device metrics
   * @param config - Configuration options for monitoring
   * @returns Promise that resolves when monitoring starts
   * @throws {DeviceError} When device capabilities are insufficient
   */
  async startMonitoring(config?: IMonitorConfig): Promise<void> {
    // Implementation
  }
}
```

## 🧪 Testing Guidelines

### Test Structure
```typescript
// src/services/__tests__/DeviceMonitor.test.ts
describe('DeviceMonitor', () => {
  let deviceMonitor: DeviceMonitor;
  
  beforeEach(() => {
    deviceMonitor = new DeviceMonitor({
      updateInterval: 1000,
      enableThermalMonitoring: true
    });
  });
  
  afterEach(async () => {
    await deviceMonitor.stopMonitoring();
  });
  
  describe('startMonitoring', () => {
    it('should start collecting real device metrics', async () => {
      await deviceMonitor.startMonitoring();
      
      expect(deviceMonitor.isMonitoring()).toBe(true);
      
      const metrics = deviceMonitor.getCurrentMetrics();
      expect(metrics.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(metrics.cpu.usage).toBeLessThanOrEqual(100);
    });
    
    it('should handle monitoring errors gracefully', async () => {
      // Test error scenarios
    });
  });
});
```

### No Mock Data Policy
**Important**: All tests must use real device data and network connections. No mocks or simulations are allowed.

```typescript
// ✅ Good: Test with real device capabilities
it('should detect real device capabilities', async () => {
  const capabilities = await deviceMonitor.getDeviceCapabilities();
  
  expect(capabilities.processor.cores).toBeGreaterThan(0);
  expect(capabilities.memory.totalRAM).toBeGreaterThan(0);
});

// ❌ Bad: Using mock data
it('should process metrics', () => {
  const mockMetrics = { cpu: { usage: 50 } }; // Don't do this
});
```

## 📝 Pull Request Process

### Before Submitting
1. **Test Thoroughly**: Ensure all tests pass
2. **Update Documentation**: Include relevant documentation updates
3. **Follow Commit Convention**: Use conventional commit messages
4. **Check Dependencies**: Ensure no unnecessary dependencies added

### Commit Message Format
```bash
# Format: type(scope): description
feat(p2p): add DHT-based task distribution
fix(device): resolve memory leak in monitoring service
docs(api): update DeviceMonitor documentation
test(network): add integration tests for WebRTC connections
```

### Pull Request Template
When creating a PR, include:
- **Description**: Clear description of changes
- **Type**: Bug fix, feature, documentation, etc.
- **Testing**: How you tested the changes
- **Screenshots**: For UI changes
- **Breaking Changes**: Any breaking changes
- **Related Issues**: Link to related issues

### Review Process
1. **Automated Checks**: CI/CD pipeline must pass
2. **Code Review**: At least one maintainer review required
3. **Testing**: Manual testing on real devices
4. **Security Review**: For security-sensitive changes
5. **Documentation Review**: For user-facing changes

## 🔒 Security Guidelines

### Reporting Security Issues
**Do NOT create public issues for security vulnerabilities.**

Instead:
1. Email security@solanaworks.io
2. Include detailed description and reproduction steps
3. Wait for acknowledgment before public disclosure

### Security Best Practices
- Never commit private keys or secrets
- Use Mobile Wallet Adapter for all blockchain operations
- Validate all inputs and external data
- Use TweetNaCl for cryptographic operations
- Follow secure coding practices

## 📊 Performance Guidelines

### Mobile Performance Requirements
- **Battery Efficiency**: Minimize background processing
- **Memory Usage**: Keep memory footprint under 100MB
- **CPU Usage**: Average CPU usage under 10%
- **Network Efficiency**: Batch operations and compress data

### Benchmarking
```bash
# Performance testing
yarn test:performance

# Bundle size analysis
npx expo bundle-analyzer

# Memory profiling
npx react-native profile
```

## 🏗️ Architecture Considerations

### DePIN-Specific Requirements
- **Real Device Integration**: All features must work with actual device hardware
- **P2P Networking**: Use WebRTC for peer-to-peer communication
- **Blockchain Integration**: Solana-native with Mobile Wallet Adapter
- **AI Optimization**: Integrate Solana Agent Kit for intelligent decisions

### Design Patterns
- **Event-Driven Architecture**: Use EventEmitter for cross-component communication
- **Service Layer**: Separate business logic from UI components
- **Error Boundaries**: Comprehensive error handling and recovery
- **Type Safety**: Strong TypeScript typing throughout

## 📚 Resources

### Documentation
- **Architecture Guide**: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **API Reference**: [docs/API.md](./docs/API.md)
- **Deployment Guide**: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)

### External Resources
- **React Native**: [reactnative.dev](https://reactnative.dev/)
- **Solana Mobile**: [docs.solanamobile.com](https://docs.solanamobile.com/)
- **Anchor**: [anchor-lang.com](https://anchor-lang.com/)
- **Expo**: [docs.expo.dev](https://docs.expo.dev/)

### Community
- **Discord**: [Join our community](https://discord.gg/solanaworks)
- **Twitter**: [@SolanaWorks](https://twitter.com/solanaworks)
- **GitHub Discussions**: Use for questions and feature discussions

## 🎯 Development Focus Areas

### Current Priorities
1. **Token Economics Implementation** (Phase 5)
2. **Performance Optimization**
3. **Security Enhancements**
4. **Documentation Improvements**
5. **Test Coverage Expansion**

### Future Roadmap
- Multi-platform support (iOS)
- Advanced AI capabilities
- Cross-chain integration
- Enterprise features

## 💡 Tips for New Contributors

### Getting Familiar
1. **Read the README**: Understand the project goals
2. **Study the Architecture**: Review architecture documentation
3. **Run the App**: Get hands-on experience with the application
4. **Look at Recent PRs**: See examples of good contributions
5. **Start Small**: Begin with documentation or bug fixes

### Best Practices
- **Ask Questions**: Use GitHub Discussions for clarification
- **Be Patient**: Reviews may take time due to security considerations
- **Test on Real Devices**: Always test on actual Android devices
- **Follow Standards**: Adhere to our coding and documentation standards
- **Stay Updated**: Keep your fork synchronized with main branch

Thank you for contributing to SolanaWorks! Together, we're building the future of mobile decentralized infrastructure. 🚀

---

**Questions?** Join our [Discord community](https://discord.gg/solanaworks) or create a GitHub Discussion. 