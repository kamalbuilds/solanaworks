import { EventEmitter } from 'events';
import { DeviceMonitor } from '../DeviceMonitor';
import { PerformanceAnalytics } from '../PerformanceAnalytics';
import { PublicKey } from '@solana/web3.js';

export interface PeerInfo {
  id: string;
  publicKey: PublicKey;
  capabilities: DeviceCapabilities;
  reputation: number;
  latency: number;
  lastSeen: Date;
  status: 'connecting' | 'connected' | 'disconnected' | 'failed';
}

export interface DeviceCapabilities {
  computeTier: 'low' | 'medium' | 'high' | 'premium';
  cpuCores: number;
  ramGB: number;
  gpuAcceleration: boolean;
  networkBandwidth: number;
  batteryLevel?: number;
  thermalState: 'nominal' | 'fair' | 'serious' | 'critical';
}

export interface MessagePacket {
  id: string;
  type: 'ping' | 'pong' | 'task_request' | 'task_response' | 'task_result' | 'peer_discovery' | 'verification_request';
  from: string;
  to: string;
  timestamp: number;
  data: any;
  signature?: string;
}

export class P2PNetworkManager extends EventEmitter {
  private peers: Map<string, PeerInfo> = new Map();
  private connections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private iceServers: RTCIceServer[];
  private localPeerId: string;
  private deviceMonitor: DeviceMonitor;
  private performanceAnalytics: PerformanceAnalytics;
  private messageHandlers: Map<string, (message: MessagePacket) => void> = new Map();
  private connectionAttempts: Map<string, number> = new Map();
  private maxConnectionAttempts = 3;
  private pingInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor(
    localPeerId: string,
    deviceMonitor: DeviceMonitor,
    performanceAnalytics: PerformanceAnalytics
  ) {
    super();
    this.localPeerId = localPeerId;
    this.deviceMonitor = deviceMonitor;
    this.performanceAnalytics = performanceAnalytics;

    // Production STUN/TURN servers for NAT traversal
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.stunprotocol.org' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ];

    this.setupMessageHandlers();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Start periodic peer maintenance
      this.startPeerMaintenance();
      
      // Register network event listeners
      this.setupNetworkEventListeners();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log(`P2P Network Manager initialized for peer: ${this.localPeerId}`);
    } catch (error) {
      console.error('Failed to initialize P2P Network Manager:', error);
      throw error;
    }
  }

  async connectToPeer(peerId: string, offer?: RTCSessionDescriptionInit): Promise<boolean> {
    if (this.connections.has(peerId)) {
      console.log(`Already connected to peer ${peerId}`);
      return true;
    }

    const attempts = this.connectionAttempts.get(peerId) || 0;
    if (attempts >= this.maxConnectionAttempts) {
      console.log(`Max connection attempts reached for peer ${peerId}`);
      return false;
    }

    this.connectionAttempts.set(peerId, attempts + 1);

    try {
      const connection = new RTCPeerConnection({
        iceServers: this.iceServers,
        iceCandidatePoolSize: 10
      });

      this.setupConnectionEventHandlers(connection, peerId);
      this.connections.set(peerId, connection);

      // Create data channel for communication
      const dataChannel = connection.createDataChannel('compute-network', {
        ordered: true,
        maxRetransmits: 3
      });

      this.setupDataChannelHandlers(dataChannel, peerId);
      this.dataChannels.set(peerId, dataChannel);

      if (offer) {
        // Answering peer
        await connection.setRemoteDescription(offer);
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        
        this.emit('connection_answer', { peerId, answer });
      } else {
        // Initiating peer
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        
        this.emit('connection_offer', { peerId, offer });
      }

      return true;
    } catch (error) {
      console.error(`Failed to connect to peer ${peerId}:`, error);
      this.cleanupPeerConnection(peerId);
      return false;
    }
  }

  async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const connection = this.connections.get(peerId);
    if (!connection) {
      throw new Error(`No connection found for peer ${peerId}`);
    }

    await connection.setRemoteDescription(answer);
  }

  async handleIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const connection = this.connections.get(peerId);
    if (!connection) {
      console.warn(`No connection found for ICE candidate from peer ${peerId}`);
      return;
    }

    await connection.addIceCandidate(candidate);
  }

  sendMessage(peerId: string, message: Omit<MessagePacket, 'from' | 'timestamp' | 'id'>): boolean {
    const dataChannel = this.dataChannels.get(peerId);
    if (!dataChannel || dataChannel.readyState !== 'open') {
      console.warn(`Cannot send message to peer ${peerId}: channel not open`);
      return false;
    }

    const packet: MessagePacket = {
      ...message,
      id: this.generateMessageId(),
      from: this.localPeerId,
      timestamp: Date.now()
    };

    try {
      dataChannel.send(JSON.stringify(packet));
      return true;
    } catch (error) {
      console.error(`Failed to send message to peer ${peerId}:`, error);
      return false;
    }
  }

  broadcastMessage(message: Omit<MessagePacket, 'from' | 'timestamp' | 'id' | 'to'>): number {
    let sentCount = 0;
    
    for (const peerId of this.getConnectedPeers()) {
      if (this.sendMessage(peerId, { ...message, to: peerId })) {
        sentCount++;
      }
    }

    return sentCount;
  }

  getConnectedPeers(): string[] {
    return Array.from(this.dataChannels.entries())
      .filter(([_, channel]) => channel.readyState === 'open')
      .map(([peerId, _]) => peerId);
  }

  getPeerInfo(peerId: string): PeerInfo | undefined {
    return this.peers.get(peerId);
  }

  getAllPeers(): PeerInfo[] {
    return Array.from(this.peers.values());
  }

  getNetworkStats(): {
    connectedPeers: number;
    totalPeers: number;
    averageLatency: number;
    networkHealth: number;
  } {
    const connectedPeers = this.getConnectedPeers().length;
    const totalPeers = this.peers.size;
    
    const latencies = Array.from(this.peers.values())
      .filter(peer => peer.status === 'connected')
      .map(peer => peer.latency);
    
    const averageLatency = latencies.length > 0 
      ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length 
      : 0;

    const networkHealth = totalPeers > 0 ? (connectedPeers / totalPeers) * 100 : 0;

    return {
      connectedPeers,
      totalPeers,
      averageLatency,
      networkHealth
    };
  }

  async getLocalCapabilities(): Promise<DeviceCapabilities> {
    const specs = this.deviceMonitor.getSystemInfo();
    const metrics = this.deviceMonitor.getCurrentMetrics();
    const profile = this.deviceMonitor.getPerformanceProfile();

    if (!specs || !metrics || !profile) {
      throw new Error('Device monitoring not initialized');
    }

    const thermalState = this.mapThermalState(metrics.thermalState);

    return {
      computeTier: profile.tier,
      cpuCores: specs.processorCount,
      ramGB: Math.round(specs.totalMemory / (1024 * 1024 * 1024)),
      gpuAcceleration: specs.hasGPU,
      networkBandwidth: metrics.networkSpeed || 0,
      batteryLevel: metrics.batteryLevel,
      thermalState
    };
  }

  disconnect(peerId: string): void {
    this.cleanupPeerConnection(peerId);
  }

  async shutdown(): Promise<void> {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Close all connections
    for (const peerId of Array.from(this.connections.keys())) {
      this.cleanupPeerConnection(peerId);
    }

    this.isInitialized = false;
    this.emit('shutdown');
  }

  private setupConnectionEventHandlers(connection: RTCPeerConnection, peerId: string): void {
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.emit('ice_candidate', { peerId, candidate: event.candidate });
      }
    };

    connection.onconnectionstatechange = () => {
      const state = connection.connectionState;
      console.log(`Connection state for peer ${peerId}: ${state}`);

      if (state === 'connected') {
        this.updatePeerStatus(peerId, 'connected');
        this.connectionAttempts.delete(peerId);
        this.emit('peer_connected', peerId);
      } else if (state === 'disconnected' || state === 'failed') {
        this.updatePeerStatus(peerId, state === 'failed' ? 'failed' : 'disconnected');
        this.emit('peer_disconnected', peerId);
        
        if (state === 'failed') {
          setTimeout(() => this.connectToPeer(peerId), 5000); // Retry after 5s
        }
      }
    };

    connection.ondatachannel = (event) => {
      this.setupDataChannelHandlers(event.channel, peerId);
      this.dataChannels.set(peerId, event.channel);
    };
  }

  private setupDataChannelHandlers(dataChannel: RTCDataChannel, peerId: string): void {
    dataChannel.onopen = () => {
      console.log(`Data channel opened for peer ${peerId}`);
      this.sendPing(peerId);
    };

    dataChannel.onmessage = (event) => {
      try {
        const message: MessagePacket = JSON.parse(event.data);
        this.handleIncomingMessage(message);
      } catch (error) {
        console.error(`Failed to parse message from peer ${peerId}:`, error);
      }
    };

    dataChannel.onerror = (error) => {
      console.error(`Data channel error for peer ${peerId}:`, error);
    };

    dataChannel.onclose = () => {
      console.log(`Data channel closed for peer ${peerId}`);
      this.cleanupPeerConnection(peerId);
    };
  }

  private setupMessageHandlers(): void {
    this.messageHandlers.set('ping', (message) => {
      this.sendMessage(message.from, {
        type: 'pong',
        to: message.from,
        data: { timestamp: message.timestamp }
      });
    });

    this.messageHandlers.set('pong', (message) => {
      const latency = Date.now() - message.data.timestamp;
      this.updatePeerLatency(message.from, latency);
    });

    this.messageHandlers.set('peer_discovery', (message) => {
      this.handlePeerDiscovery(message);
    });
  }

  private handleIncomingMessage(message: MessagePacket): void {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message);
    } else {
      this.emit('message', message);
    }

    // Update peer last seen
    const peer = this.peers.get(message.from);
    if (peer) {
      peer.lastSeen = new Date();
      this.peers.set(message.from, peer);
    }
  }

  private handlePeerDiscovery(message: MessagePacket): void {
    const { peers } = message.data;
    
    for (const peerInfo of peers) {
      if (peerInfo.id !== this.localPeerId && !this.peers.has(peerInfo.id)) {
        this.peers.set(peerInfo.id, {
          ...peerInfo,
          status: 'disconnected',
          lastSeen: new Date()
        });
        
        this.emit('peer_discovered', peerInfo);
      }
    }
  }

  private setupNetworkEventListeners(): void {
    // Handle network connectivity changes
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('Network back online, reconnecting peers...');
        this.reconnectPeers();
      });

      window.addEventListener('offline', () => {
        console.log('Network offline');
        this.emit('network_offline');
      });
    }
  }

  private startPeerMaintenance(): void {
    this.pingInterval = setInterval(() => {
      this.maintainConnections();
    }, 30000); // Every 30 seconds
  }

  private maintainConnections(): void {
    const now = Date.now();
    
    for (const [peerId, peer] of this.peers.entries()) {
      const timeSinceLastSeen = now - peer.lastSeen.getTime();
      
      // Ping connected peers
      if (peer.status === 'connected') {
        this.sendPing(peerId);
      }
      
      // Remove stale peers (no activity for 5 minutes)
      if (timeSinceLastSeen > 300000) {
        this.peers.delete(peerId);
        this.cleanupPeerConnection(peerId);
      }
    }
  }

  private sendPing(peerId: string): void {
    this.sendMessage(peerId, {
      type: 'ping',
      to: peerId,
      data: { timestamp: Date.now() }
    });
  }

  private updatePeerStatus(peerId: string, status: PeerInfo['status']): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.status = status;
      peer.lastSeen = new Date();
      this.peers.set(peerId, peer);
    }
  }

  private updatePeerLatency(peerId: string, latency: number): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.latency = latency;
      this.peers.set(peerId, peer);
    }
  }

  private async reconnectPeers(): Promise<void> {
    const disconnectedPeers = Array.from(this.peers.entries())
      .filter(([_, peer]) => peer.status === 'disconnected')
      .map(([peerId, _]) => peerId);

    for (const peerId of disconnectedPeers) {
      await this.connectToPeer(peerId);
      // Stagger reconnection attempts
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  private cleanupPeerConnection(peerId: string): void {
    const connection = this.connections.get(peerId);
    if (connection) {
      connection.close();
      this.connections.delete(peerId);
    }

    const dataChannel = this.dataChannels.get(peerId);
    if (dataChannel) {
      dataChannel.close();
      this.dataChannels.delete(peerId);
    }

    this.updatePeerStatus(peerId, 'disconnected');
  }

  private generateMessageId(): string {
    return `${this.localPeerId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private mapThermalState(thermalState: string): 'nominal' | 'fair' | 'serious' | 'critical' {
    switch (thermalState.toLowerCase()) {
      case 'nominal':
        return 'nominal';
      case 'fair':
        return 'fair';
      case 'serious':
        return 'serious';
      case 'critical':
        return 'critical';
      default:
        return 'nominal';
    }
  }
} 