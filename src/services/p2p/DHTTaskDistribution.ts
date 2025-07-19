import { EventEmitter } from 'events';
import { P2PNetworkManager, PeerInfo, MessagePacket, DeviceCapabilities } from './P2PNetworkManager';
import { PublicKey } from '@solana/web3.js';
import crypto from 'crypto';

export interface TaskRequest {
  id: string;
  type: 'compute' | 'storage' | 'network' | 'ai_inference';
  payload: any;
  requirements: {
    cpuCores: number;
    memoryGB: number;
    gpuRequired: boolean;
    estimatedDuration: number;
    priority: 'low' | 'medium' | 'high' | 'urgent';
  };
  reward: number;
  deadline: number;
  submittedBy: string;
  timestamp: number;
  signature?: string;
}

export interface TaskAssignment {
  taskId: string;
  assignedTo: string;
  assignedAt: number;
  expectedCompletion: number;
  backupPeers: string[];
}

export interface TaskResult {
  taskId: string;
  result: any;
  completedBy: string;
  completedAt: number;
  executionTime: number;
  resourceUsage: {
    cpuUsage: number;
    memoryUsage: number;
    networkUsage: number;
  };
  signature?: string;
}

export interface DHTNode {
  id: string;
  distance: number;
  lastSeen: number;
  capabilities: DeviceCapabilities;
  reputation: number;
}

export interface RoutingTable {
  buckets: Map<number, DHTNode[]>;
  localNodeId: string;
}

export class DHTTaskDistribution extends EventEmitter {
  private networkManager: P2PNetworkManager;
  private routingTable: RoutingTable;
  private activeTasks: Map<string, TaskRequest> = new Map();
  private taskAssignments: Map<string, TaskAssignment> = new Map();
  private completedTasks: Map<string, TaskResult> = new Map();
  private pendingTasks: Map<string, TaskRequest> = new Map();
  private localNodeId: string;
  private k = 20; // Kademlia K parameter (bucket size)
  private alpha = 3; // Concurrency parameter for lookups
  private bucketRefreshInterval: NodeJS.Timeout | null = null;
  private taskTimeout = 300000; // 5 minutes default task timeout
  private isInitialized = false;

