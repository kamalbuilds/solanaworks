import { EventEmitter } from 'events';
import { P2PNetworkManager, PeerInfo, MessagePacket } from './P2PNetworkManager';
import { TaskRequest, TaskResult, TaskAssignment } from './DHTTaskDistribution';
import { PublicKey, Keypair } from '@solana/web3.js';
import crypto from 'crypto';
import * as nacl from 'tweetnacl';

export interface VerificationRequest {
  id: string;
  taskId: string;
  result: TaskResult;
  submittedBy: string;
  timestamp: number;
  requiredVerifiers: number;
  verificationDeadline: number;
  signature?: string;
}

export interface VerificationResponse {
  verificationId: string;
  verifierId: string;
  taskId: string;
  isValid: boolean;
  confidence: number;
  details: {
    resultHash: string;
    executionTimeValid: boolean;
    resourceUsageValid: boolean;
    outputValid: boolean;
  };
  timestamp: number;
  signature?: string;
}

export interface VerificationResult {
  verificationId: string;
  taskId: string;
  consensus: 'approved' | 'rejected' | 'pending';
  verifierCount: number;
  approvalCount: number;
  rejectionCount: number;
  averageConfidence: number;
  consensusReached: boolean;
  finalizedAt: number;
  verifications: VerificationResponse[];
}

export interface ReputationScore {
  peerId: string;
  score: number;
  totalVerifications: number;
  correctVerifications: number;
  falsePositives: number;
  falseNegatives: number;
  lastUpdated: number;
}

export class TaskVerification extends EventEmitter {
  private networkManager: P2PNetworkManager;
  private localKeypair: Keypair;
  private pendingVerifications: Map<string, VerificationRequest> = new Map();
  private verificationResults: Map<string, VerificationResult> = new Map();
  private completedVerifications: Map<string, VerificationResult> = new Map();
  private reputationScores: Map<string, ReputationScore> = new Map();
  private verificationTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private consensusThreshold = 0.67; // 67% consensus required
  private minVerifiers = 3; // Minimum number of verifiers
  private maxVerifiers = 7; // Maximum number of verifiers
  private verificationTimeout = 60000; // 1 minute timeout
  private isInitialized = false;

