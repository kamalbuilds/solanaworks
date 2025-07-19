import { EventEmitter } from 'events';
import { P2PNetworkManager, PeerInfo, MessagePacket } from './P2PNetworkManager';
import { DHTTaskDistribution } from './DHTTaskDistribution';
import { TaskVerification } from './TaskVerification';
import { PeerDiscovery } from './PeerDiscovery';
import crypto from 'crypto';

export interface NetworkHealth {
  overallHealth: number;
  connectivity: number;
  latency: number;
  throughput: number;
  reliability: number;
  security: number;
  timestamp: number;
}

export interface SecurityEvent {
  id: string;
  type: 'malicious_peer' | 'attack_detected' | 'invalid_signature' | 'spam_detected' | 'ddos_attempt';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  details: any;
  timestamp: number;
  mitigated: boolean;
}

export interface RecoveryAction {
  id: string;
  type: 'reconnect' | 'bootstrap' | 'route_repair' | 'peer_replacement' | 'network_reset';
  triggeredBy: string;
  target?: string;
  startTime: number;
  endTime?: number;
  success?: boolean;
  attempts: number;
}

export interface NetworkPartition {
  id: string;
  detectedAt: number;
  affectedPeers: string[];
  isolatedNodes: string[];
  bridgeNodes: string[];
  healingAttempts: number;
  status: 'detected' | 'healing' | 'healed' | 'permanent';
}

export interface CircuitBreaker {
  service: string;
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  lastFailure: number;
  threshold: number;
  timeout: number;
  resetTime: number;
}

export class NetworkResilience extends EventEmitter {
  private networkManager: P2PNetworkManager;
  private dhtDistribution: DHTTaskDistribution;
  private taskVerification: TaskVerification;
  private peerDiscovery: PeerDiscovery;
  private localPeerId: string;
  
  private healthHistory: NetworkHealth[] = [];
  private securityEvents: Map<string, SecurityEvent> = new Map();
  private recoveryActions: Map<string, RecoveryAction> = new Map();
  private networkPartitions: Map<string, NetworkPartition> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private blacklistedPeers: Set<string> = new Set();
  private trustedPeers: Set<string> = new Set();
  
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private recoveryInterval: NodeJS.Timeout | null = null;
  private securityMonitorInterval: NodeJS.Timeout | null = null;
  
  private healthCheckIntervalMs = 10000; // 10 seconds
  private recoveryCheckIntervalMs = 30000; // 30 seconds
  private securityMonitorMs = 5000; // 5 seconds
  private maxHealthHistory = 100;
  private maxRecoveryAttempts = 3;
  private partitionThreshold = 0.3; // 30% of peers lost
  private isInitialized = false;

