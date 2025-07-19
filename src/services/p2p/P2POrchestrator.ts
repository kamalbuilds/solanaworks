import { EventEmitter } from 'events';
import { Keypair } from '@solana/web3.js';
import { DeviceMonitor } from '../DeviceMonitor';
import { PerformanceAnalytics } from '../PerformanceAnalytics';
import { ResourceOptimizationAgent } from '../agents/ResourceOptimizationAgent';
import { P2PNetworkManager, PeerInfo, DeviceCapabilities } from './P2PNetworkManager';
import { DHTTaskDistribution, TaskRequest, TaskResult } from './DHTTaskDistribution';
import { TaskVerification, VerificationResult } from './TaskVerification';
import { PeerDiscovery, NetworkTopology } from './PeerDiscovery';
import { NetworkResilience, NetworkHealth } from './NetworkResilience';
import crypto from 'crypto';

export interface P2PNetworkConfig {
  maxPeers: number;
  bootstrapNodes: string[];
  discoveryMethods: string[];
  verificationRequired: boolean;
  networkResilience: boolean;
  trustedPeers: string[];
}

export interface P2PNetworkStatus {
  isInitialized: boolean;
  connectedPeers: number;
  knownPeers: number;
  activeTasks: number;
  pendingVerifications: number;
  networkHealth: NetworkHealth | null;
  capabilities: DeviceCapabilities | null;
}

export interface TaskSubmissionOptions {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requireVerification: boolean;
  maxExecutionTime: number;
  reward: number;
  deadline?: number;
}

export class P2POrchestrator extends EventEmitter {
  private config: P2PNetworkConfig;
  private localKeypair: Keypair;
  private localPeerId: string;
  
  // Core services
  private deviceMonitor: DeviceMonitor;
  private performanceAnalytics: PerformanceAnalytics;
  private optimizationAgent: ResourceOptimizationAgent;
  
  // P2P components
  private networkManager!: P2PNetworkManager;
  private dhtDistribution!: DHTTaskDistribution;
  private taskVerification!: TaskVerification;
  private peerDiscovery!: PeerDiscovery;
  private networkResilience!: NetworkResilience;
  
  private isInitialized = false;

  constructor(
    deviceMonitor: DeviceMonitor,
    performanceAnalytics: PerformanceAnalytics,
    optimizationAgent: ResourceOptimizationAgent,
    config: Partial<P2PNetworkConfig> = {}
  ) {
    super();
    
    this.deviceMonitor = deviceMonitor;
    this.performanceAnalytics = performanceAnalytics;
    this.optimizationAgent = optimizationAgent;
    
    // Generate keypair for this node
    this.localKeypair = Keypair.generate();
    this.localPeerId = this.localKeypair.publicKey.toString();
    
    // Set default configuration
    this.config = {
      maxPeers: 50,
      bootstrapNodes: [],
      discoveryMethods: ['dht', 'peer_exchange', 'bootstrap'],
      verificationRequired: true,
      networkResilience: true,
      trustedPeers: [],
      ...config
    };

    this.initializeComponents();
  }