  constructor(networkManager: P2PNetworkManager, localKeypair: Keypair) {
    super();
    this.networkManager = networkManager;
    this.localKeypair = localKeypair;
    this.setupNetworkEventHandlers();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize reputation system
      this.initializeReputationSystem();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log('Task Verification system initialized');
    } catch (error) {
      console.error('Failed to initialize Task Verification:', error);
      throw error;
    }
  }

  async requestVerification(
    taskId: string, 
    result: TaskResult, 
    originalTask: TaskRequest
  ): Promise<string> {
    const verificationId = this.generateVerificationId();
    
    // Select verifiers based on reputation and availability
    const verifiers = await this.selectVerifiers(originalTask, result.completedBy);
    
    if (verifiers.length < this.minVerifiers) {
      throw new Error('Insufficient verifiers available');
    }

    const verificationRequest: VerificationRequest = {
      id: verificationId,
      taskId,
      result,
      submittedBy: result.completedBy,
      timestamp: Date.now(),
      requiredVerifiers: Math.min(verifiers.length, this.maxVerifiers),
      verificationDeadline: Date.now() + this.verificationTimeout
    };

    // Sign the verification request
    verificationRequest.signature = this.signData(verificationRequest);

    this.pendingVerifications.set(verificationId, verificationRequest);

    // Initialize verification result
    const verificationResult: VerificationResult = {
      verificationId,
      taskId,
      consensus: 'pending',
      verifierCount: 0,
      approvalCount: 0,
      rejectionCount: 0,
      averageConfidence: 0,
      consensusReached: false,
      finalizedAt: 0,
      verifications: []
    };

    this.verificationResults.set(verificationId, verificationResult);

    // Send verification requests to selected verifiers
    await this.broadcastVerificationRequest(verificationRequest, verifiers);

    // Set timeout for verification
    this.setVerificationTimeout(verificationId);

    this.emit('verification_requested', { verificationId, verifiers: verifiers.length });
    return verificationId;
  }

  async performVerification(verificationRequest: VerificationRequest): Promise<VerificationResponse> {
    const { taskId, result } = verificationRequest;
    
    try {
      // Verify the result through re-execution or validation
      const verificationDetails = await this.verifyTaskResult(result);
      
      // Calculate confidence based on verification details
      const confidence = this.calculateVerificationConfidence(verificationDetails);
      
      // Determine if result is valid
      const isValid = confidence >= 0.7 && verificationDetails.outputValid;

      const verification: VerificationResponse = {
        verificationId: verificationRequest.id,
        verifierId: this.localKeypair.publicKey.toString(),
        taskId,
        isValid,
        confidence,
        details: verificationDetails,
        timestamp: Date.now()
      };

      // Sign the verification response
      verification.signature = this.signData(verification);

      return verification;
      
    } catch (error) {
      console.error(`Failed to verify task ${taskId}:`, error);
      
      // Return negative verification on error
      return {
        verificationId: verificationRequest.id,
        verifierId: this.localKeypair.publicKey.toString(),
        taskId,
        isValid: false,
        confidence: 0,
        details: {
          resultHash: '',
          executionTimeValid: false,
          resourceUsageValid: false,
          outputValid: false
        },
        timestamp: Date.now(),
        signature: ''
      };
    }
  }

  async submitVerification(verification: VerificationResponse): Promise<void> {
    const verificationRequest = this.pendingVerifications.get(verification.verificationId);
    if (!verificationRequest) {
      throw new Error(`Verification request ${verification.verificationId} not found`);
    }

    // Send verification response back to requester
    const message = {
      type: 'verification_request' as const,
      to: verificationRequest.submittedBy,
      data: { verification }
    };

    this.networkManager.sendMessage(verificationRequest.submittedBy, message);
    
    this.emit('verification_submitted', verification);
  }

  async processVerificationResponse(verification: VerificationResponse): Promise<void> {
    const verificationResult = this.verificationResults.get(verification.verificationId);
    if (!verificationResult) {
      console.warn(`Verification result ${verification.verificationId} not found`);
      return;
    }

    // Validate signature
    if (!this.verifySignature(verification, verification.signature || '')) {
      console.warn(`Invalid signature for verification from ${verification.verifierId}`);
      return;
    }

    // Check if verifier is authorized
    const verifierInfo = this.networkManager.getPeerInfo(verification.verifierId);
    if (!verifierInfo) {
      console.warn(`Unknown verifier ${verification.verifierId}`);
      return;
    }

    // Check for duplicate verification from same peer
    const existingVerification = verificationResult.verifications.find(
      v => v.verifierId === verification.verifierId
    );
    
    if (existingVerification) {
      console.warn(`Duplicate verification from ${verification.verifierId}`);
      return;
    }

    // Add verification to result
    verificationResult.verifications.push(verification);
    verificationResult.verifierCount = verificationResult.verifications.length;

    // Update counts
    if (verification.isValid) {
      verificationResult.approvalCount++;
    } else {
      verificationResult.rejectionCount++;
    }

    // Calculate average confidence
    const totalConfidence = verificationResult.verifications.reduce(
      (sum, v) => sum + v.confidence, 0
    );
    verificationResult.averageConfidence = totalConfidence / verificationResult.verifierCount;

    // Check for consensus
    const consensusReached = this.checkConsensus(verificationResult);
    
    if (consensusReached) {
      await this.finalizeVerification(verificationResult);
    }

    this.verificationResults.set(verification.verificationId, verificationResult);
    this.emit('verification_updated', verificationResult);
  }

  private async selectVerifiers(task: TaskRequest, excludePeer: string): Promise<PeerInfo[]> {
    const allPeers = this.networkManager.getAllPeers()
      .filter(peer => 
        peer.id !== excludePeer && 
        peer.status === 'connected' &&
        this.canPeerVerify(peer, task)
      );

    // Sort by reputation and capabilities
    const sortedPeers = allPeers.sort((a, b) => {
      const reputationA = this.getReputationScore(a.id);
      const reputationB = this.getReputationScore(b.id);
      
      // Weight by reputation and latency
      const scoreA = reputationA.score * 0.7 + (200 - a.latency) * 0.3;
      const scoreB = reputationB.score * 0.7 + (200 - b.latency) * 0.3;
      
      return scoreB - scoreA;
    });

    // Select top verifiers up to maxVerifiers
    return sortedPeers.slice(0, this.maxVerifiers);
  }

  private canPeerVerify(peer: PeerInfo, task: TaskRequest): boolean {
    const caps = peer.capabilities;
    const req = task.requirements;
    
    return (
      caps.cpuCores >= Math.ceil(req.cpuCores * 0.5) && // Need at least 50% of original requirements
      caps.ramGB >= Math.ceil(req.memoryGB * 0.5) &&
      caps.thermalState !== 'critical' &&
      peer.reputation >= 0.3 // Minimum reputation for verification
    );
  }

  private async verifyTaskResult(result: TaskResult): Promise<VerificationResponse['details']> {
    // Hash the result for verification
    const resultHash = crypto.createHash('sha256')
      .update(JSON.stringify(result.result))
      .digest('hex');

    // Verify execution time is reasonable
    const executionTimeValid = this.verifyExecutionTime(result);
    
    // Verify resource usage is realistic
    const resourceUsageValid = this.verifyResourceUsage(result);
    
    // Verify output validity (this would involve re-execution or validation logic)
    const outputValid = await this.verifyOutput(result);

    return {
      resultHash,
      executionTimeValid,
      resourceUsageValid,
      outputValid
    };
  }

  private verifyExecutionTime(result: TaskResult): boolean {
    // Check if execution time is within reasonable bounds
    const minTime = 100; // 100ms minimum
    const maxTime = 300000; // 5 minutes maximum
    
    return result.executionTime >= minTime && result.executionTime <= maxTime;
  }

  private verifyResourceUsage(result: TaskResult): boolean {
    const usage = result.resourceUsage;
    
    // Check if resource usage values are realistic
    return (
      usage.cpuUsage >= 0 && usage.cpuUsage <= 100 &&
      usage.memoryUsage >= 0 && usage.memoryUsage <= 100 &&
      usage.networkUsage >= 0
    );
  }

  private async verifyOutput(result: TaskResult): Promise<boolean> {
    try {
      // This would involve actual verification logic based on task type
      // For now, we'll do basic validation
      
      if (result.result === null || result.result === undefined) {
        return false;
      }

      // Check for common invalid patterns
      const resultStr = JSON.stringify(result.result);
      const invalidPatterns = ['error', 'failed', 'timeout'];
      
      return !invalidPatterns.some(pattern => 
        resultStr.toLowerCase().includes(pattern)
      );
      
    } catch (error) {
      return false;
    }
  }

  private calculateVerificationConfidence(details: VerificationResponse['details']): number {
    let confidence = 0;
    
    if (details.outputValid) confidence += 0.4;
    if (details.executionTimeValid) confidence += 0.2;
    if (details.resourceUsageValid) confidence += 0.2;
    if (details.resultHash) confidence += 0.2;
    
    return Math.min(1.0, confidence);
  }

  private checkConsensus(verificationResult: VerificationResult): boolean {
    const totalVerifications = verificationResult.verifierCount;
    const requiredVerifications = Math.min(
      this.minVerifiers,
      Math.ceil(totalVerifications * this.consensusThreshold)
    );

    if (totalVerifications < requiredVerifications) {
      return false;
    }

    // Check for approval consensus
    const approvalRatio = verificationResult.approvalCount / totalVerifications;
    const rejectionRatio = verificationResult.rejectionCount / totalVerifications;

    if (approvalRatio >= this.consensusThreshold) {
      verificationResult.consensus = 'approved';
      return true;
    } else if (rejectionRatio >= this.consensusThreshold) {
      verificationResult.consensus = 'rejected';
      return true;
    }

    return false;
  }

  private async finalizeVerification(verificationResult: VerificationResult): Promise<void> {
    verificationResult.consensusReached = true;
    verificationResult.finalizedAt = Date.now();

    // Clear timeout
    const timeout = this.verificationTimeouts.get(verificationResult.verificationId);
    if (timeout) {
      clearTimeout(timeout);
      this.verificationTimeouts.delete(verificationResult.verificationId);
    }

    // Update reputation scores for verifiers
    await this.updateReputationScores(verificationResult);

    // Move to completed verifications
    this.completedVerifications.set(verificationResult.verificationId, verificationResult);
    this.verificationResults.delete(verificationResult.verificationId);
    this.pendingVerifications.delete(verificationResult.verificationId);

    this.emit('verification_finalized', verificationResult);
  }

  private async updateReputationScores(verificationResult: VerificationResult): Promise<void> {
    const majorityVerification = verificationResult.consensus === 'approved';
    
    for (const verification of verificationResult.verifications) {
      const peerId = verification.verifierId;
      const reputation = this.getReputationScore(peerId);
      
      // Update verification counts
      reputation.totalVerifications++;
      
      // Check if verification matched the consensus
      const verificationCorrect = verification.isValid === majorityVerification;
      
      if (verificationCorrect) {
        reputation.correctVerifications++;
      } else {
        if (verification.isValid && !majorityVerification) {
          reputation.falsePositives++;
        } else if (!verification.isValid && majorityVerification) {
          reputation.falseNegatives++;
        }
      }

      // Calculate new reputation score
      const accuracy = reputation.correctVerifications / reputation.totalVerifications;
      const errorRate = (reputation.falsePositives + reputation.falseNegatives) / reputation.totalVerifications;
      
      reputation.score = Math.max(0, Math.min(1, accuracy - errorRate * 0.5));
      reputation.lastUpdated = Date.now();

      this.reputationScores.set(peerId, reputation);
    }
  }

  private getReputationScore(peerId: string): ReputationScore {
    if (!this.reputationScores.has(peerId)) {
      this.reputationScores.set(peerId, {
        peerId,
        score: 0.5, // Start with neutral reputation
        totalVerifications: 0,
        correctVerifications: 0,
        falsePositives: 0,
        falseNegatives: 0,
        lastUpdated: Date.now()
      });
    }
    
    return this.reputationScores.get(peerId)!;
  }

  private async broadcastVerificationRequest(
    request: VerificationRequest,
    verifiers: PeerInfo[]
  ): Promise<void> {
    const message = {
      type: 'verification_request' as const,
      data: { verificationRequest: request }
    };

    for (const verifier of verifiers) {
      this.networkManager.sendMessage(verifier.id, {
        ...message,
        to: verifier.id
      });
    }
  }

  private setVerificationTimeout(verificationId: string): void {
    const timeout = setTimeout(async () => {
      await this.handleVerificationTimeout(verificationId);
    }, this.verificationTimeout);

    this.verificationTimeouts.set(verificationId, timeout);
  }

  private async handleVerificationTimeout(verificationId: string): Promise<void> {
    const verificationResult = this.verificationResults.get(verificationId);
    if (!verificationResult || verificationResult.consensusReached) {
      return;
    }

    // Force finalization with available verifications
    if (verificationResult.verifierCount >= this.minVerifiers) {
      await this.finalizeVerification(verificationResult);
    } else {
      // Insufficient verifications - mark as failed
      verificationResult.consensus = 'rejected';
      verificationResult.consensusReached = true;
      verificationResult.finalizedAt = Date.now();
      
      this.completedVerifications.set(verificationId, verificationResult);
      this.verificationResults.delete(verificationId);
      this.pendingVerifications.delete(verificationId);
      
      this.emit('verification_timeout', verificationResult);
    }

    this.verificationTimeouts.delete(verificationId);
  }

  private signData(data: any): string {
    const dataString = JSON.stringify(data);
    const dataBuffer = new Uint8Array(Buffer.from(dataString, 'utf8'));
    const signature = nacl.sign.detached(dataBuffer, this.localKeypair.secretKey);
    return Buffer.from(signature).toString('base64');
  }

  private verifySignature(data: any, signature: string): boolean {
    try {
      const dataString = JSON.stringify(data);
      const dataBuffer = Buffer.from(dataString, 'utf8');
      const signatureBuffer = Buffer.from(signature, 'base64');
      
      // For now, assume signature is valid since we need peer's public key
      // In production, would verify against peer's public key
      return signature.length > 0;
    } catch (error) {
      return false;
    }
  }

  private initializeReputationSystem(): void {
    // Initialize reputation scores for known peers
    const connectedPeers = this.networkManager.getConnectedPeers();
    
    for (const peerId of connectedPeers) {
      this.getReputationScore(peerId);
    }
  }

  private setupNetworkEventHandlers(): void {
    this.networkManager.on('message', (message: MessagePacket) => {
      this.handleVerificationMessage(message);
    });

    this.networkManager.on('peer_connected', (peerId: string) => {
      this.getReputationScore(peerId);
    });
  }

  private async handleVerificationMessage(message: MessagePacket): Promise<void> {
    switch (message.type) {
      case 'verification_request':
        await this.handleIncomingVerificationRequest(message);
        break;
    }
  }

  private async handleIncomingVerificationRequest(message: MessagePacket): Promise<void> {
    const { verificationRequest, verification } = message.data;

    if (verificationRequest) {
      // Handle verification request
      try {
        const response = await this.performVerification(verificationRequest);
        await this.submitVerification(response);
      } catch (error) {
        console.error('Failed to handle verification request:', error);
      }
    } else if (verification) {
      // Handle verification response
      await this.processVerificationResponse(verification);
    }
  }

  private generateVerificationId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  // Public API methods
  public getVerificationResult(verificationId: string): VerificationResult | undefined {
    return this.verificationResults.get(verificationId) || 
           this.completedVerifications.get(verificationId);
  }

  public getPendingVerifications(): VerificationRequest[] {
    return Array.from(this.pendingVerifications.values());
  }

  public getCompletedVerifications(): VerificationResult[] {
    return Array.from(this.completedVerifications.values());
  }

  public getReputationScores(): ReputationScore[] {
    return Array.from(this.reputationScores.values());
  }

  public getVerificationStats(): {
    totalVerifications: number;
    pendingVerifications: number;
    completedVerifications: number;
    approvalRate: number;
    averageVerificationTime: number;
  } {
    const totalVerifications = this.completedVerifications.size;
    const pendingVerifications = this.pendingVerifications.size;
    const completedVerifications = this.completedVerifications.size;
    
    const approvedVerifications = Array.from(this.completedVerifications.values())
      .filter(v => v.consensus === 'approved').length;
    
    const approvalRate = totalVerifications > 0 ? approvedVerifications / totalVerifications : 0;
    
    const verificationTimes = Array.from(this.completedVerifications.values())
      .map(v => v.finalizedAt - (this.pendingVerifications.get(v.verificationId)?.timestamp || 0));
    
    const averageVerificationTime = verificationTimes.length > 0 
      ? verificationTimes.reduce((sum, time) => sum + time, 0) / verificationTimes.length 
      : 0;

    return {
      totalVerifications,
      pendingVerifications,
      completedVerifications,
      approvalRate,
      averageVerificationTime
    };
  }

  public async shutdown(): Promise<void> {
    // Clear all timeouts
    for (const timeout of this.verificationTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.verificationTimeouts.clear();

    this.isInitialized = false;
    this.emit('shutdown');
  }
} 