  constructor(
    networkManager: P2PNetworkManager,
    dhtDistribution: DHTTaskDistribution,
    taskVerification: TaskVerification,
    peerDiscovery: PeerDiscovery,
    localPeerId: string
  ) {
    super();
    this.networkManager = networkManager;
    this.dhtDistribution = dhtDistribution;
    this.taskVerification = taskVerification;
    this.peerDiscovery = peerDiscovery;
    this.localPeerId = localPeerId;

    this.initializeCircuitBreakers();
    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Start monitoring processes
      this.startHealthMonitoring();
      this.startRecoveryMonitoring();
      this.startSecurityMonitoring();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log(`Network Resilience initialized for node: ${this.localPeerId}`);
    } catch (error) {
      console.error('Failed to initialize Network Resilience:', error);
      throw error;
    }
  }

  async assessNetworkHealth(): Promise<NetworkHealth> {
    const timestamp = Date.now();
    
    // Assess connectivity
    const connectedPeers = this.networkManager.getConnectedPeers().length;
    const knownPeers = this.peerDiscovery.getKnownPeers().length;
    const connectivity = knownPeers > 0 ? connectedPeers / knownPeers : 0;

    // Assess latency
    const allPeers = this.networkManager.getAllPeers();
    const averageLatency = allPeers.length > 0
      ? allPeers.reduce((sum, peer) => sum + peer.latency, 0) / allPeers.length
      : 999;
    const latency = Math.max(0, 1 - averageLatency / 1000); // Normalize to 0-1

    // Assess throughput (simplified metric)
    const networkStats = this.networkManager.getNetworkStats();
    const throughput = Math.min(1, networkStats.connectedPeers / 10); // Simple throughput metric

    // Assess reliability
    const verificationStats = this.taskVerification.getVerificationStats();
    const reliability = verificationStats.approvalRate;

    // Assess security
    const recentSecurityEvents = Array.from(this.securityEvents.values())
      .filter(event => timestamp - event.timestamp < 300000); // Last 5 minutes
    const criticalEvents = recentSecurityEvents.filter(event => event.severity === 'critical').length;
    const security = Math.max(0, 1 - criticalEvents * 0.2);

    // Calculate overall health
    const overallHealth = (connectivity * 0.25 + latency * 0.2 + throughput * 0.2 + reliability * 0.25 + security * 0.1);

    const health: NetworkHealth = {
      overallHealth,
      connectivity,
      latency,
      throughput,
      reliability,
      security,
      timestamp
    };

    // Store health history
    this.healthHistory.push(health);
    if (this.healthHistory.length > this.maxHealthHistory) {
      this.healthHistory.shift();
    }

    this.emit('health_updated', health);
    return health;
  }

  async detectAndHandlePartitions(): Promise<void> {
    const connectedPeers = this.networkManager.getConnectedPeers();
    const knownPeers = this.peerDiscovery.getKnownPeers();
    
    const connectivityRatio = connectedPeers.length / Math.max(1, knownPeers.length);
    
    if (connectivityRatio < this.partitionThreshold) {
      const partitionId = this.generateId();
      const affectedPeers = knownPeers
        .filter(peer => !connectedPeers.includes(peer.peerId))
        .map(peer => peer.peerId);
      
      const partition: NetworkPartition = {
        id: partitionId,
        detectedAt: Date.now(),
        affectedPeers,
        isolatedNodes: [],
        bridgeNodes: connectedPeers,
        healingAttempts: 0,
        status: 'detected'
      };

      this.networkPartitions.set(partitionId, partition);
      
      this.emit('partition_detected', partition);
      
      // Attempt to heal partition
      await this.healNetworkPartition(partitionId);
    }
  }

  async healNetworkPartition(partitionId: string): Promise<void> {
    const partition = this.networkPartitions.get(partitionId);
    if (!partition || partition.status === 'healed') return;

    partition.status = 'healing';
    partition.healingAttempts++;

    try {
      // Strategy 1: Try reconnecting to affected peers
      for (const peerId of partition.affectedPeers) {
        try {
          await this.peerDiscovery.connectToPeer(peerId);
        } catch (error) {
          console.warn(`Failed to reconnect to peer ${peerId}:`, error);
        }
      }

      // Strategy 2: Use bridge nodes to discover new paths
      for (const bridgeNode of partition.bridgeNodes) {
        try {
          await this.requestPartitionHealing(bridgeNode, partition.affectedPeers);
        } catch (error) {
          console.warn(`Failed to request healing via bridge ${bridgeNode}:`, error);
        }
      }

      // Strategy 3: Force peer discovery
      await this.peerDiscovery.forceDiscovery();

      // Check if partition is healed
      const newConnectedPeers = this.networkManager.getConnectedPeers();
      const reconnectedCount = partition.affectedPeers.filter(peerId =>
        newConnectedPeers.includes(peerId)
      ).length;

      if (reconnectedCount >= partition.affectedPeers.length * 0.8) {
        partition.status = 'healed';
        this.emit('partition_healed', partition);
      } else if (partition.healingAttempts >= this.maxRecoveryAttempts) {
        partition.status = 'permanent';
        this.emit('partition_permanent', partition);
      }

    } catch (error) {
      console.error(`Failed to heal partition ${partitionId}:`, error);
    }

    this.networkPartitions.set(partitionId, partition);
  }

  async handlePeerFailure(peerId: string): Promise<void> {
    const recoveryId = this.generateId();
    
    const recovery: RecoveryAction = {
      id: recoveryId,
      type: 'reconnect',
      triggeredBy: 'peer_failure',
      target: peerId,
      startTime: Date.now(),
      attempts: 0
    };

    this.recoveryActions.set(recoveryId, recovery);

    try {
      // Attempt reconnection with exponential backoff
      for (let attempt = 1; attempt <= this.maxRecoveryAttempts; attempt++) {
        recovery.attempts = attempt;
        
        const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));

        try {
          const reconnected = await this.peerDiscovery.connectToPeer(peerId);
          if (reconnected) {
            recovery.success = true;
            recovery.endTime = Date.now();
            this.emit('peer_recovered', { peerId, recoveryId });
            return;
          }
        } catch (error) {
          console.warn(`Reconnection attempt ${attempt} failed for peer ${peerId}:`, error);
        }
      }

      // If reconnection fails, find replacement peer
      await this.findReplacementPeer(peerId);
      
      recovery.success = false;
      recovery.endTime = Date.now();
      
    } catch (error) {
      console.error(`Failed to handle peer failure for ${peerId}:`, error);
      recovery.success = false;
      recovery.endTime = Date.now();
    }

    this.recoveryActions.set(recoveryId, recovery);
  }

  async detectSecurityThreats(): Promise<SecurityEvent[]> {
    const threats: SecurityEvent[] = [];
    const currentTime = Date.now();

    // Check for malicious peers
    const maliciousPeers = this.detectMaliciousPeers();
    for (const peerId of maliciousPeers) {
      threats.push({
        id: this.generateId(),
        type: 'malicious_peer',
        severity: 'high',
        source: peerId,
        details: { reason: 'suspicious_behavior' },
        timestamp: currentTime,
        mitigated: false
      });
    }

    // Check for spam/DDoS
    const spamThreats = this.detectSpamThreats();
    threats.push(...spamThreats);

    // Process and mitigate threats
    for (const threat of threats) {
      await this.mitigateSecurityThreat(threat);
    }

    return threats;
  }

  private detectMaliciousPeers(): string[] {
    const maliciousPeers: string[] = [];
    const reputationScores = this.taskVerification.getReputationScores();

    for (const reputation of reputationScores) {
      // Detect peers with consistently low reputation
      if (reputation.score < 0.2 && reputation.totalVerifications > 5) {
        maliciousPeers.push(reputation.peerId);
      }

      // Detect peers with high false positive/negative rates
      const errorRate = (reputation.falsePositives + reputation.falseNegatives) / reputation.totalVerifications;
      if (errorRate > 0.5 && reputation.totalVerifications > 10) {
        maliciousPeers.push(reputation.peerId);
      }
    }

    return [...new Set(maliciousPeers)]; // Remove duplicates
  }

  private detectSpamThreats(): SecurityEvent[] {
    const threats: SecurityEvent[] = [];
    const messageRates = new Map<string, number>();
    
    // This would track message rates in a real implementation
    // For now, we'll simulate detection logic
    
    return threats;
  }

  private async mitigateSecurityThreat(threat: SecurityEvent): Promise<void> {
    try {
      switch (threat.type) {
        case 'malicious_peer':
          await this.quarantinePeer(threat.source, threat.severity);
          break;
        case 'spam_detected':
          await this.rateLimitPeer(threat.source);
          break;
        case 'ddos_attempt':
          await this.activateCircuitBreaker('network', threat.source);
          break;
        case 'invalid_signature':
          await this.flagInvalidSignature(threat.source);
          break;
      }

      threat.mitigated = true;
      this.securityEvents.set(threat.id, threat);
      
      this.emit('threat_mitigated', threat);
      
    } catch (error) {
      console.error(`Failed to mitigate security threat ${threat.id}:`, error);
    }
  }

  private async quarantinePeer(peerId: string, severity: SecurityEvent['severity']): Promise<void> {
    this.blacklistedPeers.add(peerId);
    this.trustedPeers.delete(peerId);
    
    // Disconnect from peer
    this.networkManager.disconnect(peerId);
    
    // Notify other trusted peers
    const trustedPeersList = Array.from(this.trustedPeers);
    for (const trustedPeer of trustedPeersList) {
      this.networkManager.sendMessage(trustedPeer, {
        type: 'peer_discovery',
        to: trustedPeer,
        data: {
          type: 'security_alert',
          maliciousPeer: peerId,
          severity,
          timestamp: Date.now()
        }
      });
    }

    this.emit('peer_quarantined', { peerId, severity });
  }

  private async rateLimitPeer(peerId: string): Promise<void> {
    // Implement rate limiting logic
    console.log(`Rate limiting peer ${peerId}`);
  }

  private async activateCircuitBreaker(service: string, source: string): Promise<void> {
    const breaker = this.circuitBreakers.get(service);
    if (breaker) {
      breaker.state = 'open';
      breaker.lastFailure = Date.now();
      breaker.resetTime = Date.now() + breaker.timeout;
      
      this.emit('circuit_breaker_opened', { service, source });
    }
  }

  private async flagInvalidSignature(peerId: string): Promise<void> {
    // Track invalid signature attempts
    console.log(`Flagging invalid signature from peer ${peerId}`);
  }

  private async requestPartitionHealing(bridgeNode: string, affectedPeers: string[]): Promise<void> {
    this.networkManager.sendMessage(bridgeNode, {
      type: 'peer_discovery',
      to: bridgeNode,
      data: {
        type: 'partition_healing',
        affectedPeers,
        requestId: this.generateId()
      }
    });
  }

  private async findReplacementPeer(failedPeerId: string): Promise<void> {
    const failedPeer = this.networkManager.getPeerInfo(failedPeerId);
    if (!failedPeer) return;

    // Find peers with similar capabilities
    const allPeers = this.peerDiscovery.getKnownPeers();
    const replacementCandidates = allPeers
      .filter(peer => 
        peer.peerId !== failedPeerId &&
        !this.blacklistedPeers.has(peer.peerId) &&
        this.areSimilarCapabilities(peer.capabilities, failedPeer.capabilities)
      )
      .slice(0, 3); // Try top 3 candidates

    for (const candidate of replacementCandidates) {
      try {
        const connected = await this.peerDiscovery.connectToPeer(candidate.peerId);
        if (connected) {
          this.emit('peer_replaced', { failed: failedPeerId, replacement: candidate.peerId });
          return;
        }
      } catch (error) {
        console.warn(`Failed to connect to replacement peer ${candidate.peerId}:`, error);
      }
    }
  }

  private areSimilarCapabilities(caps1: any, caps2: any): boolean {
    // Simple capability comparison
    return (
      Math.abs(caps1.cpuCores - caps2.cpuCores) <= 2 &&
      Math.abs(caps1.ramGB - caps2.ramGB) <= 4 &&
      caps1.gpuAcceleration === caps2.gpuAcceleration
    );
  }

  private initializeCircuitBreakers(): void {
    const services = ['network', 'dht', 'verification', 'discovery'];
    
    for (const service of services) {
      this.circuitBreakers.set(service, {
        service,
        state: 'closed',
        failureCount: 0,
        lastFailure: 0,
        threshold: 5,
        timeout: 60000, // 1 minute
        resetTime: 0
      });
    }
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.assessNetworkHealth();
        await this.detectAndHandlePartitions();
      } catch (error) {
        console.error('Health monitoring error:', error);
      }
    }, this.healthCheckIntervalMs);
  }

  private startRecoveryMonitoring(): void {
    this.recoveryInterval = setInterval(async () => {
      try {
        await this.checkRecoveryActions();
        await this.updateCircuitBreakers();
      } catch (error) {
        console.error('Recovery monitoring error:', error);
      }
    }, this.recoveryCheckIntervalMs);
  }

  private startSecurityMonitoring(): void {
    this.securityMonitorInterval = setInterval(async () => {
      try {
        await this.detectSecurityThreats();
        await this.cleanupSecurityEvents();
      } catch (error) {
        console.error('Security monitoring error:', error);
      }
    }, this.securityMonitorMs);
  }

  private async checkRecoveryActions(): Promise<void> {
    const now = Date.now();
    const activeRecoveries = Array.from(this.recoveryActions.values())
      .filter(recovery => !recovery.endTime);

    for (const recovery of activeRecoveries) {
      // Timeout long-running recovery actions
      if (now - recovery.startTime > 300000) { // 5 minutes
        recovery.endTime = now;
        recovery.success = false;
        this.recoveryActions.set(recovery.id, recovery);
      }
    }
  }

  private async updateCircuitBreakers(): Promise<void> {
    const now = Date.now();
    
    for (const [service, breaker] of this.circuitBreakers.entries()) {
      if (breaker.state === 'open' && now >= breaker.resetTime) {
        breaker.state = 'half_open';
        breaker.failureCount = 0;
        this.emit('circuit_breaker_half_open', { service });
      }
    }
  }

  private async cleanupSecurityEvents(): Promise<void> {
    const now = Date.now();
    const eventTtl = 3600000; // 1 hour

    for (const [eventId, event] of this.securityEvents.entries()) {
      if (now - event.timestamp > eventTtl) {
        this.securityEvents.delete(eventId);
      }
    }
  }

  private setupEventHandlers(): void {
    this.networkManager.on('peer_disconnected', (peerId: string) => {
      this.handlePeerFailure(peerId);
    });

    this.networkManager.on('network_offline', () => {
      this.emit('network_offline');
    });

    this.networkManager.on('message', (message: MessagePacket) => {
      this.handleResilienceMessage(message);
    });
  }

  private handleResilienceMessage(message: MessagePacket): void {
    if (message.type !== 'peer_discovery') return;

    const { type } = message.data;

    switch (type) {
      case 'security_alert':
        this.handleSecurityAlert(message);
        break;
      case 'partition_healing':
        this.handlePartitionHealingRequest(message);
        break;
    }
  }

  private handleSecurityAlert(message: MessagePacket): void {
    const { maliciousPeer, severity } = message.data;
    
    if (this.trustedPeers.has(message.from)) {
      this.blacklistedPeers.add(maliciousPeer);
      this.networkManager.disconnect(maliciousPeer);
      
      this.emit('security_alert_received', { maliciousPeer, severity, from: message.from });
    }
  }

  private handlePartitionHealingRequest(message: MessagePacket): void {
    const { affectedPeers } = message.data;
    
    // Help heal partition by sharing known peers
    const knownPeers = this.peerDiscovery.getKnownPeers()
      .filter(peer => affectedPeers.includes(peer.peerId))
      .slice(0, 5); // Share up to 5 peers

    this.networkManager.sendMessage(message.from, {
      type: 'peer_discovery',
      to: message.from,
      data: {
        type: 'partition_healing_response',
        peers: knownPeers,
        requestId: message.data.requestId
      }
    });
  }

  private generateId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  // Public API methods
  public getCurrentHealth(): NetworkHealth | null {
    return this.healthHistory.length > 0 
      ? this.healthHistory[this.healthHistory.length - 1] 
      : null;
  }

  public getHealthHistory(): NetworkHealth[] {
    return [...this.healthHistory];
  }

  public getSecurityEvents(): SecurityEvent[] {
    return Array.from(this.securityEvents.values());
  }

  public getRecoveryActions(): RecoveryAction[] {
    return Array.from(this.recoveryActions.values());
  }

  public getNetworkPartitions(): NetworkPartition[] {
    return Array.from(this.networkPartitions.values());
  }

  public getCircuitBreakers(): CircuitBreaker[] {
    return Array.from(this.circuitBreakers.values());
  }

  public getBlacklistedPeers(): string[] {
    return Array.from(this.blacklistedPeers);
  }

  public getTrustedPeers(): string[] {
    return Array.from(this.trustedPeers);
  }

  public addTrustedPeer(peerId: string): void {
    this.trustedPeers.add(peerId);
    this.blacklistedPeers.delete(peerId);
  }

  public removeTrustedPeer(peerId: string): void {
    this.trustedPeers.delete(peerId);
  }

  public async forceNetworkReset(): Promise<void> {
    const recoveryId = this.generateId();
    
    const recovery: RecoveryAction = {
      id: recoveryId,
      type: 'network_reset',
      triggeredBy: 'manual',
      startTime: Date.now(),
      attempts: 1
    };

    try {
      // Disconnect from all peers
      const connectedPeers = this.networkManager.getConnectedPeers();
      for (const peerId of connectedPeers) {
        this.networkManager.disconnect(peerId);
      }

      // Reset circuit breakers
      for (const breaker of this.circuitBreakers.values()) {
        breaker.state = 'closed';
        breaker.failureCount = 0;
        breaker.lastFailure = 0;
      }

      // Clear blacklist (but keep trusted peers)
      this.blacklistedPeers.clear();

      // Force discovery
      await this.peerDiscovery.forceDiscovery();

      recovery.success = true;
      recovery.endTime = Date.now();
      
      this.emit('network_reset', { recoveryId, success: true });
      
    } catch (error) {
      recovery.success = false;
      recovery.endTime = Date.now();
      
      console.error('Failed to reset network:', error);
      this.emit('network_reset', { recoveryId, success: false, error });
    }

    this.recoveryActions.set(recoveryId, recovery);
  }

  public async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
      this.recoveryInterval = null;
    }

    if (this.securityMonitorInterval) {
      clearInterval(this.securityMonitorInterval);
      this.securityMonitorInterval = null;
    }

    this.isInitialized = false;
    this.emit('shutdown');
  }
} 