  private initializeComponents(): void {
    // Initialize P2P Network Manager
    this.networkManager = new P2PNetworkManager(
      this.localPeerId,
      this.deviceMonitor,
      this.performanceAnalytics
    );

    // Initialize DHT Task Distribution
    this.dhtDistribution = new DHTTaskDistribution(
      this.networkManager,
      this.localPeerId
    );

    // Initialize Task Verification
    this.taskVerification = new TaskVerification(
      this.networkManager,
      this.localKeypair
    );

    // Initialize Peer Discovery
    this.peerDiscovery = new PeerDiscovery(
      this.networkManager,
      this.localPeerId
    );

    // Initialize Network Resilience
    this.networkResilience = new NetworkResilience(
      this.networkManager,
      this.dhtDistribution,
      this.taskVerification,
      this.peerDiscovery,
      this.localPeerId
    );

    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Initializing P2P Network...');

      // Start device monitoring
      await this.deviceMonitor.startMonitoring();

      // Initialize P2P components in order
      await this.networkManager.initialize();
      await this.dhtDistribution.initialize();
      await this.taskVerification.initialize();
      await this.peerDiscovery.initialize(this.config.bootstrapNodes);
      
      if (this.config.networkResilience) {
        await this.networkResilience.initialize();
      }

      // Add trusted peers
      for (const trustedPeer of this.config.trustedPeers) {
        this.networkResilience.addTrustedPeer(trustedPeer);
      }

      this.isInitialized = true;
      this.emit('initialized');
      
      console.log(`P2P Network initialized successfully. Node ID: ${this.localPeerId}`);
      
    } catch (error) {
      console.error('Failed to initialize P2P Network:', error);
      throw error;
    }
  }

  async submitTask(
    taskType: 'compute' | 'storage' | 'network' | 'ai_inference',
    payload: any,
    requirements: {
      cpuCores: number;
      memoryGB: number;
      gpuRequired: boolean;
      estimatedDuration: number;
    },
    options: TaskSubmissionOptions
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('P2P Network not initialized');
    }

    const task: Omit<TaskRequest, 'id' | 'timestamp' | 'submittedBy'> = {
      type: taskType,
      payload,
      requirements: {
        ...requirements,
        priority: options.priority
      },
      reward: options.reward,
      deadline: options.deadline || Date.now() + options.maxExecutionTime
    };

    try {
      const taskId = await this.dhtDistribution.submitTask(task);
      
      this.emit('task_submitted', { taskId, task: { ...task, id: taskId } });
      
      return taskId;
    } catch (error) {
      console.error('Failed to submit task:', error);
      throw error;
    }
  }

  async acceptTask(taskId: string): Promise<boolean> {
    if (!this.isInitialized) {
      throw new Error('P2P Network not initialized');
    }

    try {
      // Check if we can handle this task
      const assignment = this.dhtDistribution.getTaskAssignments()
        .find(a => a.taskId === taskId && a.assignedTo === this.localPeerId);
      
      if (!assignment) {
        console.log(`Task ${taskId} not assigned to this node`);
        return false;
      }

      // Use optimization agent to evaluate if we should accept
      const task = this.dhtDistribution.getActiveTasks().find(t => t.id === taskId);
      if (!task) {
        console.log(`Task ${taskId} not found in active tasks`);
        return false;
      }
      
              const decision = await this.optimizationAgent.evaluateTaskRequest({
          type: task.type,
          requirements: {
            cpu: task.requirements.cpuCores,
            memory: task.requirements.memoryGB,
            estimatedDuration: task.requirements.estimatedDuration,
            priority: task.requirements.priority === 'urgent' ? 'critical' : task.requirements.priority
          },
          reward: task.reward
        });
      
      const shouldAccept = decision.action === 'accept';
      
      if (!shouldAccept) {
        console.log(`Optimization agent recommends rejecting task ${taskId}`);
        return false;
      }

      const accepted = await this.dhtDistribution.acceptTask(taskId);
      
      if (accepted) {
        this.emit('task_accepted', { taskId });
      }
      
      return accepted;
    } catch (error) {
      console.error(`Failed to accept task ${taskId}:`, error);
      return false;
    }
  }

  async connectToPeer(peerId: string): Promise<boolean> {
    if (!this.isInitialized) {
      throw new Error('P2P Network not initialized');
    }

    try {
      const connected = await this.peerDiscovery.connectToPeer(peerId);
      
      if (connected) {
        this.emit('peer_connected', { peerId });
      }
      
      return connected;
    } catch (error) {
      console.error(`Failed to connect to peer ${peerId}:`, error);
      return false;
    }
  }

  async discoverPeers(): Promise<PeerInfo[]> {
    if (!this.isInitialized) {
      throw new Error('P2P Network not initialized');
    }

    try {
      const peers = await this.peerDiscovery.discoverPeers();
      
      this.emit('peers_discovered', { count: peers.length, peers });
      
      return peers;
    } catch (error) {
      console.error('Failed to discover peers:', error);
      return [];
    }
  }

  getNetworkStatus(): P2PNetworkStatus {
    if (!this.isInitialized) {
      return {
        isInitialized: false,
        connectedPeers: 0,
        knownPeers: 0,
        activeTasks: 0,
        pendingVerifications: 0,
        networkHealth: null,
        capabilities: null
      };
    }

    return {
      isInitialized: this.isInitialized,
      connectedPeers: this.networkManager.getConnectedPeers().length,
      knownPeers: this.peerDiscovery.getKnownPeers().length,
      activeTasks: this.dhtDistribution.getActiveTasks().length,
      pendingVerifications: this.taskVerification.getPendingVerifications().length,
      networkHealth: this.networkResilience.getCurrentHealth(),
      capabilities: null // Will be populated after initialization
    };
  }

  getConnectedPeers(): PeerInfo[] {
    if (!this.isInitialized) return [];
    
    return this.networkManager.getConnectedPeers()
      .map(peerId => this.networkManager.getPeerInfo(peerId))
      .filter((peer): peer is PeerInfo => peer !== undefined);
  }

  getActiveTasks(): any[] {
    if (!this.isInitialized) return [];
    
    return this.dhtDistribution.getActiveTasks();
  }

  getCompletedTasks(): any[] {
    if (!this.isInitialized) return [];
    
    return this.dhtDistribution.getCompletedTasks();
  }

  getNetworkTopology(): NetworkTopology | null {
    if (!this.isInitialized) return null;
    
    return this.peerDiscovery.getNetworkTopology();
  }

  getVerificationResults(): VerificationResult[] {
    if (!this.isInitialized) return [];
    
    return this.taskVerification.getCompletedVerifications();
  }

  getNetworkHealth(): NetworkHealth | null {
    if (!this.isInitialized) return null;
    
    return this.networkResilience.getCurrentHealth();
  }

  async getLocalCapabilities(): Promise<DeviceCapabilities | null> {
    if (!this.isInitialized) return null;
    
    try {
      return await this.networkManager.getLocalCapabilities();
    } catch (error) {
      console.error('Failed to get local capabilities:', error);
      return null;
    }
  }

  async optimizeNetworkPerformance(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      // Start optimization if not already running
      if (!this.optimizationAgent.getOptimizationStats().isRunning) {
        await this.optimizationAgent.startOptimization(10000); // 10 second intervals
      }
      
      // Force peer discovery to find better connections
      await this.peerDiscovery.forceDiscovery();
      
      // Update network health
      await this.networkResilience.assessNetworkHealth();
      
      this.emit('network_optimized');
    } catch (error) {
      console.error('Failed to optimize network performance:', error);
    }
  }

  async handleNetworkPartition(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      await this.networkResilience.detectAndHandlePartitions();
    } catch (error) {
      console.error('Failed to handle network partition:', error);
    }
  }

  async resetNetwork(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      await this.networkResilience.forceNetworkReset();
      this.emit('network_reset');
    } catch (error) {
      console.error('Failed to reset network:', error);
    }
  }

  addTrustedPeer(peerId: string): void {
    if (this.isInitialized) {
      this.networkResilience.addTrustedPeer(peerId);
      this.emit('trusted_peer_added', { peerId });
    }
  }

  removeTrustedPeer(peerId: string): void {
    if (this.isInitialized) {
      this.networkResilience.removeTrustedPeer(peerId);
      this.emit('trusted_peer_removed', { peerId });
    }
  }

  getNodeId(): string {
    return this.localPeerId;
  }

  getPublicKey(): string {
    return this.localKeypair.publicKey.toString();
  }

  private setupEventHandlers(): void {
    // Network Manager events
    this.networkManager.on('peer_connected', (peerId: string) => {
      this.emit('peer_connected', { peerId });
    });

    this.networkManager.on('peer_disconnected', (peerId: string) => {
      this.emit('peer_disconnected', { peerId });
    });

    this.networkManager.on('network_offline', () => {
      this.emit('network_offline');
    });

    // DHT Distribution events
    this.dhtDistribution.on('task_submitted', (data: any) => {
      this.emit('task_submitted', data);
    });

    this.dhtDistribution.on('task_received', (data: any) => {
      this.emit('task_received', data);
      // Auto-accept tasks based on optimization agent
      this.acceptTask(data.task.id).catch(console.error);
    });

    this.dhtDistribution.on('task_completed', (data: any) => {
      this.emit('task_completed', data);
    });

    this.dhtDistribution.on('task_failed', (data: any) => {
      this.emit('task_failed', data);
    });

    // Task Verification events
    this.taskVerification.on('verification_requested', (data: any) => {
      this.emit('verification_requested', data);
    });

    this.taskVerification.on('verification_finalized', (data: any) => {
      this.emit('verification_finalized', data);
    });

    // Peer Discovery events
    this.peerDiscovery.on('peers_discovered', (data: any) => {
      this.emit('peers_discovered', data);
    });

    this.peerDiscovery.on('topology_updated', (data: any) => {
      this.emit('topology_updated', data);
    });

    // Network Resilience events
    this.networkResilience.on('health_updated', (health: NetworkHealth) => {
      this.emit('health_updated', health);
    });

    this.networkResilience.on('partition_detected', (partition: any) => {
      this.emit('partition_detected', partition);
    });

    this.networkResilience.on('security_alert_received', (alert: any) => {
      this.emit('security_alert', alert);
    });

    this.networkResilience.on('network_reset', (data: any) => {
      this.emit('network_reset', data);
    });
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      console.log('Shutting down P2P Network...');

      // Shutdown components in reverse order
      if (this.config.networkResilience) {
        await this.networkResilience.shutdown();
      }
      
      await this.peerDiscovery.shutdown();
      await this.taskVerification.shutdown();
      await this.dhtDistribution.shutdown();
      await this.networkManager.shutdown();

      this.deviceMonitor.stopMonitoring();

      this.isInitialized = false;
      this.emit('shutdown');
      
      console.log('P2P Network shutdown complete');
    } catch (error) {
      console.error('Error during P2P Network shutdown:', error);
    }
  }

  // Statistics and monitoring methods
  getNetworkStatistics() {
    if (!this.isInitialized) return null;

    return {
      network: this.networkManager.getNetworkStats(),
      discovery: this.peerDiscovery.getDiscoveryStats(),
      verification: this.taskVerification.getVerificationStats(),
      routing: this.dhtDistribution.getRoutingTableStats(),
      health: this.networkResilience.getCurrentHealth(),
      security: this.networkResilience.getSecurityEvents().length,
      partitions: this.networkResilience.getNetworkPartitions().length
    };
  }

  getDetailedStatus() {
    if (!this.isInitialized) return null;

    return {
      nodeId: this.localPeerId,
      publicKey: this.getPublicKey(),
      status: this.getNetworkStatus(),
      peers: {
        connected: this.getConnectedPeers(),
        known: this.peerDiscovery.getKnownPeers(),
        trusted: this.networkResilience.getTrustedPeers(),
        blacklisted: this.networkResilience.getBlacklistedPeers()
      },
      tasks: {
        active: this.getActiveTasks(),
        completed: this.getCompletedTasks(),
        assignments: this.dhtDistribution.getTaskAssignments()
      },
      verification: {
        pending: this.taskVerification.getPendingVerifications(),
        completed: this.taskVerification.getCompletedVerifications(),
        reputation: this.taskVerification.getReputationScores()
      },
      network: {
        topology: this.getNetworkTopology(),
        health: this.getNetworkHealth(),
        partitions: this.networkResilience.getNetworkPartitions(),
        circuitBreakers: this.networkResilience.getCircuitBreakers()
      },
      security: {
        events: this.networkResilience.getSecurityEvents(),
        recoveryActions: this.networkResilience.getRecoveryActions()
      }
    };
  }
} 