  constructor(networkManager: P2PNetworkManager, localNodeId: string) {
    super();
    this.networkManager = networkManager;
    this.localNodeId = localNodeId;
    this.routingTable = {
      buckets: new Map(),
      localNodeId
    };

    this.setupNetworkEventHandlers();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize routing table
      this.initializeRoutingTable();
      
      // Start bucket refresh timer
      this.startBucketRefresh();
      
      // Bootstrap DHT by connecting to initial peers
      await this.bootstrapDHT();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log(`DHT Task Distribution initialized for node: ${this.localNodeId}`);
    } catch (error) {
      console.error('Failed to initialize DHT Task Distribution:', error);
      throw error;
    }
  }

  async submitTask(task: Omit<TaskRequest, 'id' | 'timestamp' | 'submittedBy'>): Promise<string> {
    const taskId = this.generateTaskId();
    const taskRequest: TaskRequest = {
      ...task,
      id: taskId,
      timestamp: Date.now(),
      submittedBy: this.localNodeId
    };

    this.pendingTasks.set(taskId, taskRequest);
    
    try {
      // Find optimal peers for task execution
      const candidatePeers = await this.findTaskCandidates(taskRequest);
      
      if (candidatePeers.length === 0) {
        throw new Error('No suitable peers found for task execution');
      }

      // Assign task to best candidate
      const assignment = await this.assignTask(taskRequest, candidatePeers);
      this.taskAssignments.set(taskId, assignment);
      this.activeTasks.set(taskId, taskRequest);
      this.pendingTasks.delete(taskId);

      // Broadcast task assignment
      await this.broadcastTaskAssignment(assignment);
      
      // Set timeout for task completion
      this.setTaskTimeout(taskId);
      
      this.emit('task_submitted', { taskId, assignment });
      return taskId;
      
    } catch (error) {
      this.pendingTasks.delete(taskId);
      console.error(`Failed to submit task ${taskId}:`, error);
      throw error;
    }
  }

  async acceptTask(taskId: string): Promise<boolean> {
    const assignment = this.taskAssignments.get(taskId);
    if (!assignment || assignment.assignedTo !== this.localNodeId) {
      return false;
    }

    const task = this.activeTasks.get(taskId);
    if (!task) {
      return false;
    }

    try {
      // Execute task locally
      const result = await this.executeTask(task);
      
      // Submit result
      await this.submitTaskResult(taskId, result);
      
      return true;
    } catch (error) {
      console.error(`Failed to execute task ${taskId}:`, error);
      await this.reportTaskFailure(taskId, error);
      return false;
    }
  }

  async findTaskCandidates(task: TaskRequest): Promise<PeerInfo[]> {
    const targetHash = this.hashTaskRequirements(task.requirements);
    const candidateNodes = await this.performNodeLookup(targetHash);
    
    // Filter peers based on task requirements
    const suitablePeers = candidateNodes
      .map(node => this.networkManager.getPeerInfo(node.id))
      .filter((peer): peer is PeerInfo => peer !== undefined)
      .filter(peer => this.canPeerHandleTask(peer, task.requirements))
      .sort((a, b) => this.calculatePeerScore(b, task) - this.calculatePeerScore(a, task));

    return suitablePeers.slice(0, 10); // Return top 10 candidates
  }

  private async performNodeLookup(targetHash: string): Promise<DHTNode[]> {
    const visited = new Set<string>();
    const candidates = new Set<DHTNode>();
    
    // Start with closest known nodes
    const initialNodes = this.getClosestNodes(targetHash, this.alpha);
    const activeQueries = new Map<string, Promise<DHTNode[]>>();

    for (const node of initialNodes) {
      if (!visited.has(node.id)) {
        visited.add(node.id);
        activeQueries.set(node.id, this.queryNode(node.id, targetHash));
      }
    }

    while (activeQueries.size > 0) {
      const results = await Promise.allSettled(Array.from(activeQueries.values()));
      activeQueries.clear();

      for (const result of results) {
        if (result.status === 'fulfilled') {
          for (const node of result.value) {
            candidates.add(node);
            
            if (!visited.has(node.id) && activeQueries.size < this.alpha) {
              visited.add(node.id);
              activeQueries.set(node.id, this.queryNode(node.id, targetHash));
            }
          }
        }
      }

      // Stop if we have enough candidates or no more queries
      if (candidates.size >= this.k || activeQueries.size === 0) {
        break;
      }
    }

    return Array.from(candidates)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, this.k);
  }

  private async queryNode(nodeId: string, targetHash: string): Promise<DHTNode[]> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Query timeout')), 5000);
      
      const messageId = this.networkManager.sendMessage(nodeId, {
        type: 'peer_discovery',
        to: nodeId,
        data: { 
          query: 'find_node',
          target: targetHash,
          requestId: this.generateRequestId()
        }
      });

      if (!messageId) {
        clearTimeout(timeout);
        reject(new Error('Failed to send query'));
        return;
      }

      const handler = (message: MessagePacket) => {
        if (message.type === 'peer_discovery' && 
            message.data.requestId === message.data.requestId) {
          clearTimeout(timeout);
          this.networkManager.off('message', handler);
          resolve(message.data.nodes || []);
        }
      };

      this.networkManager.on('message', handler);
    });
  }

  private getClosestNodes(targetHash: string, count: number): DHTNode[] {
    const allNodes: DHTNode[] = [];
    
    for (const bucket of this.routingTable.buckets.values()) {
      allNodes.push(...bucket);
    }

    return allNodes
      .map(node => ({
        ...node,
        distance: this.calculateXORDistance(targetHash, node.id)
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, count);
  }

  private async assignTask(task: TaskRequest, candidates: PeerInfo[]): Promise<TaskAssignment> {
    // Select primary assignee and backup peers
    const primaryPeer = candidates[0];
    const backupPeers = candidates.slice(1, 4).map(peer => peer.id);

    const assignment: TaskAssignment = {
      taskId: task.id,
      assignedTo: primaryPeer.id,
      assignedAt: Date.now(),
      expectedCompletion: Date.now() + task.requirements.estimatedDuration,
      backupPeers
    };

    return assignment;
  }

  private async broadcastTaskAssignment(assignment: TaskAssignment): Promise<void> {
    const message = {
      type: 'task_request' as const,
      to: assignment.assignedTo,
      data: {
        assignment,
        task: this.activeTasks.get(assignment.taskId)
      }
    };

    this.networkManager.sendMessage(assignment.assignedTo, message);

    // Notify backup peers
    for (const backupPeerId of assignment.backupPeers) {
      this.networkManager.sendMessage(backupPeerId, {
        type: 'task_request' as const,
        to: backupPeerId,
        data: {
          assignment,
          task: this.activeTasks.get(assignment.taskId),
          isBackup: true
        }
      });
    }
  }

  private async executeTask(task: TaskRequest): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Execute task based on type
      let result: any;
      
      switch (task.type) {
        case 'compute':
          result = await this.executeComputeTask(task.payload);
          break;
        case 'ai_inference':
          result = await this.executeAIInferenceTask(task.payload);
          break;
        case 'storage':
          result = await this.executeStorageTask(task.payload);
          break;
        case 'network':
          result = await this.executeNetworkTask(task.payload);
          break;
        default:
          throw new Error(`Unsupported task type: ${task.type}`);
      }

      const executionTime = Date.now() - startTime;
      
      return {
        success: true,
        result,
        executionTime,
        timestamp: Date.now()
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
        timestamp: Date.now()
      };
    }
  }

  private async executeComputeTask(payload: any): Promise<any> {
    // Implementation for compute tasks (mathematical calculations, data processing)
    const { operation, data } = payload;
    
    switch (operation) {
      case 'hash':
        return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
      case 'sort':
        return Array.isArray(data) ? data.sort() : data;
      case 'sum':
        return Array.isArray(data) ? data.reduce((sum, val) => sum + val, 0) : 0;
      default:
        throw new Error(`Unsupported compute operation: ${operation}`);
    }
  }

  private async executeAIInferenceTask(payload: any): Promise<any> {
    // Implementation for AI inference tasks
    const { model, input } = payload;
    
    // This would integrate with actual AI models in production
    return {
      model,
      input,
      prediction: `Mock prediction for ${JSON.stringify(input)}`,
      confidence: Math.random()
    };
  }

  private async executeStorageTask(payload: any): Promise<any> {
    // Implementation for distributed storage tasks
    const { operation, key, value } = payload;
    
    switch (operation) {
      case 'store':
        // Store data (would use actual storage in production)
        return { key, stored: true, timestamp: Date.now() };
      case 'retrieve':
        // Retrieve data
        return { key, value: `Retrieved value for ${key}`, timestamp: Date.now() };
      default:
        throw new Error(`Unsupported storage operation: ${operation}`);
    }
  }

  private async executeNetworkTask(payload: any): Promise<any> {
    // Implementation for network tasks (relay, validation, etc.)
    const { operation, data } = payload;
    
    switch (operation) {
      case 'relay':
        return { relayed: true, data, timestamp: Date.now() };
      case 'validate':
        return { valid: true, data, timestamp: Date.now() };
      default:
        throw new Error(`Unsupported network operation: ${operation}`);
    }
  }

  private async submitTaskResult(taskId: string, result: any): Promise<void> {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const taskResult: TaskResult = {
      taskId,
      result: result.result,
      completedBy: this.localNodeId,
      completedAt: Date.now(),
      executionTime: result.executionTime,
      resourceUsage: {
        cpuUsage: 0, // Would be measured in production
        memoryUsage: 0,
        networkUsage: 0
      }
    };

    this.completedTasks.set(taskId, taskResult);
    this.activeTasks.delete(taskId);
    this.taskAssignments.delete(taskId);

    // Send result to task submitter
    this.networkManager.sendMessage(task.submittedBy, {
      type: 'task_result',
      to: task.submittedBy,
      data: { taskResult }
    });

    this.emit('task_completed', { taskId, result: taskResult });
  }

  private async reportTaskFailure(taskId: string, error: any): Promise<void> {
    const assignment = this.taskAssignments.get(taskId);
    const task = this.activeTasks.get(taskId);
    
    if (!assignment || !task) return;

    // Try reassigning to backup peer
    if (assignment.backupPeers.length > 0) {
      const newAssignee = assignment.backupPeers[0];
      const newAssignment: TaskAssignment = {
        ...assignment,
        assignedTo: newAssignee,
        assignedAt: Date.now(),
        backupPeers: assignment.backupPeers.slice(1)
      };

      this.taskAssignments.set(taskId, newAssignment);
      await this.broadcastTaskAssignment(newAssignment);
      
      this.emit('task_reassigned', { taskId, newAssignment });
    } else {
      // No backup peers available, mark task as failed
      this.activeTasks.delete(taskId);
      this.taskAssignments.delete(taskId);
      
      this.networkManager.sendMessage(task.submittedBy, {
        type: 'task_result',
        to: task.submittedBy,
        data: {
          taskResult: {
            taskId,
            result: null,
            completedBy: this.localNodeId,
            completedAt: Date.now(),
            executionTime: 0,
            resourceUsage: { cpuUsage: 0, memoryUsage: 0, networkUsage: 0 },
            error: error instanceof Error ? error.message : 'Task failed'
          }
        }
      });
      
      this.emit('task_failed', { taskId, error });
    }
  }

  private canPeerHandleTask(peer: PeerInfo, requirements: TaskRequest['requirements']): boolean {
    const caps = peer.capabilities;
    
    return (
      caps.cpuCores >= requirements.cpuCores &&
      caps.ramGB >= requirements.memoryGB &&
      (!requirements.gpuRequired || caps.gpuAcceleration) &&
      caps.thermalState !== 'critical' &&
      peer.reputation >= 0.5 // Minimum reputation threshold
    );
  }

  private calculatePeerScore(peer: PeerInfo, task: TaskRequest): number {
    const caps = peer.capabilities;
    const req = task.requirements;
    
    // Base score from capabilities
    let score = 0;
    score += Math.min(caps.cpuCores / req.cpuCores, 2) * 30;
    score += Math.min(caps.ramGB / req.memoryGB, 2) * 25;
    score += peer.reputation * 20;
    score += (peer.latency < 100 ? 15 : peer.latency < 200 ? 10 : 5);
    
    // Thermal state bonus/penalty
    const thermalScores = { nominal: 10, fair: 5, serious: -5, critical: -20 };
    score += thermalScores[caps.thermalState] || 0;
    
    return Math.max(0, score);
  }

  private hashTaskRequirements(requirements: TaskRequest['requirements']): string {
    const data = JSON.stringify(requirements);
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private calculateXORDistance(hash1: string, hash2: string): number {
    const buf1 = Buffer.from(hash1, 'hex');
    const buf2 = Buffer.from(hash2, 'hex');
    let distance = 0;
    
    for (let i = 0; i < Math.min(buf1.length, buf2.length); i++) {
      distance += this.popcount(buf1[i] ^ buf2[i]);
    }
    
    return distance;
  }

  private popcount(n: number): number {
    let count = 0;
    while (n) {
      count += n & 1;
      n >>= 1;
    }
    return count;
  }

  private initializeRoutingTable(): void {
    // Initialize empty buckets for 160-bit address space
    for (let i = 0; i < 160; i++) {
      this.routingTable.buckets.set(i, []);
    }
  }

  private async bootstrapDHT(): Promise<void> {
    // In production, would connect to known bootstrap nodes
    const connectedPeers = this.networkManager.getConnectedPeers();
    
    for (const peerId of connectedPeers) {
      await this.addNodeToRoutingTable(peerId);
    }
  }

  private async addNodeToRoutingTable(nodeId: string): Promise<void> {
    const peer = this.networkManager.getPeerInfo(nodeId);
    if (!peer) return;

    const distance = this.calculateXORDistance(this.localNodeId, nodeId);
    const bucketIndex = Math.floor(Math.log2(distance + 1));
    const bucket = this.routingTable.buckets.get(bucketIndex) || [];

    const dhtNode: DHTNode = {
      id: nodeId,
      distance,
      lastSeen: Date.now(),
      capabilities: peer.capabilities,
      reputation: peer.reputation
    };

    // Add or update node in bucket
    const existingIndex = bucket.findIndex(node => node.id === nodeId);
    if (existingIndex >= 0) {
      bucket[existingIndex] = dhtNode;
    } else if (bucket.length < this.k) {
      bucket.push(dhtNode);
    } else {
      // Bucket full, ping least recently seen node
      const lruNode = bucket.reduce((oldest, node) => 
        node.lastSeen < oldest.lastSeen ? node : oldest
      );
      
      // Replace LRU node if it's unreachable
      const isReachable = await this.pingNode(lruNode.id);
      if (!isReachable) {
        const lruIndex = bucket.findIndex(node => node.id === lruNode.id);
        bucket[lruIndex] = dhtNode;
      }
    }

    this.routingTable.buckets.set(bucketIndex, bucket);
  }

  private async pingNode(nodeId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 3000);
      
      const success = this.networkManager.sendMessage(nodeId, {
        type: 'ping',
        to: nodeId,
        data: { timestamp: Date.now() }
      });
      
      if (!success) {
        clearTimeout(timeout);
        resolve(false);
        return;
      }

      const handler = (message: MessagePacket) => {
        if (message.type === 'pong' && message.from === nodeId) {
          clearTimeout(timeout);
          this.networkManager.off('message', handler);
          resolve(true);
        }
      };

      this.networkManager.on('message', handler);
    });
  }

  private startBucketRefresh(): void {
    this.bucketRefreshInterval = setInterval(async () => {
      await this.refreshBuckets();
    }, 60000); // Refresh every minute
  }

  private async refreshBuckets(): Promise<void> {
    const now = Date.now();
    const staleThreshold = 300000; // 5 minutes

    for (const [bucketIndex, bucket] of this.routingTable.buckets.entries()) {
      const staleBucket = bucket.filter(node => now - node.lastSeen > staleThreshold);
      
      if (staleBucket.length > 0) {
        // Refresh bucket by looking up random ID in bucket range
        const randomId = this.generateRandomIdInBucket(bucketIndex);
        await this.performNodeLookup(randomId);
      }
    }
  }

  private generateRandomIdInBucket(bucketIndex: number): string {
    const buffer = crypto.randomBytes(20); // 160 bits
    
    // Set appropriate prefix for bucket
    const prefixBits = 160 - bucketIndex;
    if (prefixBits < 160) {
      const localBuffer = Buffer.from(this.localNodeId, 'hex');
      for (let i = 0; i < Math.floor(prefixBits / 8); i++) {
        buffer[i] = localBuffer[i];
      }
    }
    
    return buffer.toString('hex');
  }

  private setTaskTimeout(taskId: string): void {
    setTimeout(() => {
      if (this.activeTasks.has(taskId)) {
        this.reportTaskFailure(taskId, new Error('Task timeout'));
      }
    }, this.taskTimeout);
  }

  private setupNetworkEventHandlers(): void {
    this.networkManager.on('peer_connected', (peerId: string) => {
      this.addNodeToRoutingTable(peerId);
    });

    this.networkManager.on('peer_disconnected', (peerId: string) => {
      this.removeNodeFromRoutingTable(peerId);
    });

    this.networkManager.on('message', (message: MessagePacket) => {
      this.handleDHTMessage(message);
    });
  }

  private removeNodeFromRoutingTable(nodeId: string): void {
    for (const bucket of this.routingTable.buckets.values()) {
      const index = bucket.findIndex(node => node.id === nodeId);
      if (index >= 0) {
        bucket.splice(index, 1);
        break;
      }
    }
  }

  private handleDHTMessage(message: MessagePacket): void {
    switch (message.type) {
      case 'task_request':
        this.handleIncomingTaskRequest(message);
        break;
      case 'task_result':
        this.handleTaskResult(message);
        break;
      case 'peer_discovery':
        this.handlePeerDiscoveryRequest(message);
        break;
    }
  }

  private handleIncomingTaskRequest(message: MessagePacket): void {
    const { assignment, task, isBackup } = message.data;
    
    if (assignment.assignedTo === this.localNodeId) {
      this.emit('task_received', { task, assignment, isBackup });
    }
  }

  private handleTaskResult(message: MessagePacket): void {
    const { taskResult } = message.data;
    this.emit('task_result_received', taskResult);
  }

  private handlePeerDiscoveryRequest(message: MessagePacket): void {
    const { query, target, requestId } = message.data;
    
    if (query === 'find_node') {
      const closestNodes = this.getClosestNodes(target, this.k);
      
      this.networkManager.sendMessage(message.from, {
        type: 'peer_discovery',
        to: message.from,
        data: {
          requestId,
          nodes: closestNodes
        }
      });
    }
  }

  private generateTaskId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generateRequestId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  // Public API methods
  public getActiveTasks(): TaskRequest[] {
    return Array.from(this.activeTasks.values());
  }

  public getCompletedTasks(): TaskResult[] {
    return Array.from(this.completedTasks.values());
  }

  public getTaskAssignments(): TaskAssignment[] {
    return Array.from(this.taskAssignments.values());
  }

  public getRoutingTableStats(): {
    totalNodes: number;
    bucketsUsed: number;
    averageNodesPerBucket: number;
  } {
    let totalNodes = 0;
    let bucketsUsed = 0;

    for (const bucket of this.routingTable.buckets.values()) {
      if (bucket.length > 0) {
        totalNodes += bucket.length;
        bucketsUsed++;
      }
    }

    return {
      totalNodes,
      bucketsUsed,
      averageNodesPerBucket: bucketsUsed > 0 ? totalNodes / bucketsUsed : 0
    };
  }

  public async shutdown(): Promise<void> {
    if (this.bucketRefreshInterval) {
      clearInterval(this.bucketRefreshInterval);
      this.bucketRefreshInterval = null;
    }

    this.isInitialized = false;
    this.emit('shutdown');
  }
} 