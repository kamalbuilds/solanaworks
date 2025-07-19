# SolanaWorks API Reference

## Table of Contents
- [Core Services API](#core-services-api)
- [Device Monitoring API](#device-monitoring-api)
- [P2P Network API](#p2p-network-api)
- [AI Agent API](#ai-agent-api)
- [Blockchain Integration API](#blockchain-integration-api)
- [Types and Interfaces](#types-and-interfaces)
- [Error Handling](#error-handling)

---

## Core Services API

### DeviceMonitor

The `DeviceMonitor` service provides real-time device metrics and performance monitoring.

```typescript
import { DeviceMonitor } from '../services/DeviceMonitor';

class DeviceMonitor extends EventEmitter {
  /**
   * Initialize device monitoring with configuration
   * @param config - Monitoring configuration options
   */
  constructor(config: IDeviceMonitorConfig);

  /**
   * Start monitoring device metrics
   * @returns Promise that resolves when monitoring starts
   */
  async startMonitoring(): Promise<void>;

  /**
   * Stop monitoring device metrics
   * @returns Promise that resolves when monitoring stops
   */
  async stopMonitoring(): Promise<void>;

  /**
   * Get current device metrics snapshot
   * @returns Current device metrics
   */
  getCurrentMetrics(): IDeviceMetrics;

  /**
   * Get device capabilities and specifications
   * @returns Device capability information
   */
  getDeviceCapabilities(): IDeviceCapabilities;

  /**
   * Check if device meets minimum requirements
   * @param requirements - Minimum requirements to check
   * @returns Boolean indicating if requirements are met
   */
  meetsRequirements(requirements: IMinimumRequirements): boolean;
}
```

**Usage Example:**
```typescript
const monitor = new DeviceMonitor({
  updateInterval: 5000,
  enableThermalMonitoring: true,
  enableNetworkMonitoring: true
});

monitor.on('metrics', (metrics: IDeviceMetrics) => {
  console.log('CPU Usage:', metrics.cpu.usage);
  console.log('Memory Available:', metrics.memory.available);
});

await monitor.startMonitoring();
```

### PerformanceAnalytics

Advanced analytics service for historical performance analysis and optimization.

```typescript
import { PerformanceAnalytics } from '../services/PerformanceAnalytics';

class PerformanceAnalytics {
  /**
   * Analyze performance trends over time period
   * @param timeframe - Time period for analysis
   * @returns Performance trend analysis
   */
  async analyzeTrends(timeframe: ITimeframe): Promise<ITrendAnalysis>;

  /**
   * Generate performance optimization recommendations
   * @param metrics - Current device metrics
   * @returns Optimization recommendations
   */
  generateRecommendations(metrics: IDeviceMetrics): IOptimizationRecommendation[];

  /**
   * Calculate device performance score
   * @param metrics - Device metrics to analyze
   * @returns Performance score (0-100)
   */
  calculatePerformanceScore(metrics: IDeviceMetrics): number;

  /**
   * Predict future performance based on trends
   * @param lookAhead - Prediction time horizon
   * @returns Performance predictions
   */
  predictPerformance(lookAhead: number): IPerformancePrediction;
}
```

---

## Device Monitoring API

### IDeviceMetrics Interface

```typescript
interface IDeviceMetrics {
  timestamp: number;
  
  cpu: {
    usage: number;              // Percentage (0-100)
    temperature: number;        // Celsius
    frequency: number;          // MHz
    cores: number;             // Number of cores
  };
  
  memory: {
    total: number;             // MB
    available: number;         // MB
    used: number;              // MB
    percentage: number;        // Percentage (0-100)
  };
  
  storage: {
    total: number;             // GB
    available: number;         // GB
    used: number;              // GB
    percentage: number;        // Percentage (0-100)
  };
  
  network: {
    type: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
    strength: number;          // Signal strength (0-100)
    speed: {
      download: number;        // Mbps
      upload: number;          // Mbps
      ping: number;            // ms
    };
  };
  
  battery: {
    level: number;             // Percentage (0-100)
    isCharging: boolean;
    health: 'good' | 'fair' | 'poor';
    temperature: number;       // Celsius
  };
  
  thermal: {
    status: 'normal' | 'fair' | 'serious' | 'critical';
    temperature: number;       // Device temperature
  };
}
```

### Device Capabilities API

```typescript
interface IDeviceCapabilities {
  processor: {
    architecture: string;      // ARM64, x86_64, etc.
    cores: number;
    maxFrequency: number;      // MHz
    supportedInstructions: string[];
  };
  
  memory: {
    totalRAM: number;          // MB
    availableRAM: number;      // MB
  };
  
  storage: {
    totalStorage: number;      // GB
    storageType: 'flash' | 'emmc' | 'ufs';
  };
  
  graphics: {
    gpu: string;
    memorySize: number;        // MB
    maxResolution: {
      width: number;
      height: number;
    };
  };
  
  connectivity: {
    wifi: boolean;
    cellular: boolean;
    bluetooth: boolean;
    nfc: boolean;
  };
  
  sensors: {
    accelerometer: boolean;
    gyroscope: boolean;
    magnetometer: boolean;
    gps: boolean;
  };
  
  platform: {
    os: 'android' | 'ios';
    version: string;
    apiLevel: number;
  };
}
```

---

## P2P Network API

### P2POrchestrator

Main orchestrator for P2P network operations.

```typescript
import { P2POrchestrator } from '../services/p2p/P2POrchestrator';

class P2POrchestrator extends EventEmitter {
  /**
   * Initialize P2P network orchestrator
   * @param config - Network configuration
   */
  constructor(config: IP2PConfig);

  /**
   * Start P2P network operations
   * @returns Promise that resolves when network is ready
   */
  async startNetwork(): Promise<void>;

  /**
   * Stop P2P network operations
   * @returns Promise that resolves when network is stopped
   */
  async stopNetwork(): Promise<void>;

  /**
   * Submit a task to the network
   * @param task - Task to be submitted
   * @returns Promise that resolves with task ID
   */
  async submitTask(task: ITask): Promise<string>;

  /**
   * Get network status and health metrics
   * @returns Current network status
   */
  getNetworkStatus(): INetworkStatus;

  /**
   * Get connected peers information
   * @returns Array of connected peer information
   */
  getConnectedPeers(): IPeerInfo[];

  /**
   * Trigger network optimization
   * @returns Promise that resolves when optimization completes
   */
  async optimizeNetwork(): Promise<void>;
}
```

### Task Management API

```typescript
interface ITask {
  id: string;
  type: 'compute' | 'ai' | 'storage' | 'verification';
  priority: 'low' | 'medium' | 'high' | 'critical';
  payload: any;
  requirements: {
    minCpuCores: number;
    minMemoryMB: number;
    maxExecutionTimeMs: number;
    requiredCapabilities: string[];
  };
  reward: {
    amount: number;
    token: string;
  };
  deadline: number;           // Unix timestamp
  submitter: string;          // Peer ID
}

interface ITaskResult {
  taskId: string;
  result: any;
  executionTime: number;      // ms
  executor: string;           // Peer ID
  verifiers: string[];        // Verifier peer IDs
  confidence: number;         // 0-1
  signature: string;          // Cryptographic signature
}
```

### Network Health API

```typescript
interface INetworkStatus {
  isConnected: boolean;
  nodeCount: number;
  activeTasks: number;
  completedTasks: number;
  networkHealth: 'excellent' | 'good' | 'fair' | 'poor';
  
  performance: {
    averageLatency: number;    // ms
    throughput: number;        // tasks/hour
    successRate: number;       // percentage
    uptime: number;            // percentage
  };
  
  resources: {
    availableCompute: number;  // percentage
    networkBandwidth: number;  // Mbps
    storageAvailable: number;  // GB
  };
  
  security: {
    threatLevel: 'low' | 'medium' | 'high';
    maliciousNodes: number;
    blockedConnections: number;
  };
}
```

---

## AI Agent API

### ResourceOptimizationAgent

AI-powered resource optimization service.

```typescript
import { ResourceOptimizationAgent } from '../services/agents/ResourceOptimizationAgent';

class ResourceOptimizationAgent {
  /**
   * Initialize the optimization agent
   * @param config - Agent configuration
   */
  constructor(config: IAgentConfig);

  /**
   * Analyze current system state and generate optimization decisions
   * @param state - Current system state
   * @returns Optimization decisions
   */
  async optimizeResources(state: ISystemState): Promise<IOptimizationDecision[]>;

  /**
   * Evaluate task acceptance based on current device state
   * @param task - Task to evaluate
   * @param deviceState - Current device metrics
   * @returns Decision on whether to accept the task
   */
  async evaluateTaskAcceptance(
    task: ITask, 
    deviceState: IDeviceMetrics
  ): Promise<ITaskDecision>;

  /**
   * Generate network optimization recommendations
   * @param networkState - Current network state
   * @returns Network optimization suggestions
   */
  async optimizeNetwork(networkState: INetworkStatus): Promise<INetworkOptimization>;

  /**
   * Learn from task execution outcomes
   * @param taskResult - Completed task result
   * @param performance - Performance metrics
   */
  async learnFromExecution(
    taskResult: ITaskResult, 
    performance: IPerformanceMetrics
  ): Promise<void>;
}
```

### TaskManagementAgent

AI-powered task management and scheduling.

```typescript
class TaskManagementAgent {
  /**
   * Intelligently schedule tasks based on device capabilities and network state
   * @param tasks - Array of pending tasks
   * @param deviceState - Current device state
   * @returns Optimized task schedule
   */
  async scheduleTasks(
    tasks: ITask[], 
    deviceState: IDeviceMetrics
  ): Promise<ITaskSchedule>;

  /**
   * Predict optimal task execution time
   * @param task - Task to analyze
   * @param deviceCapabilities - Device capabilities
   * @returns Execution time prediction
   */
  async predictExecutionTime(
    task: ITask, 
    deviceCapabilities: IDeviceCapabilities
  ): Promise<number>;

  /**
   * Optimize task priority based on rewards and device state
   * @param tasks - Tasks to prioritize
   * @param context - Current execution context
   * @returns Prioritized task list
   */
  async prioritizeTasks(
    tasks: ITask[], 
    context: IExecutionContext
  ): Promise<ITask[]>;
}
```

---

## Blockchain Integration API

### Solana Program Integration

```typescript
interface ISolanaProgram {
  /**
   * Register device on the blockchain
   * @param deviceInfo - Device information
   * @param capabilities - Device capabilities
   * @returns Transaction signature
   */
  registerDevice(
    deviceInfo: IDeviceRegistration, 
    capabilities: IDeviceCapabilities
  ): Promise<string>;

  /**
   * Submit task completion to blockchain
   * @param taskResult - Task execution result
   * @returns Transaction signature
   */
  submitTaskCompletion(taskResult: ITaskResult): Promise<string>;

  /**
   * Claim rewards for completed tasks
   * @param taskIds - Array of completed task IDs
   * @returns Transaction signature
   */
  claimRewards(taskIds: string[]): Promise<string>;

  /**
   * Update device performance metrics on-chain
   * @param metrics - Performance metrics
   * @returns Transaction signature
   */
  updatePerformanceMetrics(metrics: IPerformanceMetrics): Promise<string>;

  /**
   * Get device reputation score from blockchain
   * @param deviceAddress - Device public key
   * @returns Reputation score
   */
  getDeviceReputation(deviceAddress: string): Promise<number>;
}
```

### Mobile Wallet Adapter Integration

```typescript
interface IMobileWalletAdapter {
  /**
   * Connect to mobile wallet
   * @returns Promise that resolves with wallet connection
   */
  connect(): Promise<IWalletConnection>;

  /**
   * Sign a transaction using mobile wallet
   * @param transaction - Transaction to sign
   * @returns Signed transaction
   */
  signTransaction(transaction: Transaction): Promise<Transaction>;

  /**
   * Sign multiple transactions
   * @param transactions - Array of transactions to sign
   * @returns Array of signed transactions
   */
  signAllTransactions(transactions: Transaction[]): Promise<Transaction[]>;

  /**
   * Get connected wallet public key
   * @returns Wallet public key
   */
  getPublicKey(): Promise<PublicKey>;

  /**
   * Disconnect from wallet
   * @returns Promise that resolves when disconnected
   */
  disconnect(): Promise<void>;
}
```

---

## Types and Interfaces

### Configuration Types

```typescript
interface IDeviceMonitorConfig {
  updateInterval: number;        // ms
  enableThermalMonitoring: boolean;
  enableNetworkMonitoring: boolean;
  enableBatteryOptimization: boolean;
  thresholds: {
    cpuUsage: number;           // percentage
    memoryUsage: number;        // percentage
    temperature: number;        // celsius
  };
}

interface IP2PConfig {
  maxConnections: number;
  discoveryInterval: number;     // ms
  heartbeatInterval: number;     // ms
  taskTimeout: number;          // ms
  verificationThreshold: number; // percentage
  enableEncryption: boolean;
  stunServers: string[];
  turnServers: string[];
}

interface IAgentConfig {
  model: string;                // AI model to use
  apiKey?: string;              // API key for external services
  learningRate: number;
  optimizationInterval: number; // ms
  decisionThreshold: number;    // confidence threshold
}
```

### Event Types

```typescript
// Device Events
interface IDeviceMetricsEvent {
  type: 'device:metrics';
  payload: IDeviceMetrics;
  timestamp: number;
}

interface IThresholdAlert {
  type: 'device:threshold';
  metric: 'cpu' | 'memory' | 'temperature' | 'battery';
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  timestamp: number;
}

// Network Events
interface IPeerConnectedEvent {
  type: 'peer:connected';
  peer: IPeerInfo;
  timestamp: number;
}

interface ITaskAssignedEvent {
  type: 'task:assigned';
  task: ITask;
  assignedTo: string;
  timestamp: number;
}

// Blockchain Events
interface ITransactionConfirmedEvent {
  type: 'transaction:confirmed';
  signature: string;
  status: 'success' | 'failed';
  timestamp: number;
}
```

---

## Error Handling

### Error Types

```typescript
// Base error class
abstract class SolanaWorksError extends Error {
  abstract readonly code: string;
  abstract readonly category: string;
  
  constructor(message: string, public readonly context?: any) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Device-related errors
class DeviceError extends SolanaWorksError {
  readonly category = 'device';
  
  static readonly CODES = {
    MONITORING_FAILED: 'DEVICE_001',
    INSUFFICIENT_RESOURCES: 'DEVICE_002',
    HARDWARE_FAULT: 'DEVICE_003',
    THERMAL_LIMIT: 'DEVICE_004'
  } as const;
  
  constructor(
    public readonly code: keyof typeof DeviceError.CODES,
    message: string,
    context?: any
  ) {
    super(message, context);
  }
}

// Network-related errors
class NetworkError extends SolanaWorksError {
  readonly category = 'network';
  
  static readonly CODES = {
    CONNECTION_FAILED: 'NETWORK_001',
    PEER_UNREACHABLE: 'NETWORK_002',
    TASK_TIMEOUT: 'NETWORK_003',
    VERIFICATION_FAILED: 'NETWORK_004'
  } as const;
  
  constructor(
    public readonly code: keyof typeof NetworkError.CODES,
    message: string,
    context?: any
  ) {
    super(message, context);
  }
}

// Blockchain-related errors
class BlockchainError extends SolanaWorksError {
  readonly category = 'blockchain';
  
  static readonly CODES = {
    TRANSACTION_FAILED: 'BLOCKCHAIN_001',
    INSUFFICIENT_FUNDS: 'BLOCKCHAIN_002',
    WALLET_DISCONNECTED: 'BLOCKCHAIN_003',
    PROGRAM_ERROR: 'BLOCKCHAIN_004'
  } as const;
  
  constructor(
    public readonly code: keyof typeof BlockchainError.CODES,
    message: string,
    public readonly txHash?: string,
    context?: any
  ) {
    super(message, context);
  }
}
```

### Error Handling Patterns

```typescript
// Error boundary for React components
class SolanaWorksErrorBoundary extends React.Component<
  IErrorBoundaryProps, 
  IErrorBoundaryState
> {
  constructor(props: IErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error: Error): IErrorBoundaryState {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to analytics service
    this.logError(error, errorInfo);
  }
  
  private logError(error: Error, errorInfo: ErrorInfo) {
    // Implementation for error logging
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallbackComponent error={this.state.error} />;
    }
    
    return this.props.children;
  }
}

// Service error handling
class ServiceErrorHandler {
  static async handleWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    backoffMs: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        await this.delay(backoffMs * Math.pow(2, attempt - 1));
      }
    }
    
    throw lastError!;
  }
  
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## Integration Examples

### Complete Service Integration

```typescript
// Example: Complete application service integration
class SolanaWorksApp {
  private deviceMonitor: DeviceMonitor;
  private p2pOrchestrator: P2POrchestrator;
  private aiAgent: ResourceOptimizationAgent;
  private analytics: PerformanceAnalytics;
  
  async initialize() {
    // Initialize services
    this.deviceMonitor = new DeviceMonitor({
      updateInterval: 5000,
      enableThermalMonitoring: true,
      enableNetworkMonitoring: true,
      enableBatteryOptimization: true,
      thresholds: {
        cpuUsage: 80,
        memoryUsage: 90,
        temperature: 70
      }
    });
    
    this.p2pOrchestrator = new P2POrchestrator({
      maxConnections: 50,
      discoveryInterval: 30000,
      heartbeatInterval: 10000,
      taskTimeout: 300000,
      verificationThreshold: 67,
      enableEncryption: true,
      stunServers: ['stun:stun.l.google.com:19302'],
      turnServers: []
    });
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Start services
    await Promise.all([
      this.deviceMonitor.startMonitoring(),
      this.p2pOrchestrator.startNetwork()
    ]);
  }
  
  private setupEventListeners() {
    this.deviceMonitor.on('metrics', this.handleDeviceMetrics.bind(this));
    this.p2pOrchestrator.on('task:assigned', this.handleTaskAssignment.bind(this));
  }
  
  private async handleDeviceMetrics(metrics: IDeviceMetrics) {
    // Use AI agent to optimize based on current metrics
    const decisions = await this.aiAgent.optimizeResources({
      deviceMetrics: metrics,
      networkStatus: this.p2pOrchestrator.getNetworkStatus()
    });
    
    // Execute optimization decisions
    for (const decision of decisions) {
      await this.executeOptimizationDecision(decision);
    }
  }
}
```

This API reference provides comprehensive documentation for all major components and services in the SolanaWorks application, enabling developers to effectively integrate and extend the system. 