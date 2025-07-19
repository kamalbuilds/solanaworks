import { EventEmitter } from 'events';
import { P2PNetworkManager, PeerInfo, MessagePacket, DeviceCapabilities } from './P2PNetworkManager';
import { PublicKey } from '@solana/web3.js';
import crypto from 'crypto';

export interface DiscoveryMethod {
  name: 'dht' | 'mdns' | 'bootstrap' | 'peer_exchange' | 'relay';
  enabled: boolean;
  priority: number;
  lastUsed: number;
  successRate: number;
}

export interface PeerAdvertisement {
  peerId: string;
  publicKey: PublicKey;
  capabilities: DeviceCapabilities;
  endpoints: string[];
  discoveryMethods: string[];
  timestamp: number;
  ttl: number;
  signature?: string;
}

export interface RoutingPath {
  destination: string;
  hops: string[];
  latency: number;
  reliability: number;
  lastUsed: number;
  usageCount: number;
}

export interface NetworkTopology {
  nodes: Map<string, PeerInfo>;
  connections: Map<string, Set<string>>;
  routingPaths: Map<string, RoutingPath[]>;
  lastUpdated: number;
}

export interface DiscoveryStats {
  totalPeersDiscovered: number;
  activePeers: number;
  discoveryMethods: Map<string, { attempts: number; successes: number; failures: number }>;
  averageDiscoveryTime: number;
  networkDensity: number;
}

export class PeerDiscovery extends EventEmitter {
  private networkManager: P2PNetworkManager;
  private localPeerId: string;
  private discoveryMethods: Map<string, DiscoveryMethod> = new Map();
  private knownPeers: Map<string, PeerAdvertisement> = new Map();
  private routingTable: NetworkTopology;
  private bootstrapNodes: string[] = [];
  private discoveryInterval: NodeJS.Timeout | null = null;
  private topologyUpdateInterval: NodeJS.Timeout | null = null;
  private discoveryStats: DiscoveryStats;
  private maxPeers = 100;
  private maxRoutingPaths = 5;
  private discoveryIntervalMs = 30000; // 30 seconds
  private topologyUpdateMs = 60000; // 1 minute
  private peerTimeout = 300000; // 5 minutes
  private isInitialized = false;

  constructor(networkManager: P2PNetworkManager, localPeerId: string) {
    super();
    this.networkManager = networkManager;
    this.localPeerId = localPeerId;
    
    this.routingTable = {
      nodes: new Map(),
      connections: new Map(),
      routingPaths: new Map(),
      lastUpdated: Date.now()
    };

    this.discoveryStats = {
      totalPeersDiscovered: 0,
      activePeers: 0,
      discoveryMethods: new Map(),
      averageDiscoveryTime: 0,
      networkDensity: 0
    };

    this.initializeDiscoveryMethods();
    this.setupNetworkEventHandlers();
  }

  async initialize(bootstrapNodes: string[] = []): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.bootstrapNodes = bootstrapNodes;
      
      // Start discovery processes
      await this.startDiscoveryProcess();
      
      // Start topology updates
      this.startTopologyUpdates();
      
      // Bootstrap network connection
      if (bootstrapNodes.length > 0) {
        await this.bootstrapFromNodes(bootstrapNodes);
      }
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log(`Peer Discovery initialized for node: ${this.localPeerId}`);
    } catch (error) {
      console.error('Failed to initialize Peer Discovery:', error);
      throw error;
    }
  }

  async discoverPeers(): Promise<PeerInfo[]> {
    const discoveredPeers: PeerInfo[] = [];
    const startTime = Date.now();

    // Try each discovery method based on priority
    const sortedMethods = Array.from(this.discoveryMethods.values())
      .filter(method => method.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const method of sortedMethods) {
      try {
        const peers = await this.executeDiscoveryMethod(method);
        discoveredPeers.push(...peers);
        
        // Update method success rate
        this.updateMethodStats(method.name, true);
        
        if (discoveredPeers.length >= this.maxPeers) {
          break;
        }
      } catch (error) {
        console.error(`Discovery method ${method.name} failed:`, error);
        this.updateMethodStats(method.name, false);
      }
    }

    // Update discovery stats
    const discoveryTime = Date.now() - startTime;
    this.updateDiscoveryStats(discoveredPeers.length, discoveryTime);

    // Filter out already known peers
    const newPeers = discoveredPeers.filter(peer => 
      !this.knownPeers.has(peer.id) && peer.id !== this.localPeerId
    );

    // Add new peers to known peers
    for (const peer of newPeers) {
      await this.addKnownPeer(peer);
    }

    this.emit('peers_discovered', { count: newPeers.length, peers: newPeers });
    return newPeers;
  }

  async connectToPeer(peerId: string): Promise<boolean> {
    const peerAd = this.knownPeers.get(peerId);
    if (!peerAd) {
      console.warn(`Peer ${peerId} not in known peers`);
      return false;
    }

    try {
      // Try direct connection first
      const connected = await this.networkManager.connectToPeer(peerId);
      
      if (connected) {
        this.updateRoutingTable(peerId, true);
        this.emit('peer_connected', peerId);
        return true;
      }

      // Try relay connection if direct fails
      const relayConnected = await this.connectViaRelay(peerId);
      if (relayConnected) {
        this.updateRoutingTable(peerId, true);
        this.emit('peer_connected', peerId);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`Failed to connect to peer ${peerId}:`, error);
      return false;
    }
  }

  async findOptimalPath(destinationPeerId: string): Promise<RoutingPath | null> {
    const paths = this.routingTable.routingPaths.get(destinationPeerId) || [];
    
    if (paths.length === 0) {
      // Try to discover new paths
      await this.discoverRoutingPaths(destinationPeerId);
      const newPaths = this.routingTable.routingPaths.get(destinationPeerId) || [];
      
      if (newPaths.length === 0) {
        return null;
      }
      
      return newPaths[0];
    }

    // Score paths based on latency, reliability, and recent usage
    const scoredPaths = paths.map(path => ({
      path,
      score: this.calculatePathScore(path)
    }));

    // Sort by score (higher is better)
    scoredPaths.sort((a, b) => b.score - a.score);
    
    return scoredPaths[0].path;
  }

  async advertiseSelf(): Promise<void> {
    const capabilities = await this.networkManager.getLocalCapabilities();
    
    const advertisement: PeerAdvertisement = {
      peerId: this.localPeerId,
      publicKey: new PublicKey(this.localPeerId), // In production, use actual public key
      capabilities,
      endpoints: [], // Would include WebRTC/libp2p endpoints
      discoveryMethods: Array.from(this.discoveryMethods.keys()),
      timestamp: Date.now(),
      ttl: this.peerTimeout
    };

    // Broadcast advertisement to connected peers
    const connectedPeers = this.networkManager.getConnectedPeers();
    
    for (const peerId of connectedPeers) {
      this.networkManager.sendMessage(peerId, {
        type: 'peer_discovery',
        to: peerId,
        data: { 
          type: 'advertisement', 
          advertisement 
        }
      });
    }

    this.emit('self_advertised', advertisement);
  }

  private async executeDiscoveryMethod(method: DiscoveryMethod): Promise<PeerInfo[]> {
    switch (method.name) {
      case 'dht':
        return await this.discoverViaDHT();
      case 'mdns':
        return await this.discoverViaMDNS();
      case 'bootstrap':
        return await this.discoverViaBootstrap();
      case 'peer_exchange':
        return await this.discoverViaPeerExchange();
      case 'relay':
        return await this.discoverViaRelay();
      default:
        return [];
    }
  }

  private async discoverViaDHT(): Promise<PeerInfo[]> {
    // Use DHT for peer discovery
    const connectedPeers = this.networkManager.getConnectedPeers();
    const discoveredPeers: PeerInfo[] = [];

    for (const peerId of connectedPeers) {
      try {
        const peers = await this.queryPeerForNeighbors(peerId);
        discoveredPeers.push(...peers);
      } catch (error) {
        console.warn(`Failed to query peer ${peerId} for neighbors:`, error);
      }
    }

    return this.deduplicatePeers(discoveredPeers);
  }

  private async discoverViaMDNS(): Promise<PeerInfo[]> {
    // Multicast DNS discovery for local network peers
    // In production, would use actual mDNS implementation
    console.log('mDNS discovery not implemented in demo');
    return [];
  }

  private async discoverViaBootstrap(): Promise<PeerInfo[]> {
    const discoveredPeers: PeerInfo[] = [];

    for (const bootstrapNode of this.bootstrapNodes) {
      try {
        if (!this.networkManager.getConnectedPeers().includes(bootstrapNode)) {
          const connected = await this.networkManager.connectToPeer(bootstrapNode);
          if (connected) {
            const peerInfo = this.networkManager.getPeerInfo(bootstrapNode);
            if (peerInfo) {
              discoveredPeers.push(peerInfo);
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to connect to bootstrap node ${bootstrapNode}:`, error);
      }
    }

    return discoveredPeers;
  }

  private async discoverViaPeerExchange(): Promise<PeerInfo[]> {
    // Exchange peer lists with connected peers
    const connectedPeers = this.networkManager.getConnectedPeers();
    const discoveredPeers: PeerInfo[] = [];

    for (const peerId of connectedPeers) {
      try {
        const peers = await this.requestPeerList(peerId);
        discoveredPeers.push(...peers);
      } catch (error) {
        console.warn(`Failed to exchange peers with ${peerId}:`, error);
      }
    }

    return this.deduplicatePeers(discoveredPeers);
  }

  private async discoverViaRelay(): Promise<PeerInfo[]> {
    // Discover peers through relay nodes
    const relayNodes = Array.from(this.knownPeers.values())
      .filter(peer => peer.capabilities.networkBandwidth > 10); // High bandwidth nodes as relays

    const discoveredPeers: PeerInfo[] = [];

    for (const relay of relayNodes.slice(0, 3)) { // Use top 3 relays
      try {
        const peers = await this.queryRelayForPeers(relay.peerId);
        discoveredPeers.push(...peers);
      } catch (error) {
        console.warn(`Failed to discover via relay ${relay.peerId}:`, error);
      }
    }

    return this.deduplicatePeers(discoveredPeers);
  }

  private async queryPeerForNeighbors(peerId: string): Promise<PeerInfo[]> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Query timeout')), 5000);
      
      const success = this.networkManager.sendMessage(peerId, {
        type: 'peer_discovery',
        to: peerId,
        data: { 
          type: 'neighbor_request',
          requestId: this.generateRequestId()
        }
      });

      if (!success) {
        clearTimeout(timeout);
        reject(new Error('Failed to send neighbor request'));
        return;
      }

      const handler = (message: MessagePacket) => {
        if (message.type === 'peer_discovery' && 
            message.data.type === 'neighbor_response' &&
            message.from === peerId) {
          clearTimeout(timeout);
          this.networkManager.off('message', handler);
          resolve(message.data.peers || []);
        }
      };

      this.networkManager.on('message', handler);
    });
  }

  private async requestPeerList(peerId: string): Promise<PeerInfo[]> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Peer list request timeout')), 5000);
      
      const success = this.networkManager.sendMessage(peerId, {
        type: 'peer_discovery',
        to: peerId,
        data: { 
          type: 'peer_list_request',
          requestId: this.generateRequestId()
        }
      });

      if (!success) {
        clearTimeout(timeout);
        reject(new Error('Failed to send peer list request'));
        return;
      }

      const handler = (message: MessagePacket) => {
        if (message.type === 'peer_discovery' && 
            message.data.type === 'peer_list_response' &&
            message.from === peerId) {
          clearTimeout(timeout);
          this.networkManager.off('message', handler);
          resolve(message.data.peers || []);
        }
      };

      this.networkManager.on('message', handler);
    });
  }

  private async queryRelayForPeers(relayId: string): Promise<PeerInfo[]> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Relay query timeout')), 5000);
      
      const success = this.networkManager.sendMessage(relayId, {
        type: 'peer_discovery',
        to: relayId,
        data: { 
          type: 'relay_discovery',
          requestId: this.generateRequestId()
        }
      });

      if (!success) {
        clearTimeout(timeout);
        reject(new Error('Failed to send relay discovery request'));
        return;
      }

      const handler = (message: MessagePacket) => {
        if (message.type === 'peer_discovery' && 
            message.data.type === 'relay_response' &&
            message.from === relayId) {
          clearTimeout(timeout);
          this.networkManager.off('message', handler);
          resolve(message.data.peers || []);
        }
      };

      this.networkManager.on('message', handler);
    });
  }

  private async connectViaRelay(targetPeerId: string): Promise<boolean> {
    const relayNodes = Array.from(this.knownPeers.values())
      .filter(peer => 
        peer.capabilities.networkBandwidth > 5 && 
        this.networkManager.getConnectedPeers().includes(peer.peerId)
      );

    for (const relay of relayNodes) {
      try {
        const connected = await this.requestRelayConnection(relay.peerId, targetPeerId);
        if (connected) {
          return true;
        }
      } catch (error) {
        console.warn(`Relay connection via ${relay.peerId} failed:`, error);
      }
    }

    return false;
  }

  private async requestRelayConnection(relayId: string, targetId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Relay connection timeout')), 10000);
      
      const success = this.networkManager.sendMessage(relayId, {
        type: 'peer_discovery',
        to: relayId,
        data: { 
          type: 'relay_connect',
          targetPeer: targetId,
          requestId: this.generateRequestId()
        }
      });

      if (!success) {
        clearTimeout(timeout);
        reject(new Error('Failed to send relay connection request'));
        return;
      }

      const handler = (message: MessagePacket) => {
        if (message.type === 'peer_discovery' && 
            message.data.type === 'relay_connect_response' &&
            message.from === relayId) {
          clearTimeout(timeout);
          this.networkManager.off('message', handler);
          resolve(message.data.success || false);
        }
      };

      this.networkManager.on('message', handler);
    });
  }

  private async addKnownPeer(peer: PeerInfo): Promise<void> {
    const advertisement: PeerAdvertisement = {
      peerId: peer.id,
      publicKey: peer.publicKey,
      capabilities: peer.capabilities,
      endpoints: [],
      discoveryMethods: ['dht'],
      timestamp: Date.now(),
      ttl: this.peerTimeout
    };

    this.knownPeers.set(peer.id, advertisement);
    this.routingTable.nodes.set(peer.id, peer);
    
    // Update discovery stats
    this.discoveryStats.totalPeersDiscovered++;
    this.updateNetworkDensity();
    
    this.emit('peer_added', peer);
  }

  private async discoverRoutingPaths(destinationPeerId: string): Promise<void> {
    const paths: RoutingPath[] = [];
    
    // Try direct path first
    if (this.networkManager.getConnectedPeers().includes(destinationPeerId)) {
      paths.push({
        destination: destinationPeerId,
        hops: [destinationPeerId],
        latency: this.networkManager.getPeerInfo(destinationPeerId)?.latency || 999,
        reliability: 0.9,
        lastUsed: 0,
        usageCount: 0
      });
    }

    // Find multi-hop paths
    const connectedPeers = this.networkManager.getConnectedPeers();
    
    for (const intermediatePeer of connectedPeers) {
      if (intermediatePeer === destinationPeerId) continue;
      
      try {
        const hasPath = await this.queryPathToDestination(intermediatePeer, destinationPeerId);
        if (hasPath) {
          const intermediateLatency = this.networkManager.getPeerInfo(intermediatePeer)?.latency || 999;
          
          paths.push({
            destination: destinationPeerId,
            hops: [intermediatePeer, destinationPeerId],
            latency: intermediateLatency + 100, // Estimate additional hop latency
            reliability: 0.7, // Lower reliability for multi-hop
            lastUsed: 0,
            usageCount: 0
          });
        }
      } catch (error) {
        console.warn(`Failed to query path via ${intermediatePeer}:`, error);
      }
    }

    // Sort paths by score and keep top paths
    const sortedPaths = paths
      .map(path => ({ path, score: this.calculatePathScore(path) }))
      .sort((a, b) => b.score - a.score)
      .map(item => item.path)
      .slice(0, this.maxRoutingPaths);

    this.routingTable.routingPaths.set(destinationPeerId, sortedPaths);
  }

  private async queryPathToDestination(intermediatePeer: string, destination: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Path query timeout')), 3000);
      
      const success = this.networkManager.sendMessage(intermediatePeer, {
        type: 'peer_discovery',
        to: intermediatePeer,
        data: { 
          type: 'path_query',
          destination,
          requestId: this.generateRequestId()
        }
      });

      if (!success) {
        clearTimeout(timeout);
        reject(new Error('Failed to send path query'));
        return;
      }

      const handler = (message: MessagePacket) => {
        if (message.type === 'peer_discovery' && 
            message.data.type === 'path_response' &&
            message.from === intermediatePeer) {
          clearTimeout(timeout);
          this.networkManager.off('message', handler);
          resolve(message.data.hasPath || false);
        }
      };

      this.networkManager.on('message', handler);
    });
  }

  private calculatePathScore(path: RoutingPath): number {
    const latencyScore = Math.max(0, 100 - path.latency) / 100;
    const reliabilityScore = path.reliability;
    const freshnessScore = Math.max(0, 1 - (Date.now() - path.lastUsed) / 86400000); // 24 hour decay
    const usageBonus = Math.min(0.2, path.usageCount * 0.01); // Small bonus for proven paths
    
    return (latencyScore * 0.4 + reliabilityScore * 0.4 + freshnessScore * 0.1 + usageBonus * 0.1);
  }

  private updateRoutingTable(peerId: string, connected: boolean): void {
    if (connected) {
      if (!this.routingTable.connections.has(this.localPeerId)) {
        this.routingTable.connections.set(this.localPeerId, new Set());
      }
      this.routingTable.connections.get(this.localPeerId)!.add(peerId);
    } else {
      this.routingTable.connections.get(this.localPeerId)?.delete(peerId);
    }
    
    this.routingTable.lastUpdated = Date.now();
    this.updateNetworkDensity();
  }

  private updateNetworkDensity(): void {
    const totalNodes = this.routingTable.nodes.size;
    const totalConnections = Array.from(this.routingTable.connections.values())
      .reduce((sum, connections) => sum + connections.size, 0);
    
    const maxPossibleConnections = totalNodes * (totalNodes - 1) / 2;
    this.discoveryStats.networkDensity = maxPossibleConnections > 0 
      ? totalConnections / maxPossibleConnections 
      : 0;
  }

  private deduplicatePeers(peers: PeerInfo[]): PeerInfo[] {
    const seen = new Set<string>();
    return peers.filter(peer => {
      if (seen.has(peer.id)) {
        return false;
      }
      seen.add(peer.id);
      return true;
    });
  }

  private initializeDiscoveryMethods(): void {
    const methods: DiscoveryMethod[] = [
      { name: 'dht', enabled: true, priority: 5, lastUsed: 0, successRate: 0.8 },
      { name: 'peer_exchange', enabled: true, priority: 4, lastUsed: 0, successRate: 0.7 },
      { name: 'bootstrap', enabled: true, priority: 3, lastUsed: 0, successRate: 0.6 },
      { name: 'relay', enabled: true, priority: 2, lastUsed: 0, successRate: 0.5 },
      { name: 'mdns', enabled: false, priority: 1, lastUsed: 0, successRate: 0.3 }
    ];

    for (const method of methods) {
      this.discoveryMethods.set(method.name, method);
      this.discoveryStats.discoveryMethods.set(method.name, {
        attempts: 0,
        successes: 0,
        failures: 0
      });
    }
  }

  private updateMethodStats(methodName: string, success: boolean): void {
    const stats = this.discoveryStats.discoveryMethods.get(methodName);
    if (stats) {
      stats.attempts++;
      if (success) {
        stats.successes++;
      } else {
        stats.failures++;
      }
    }

    const method = this.discoveryMethods.get(methodName);
    if (method) {
      method.lastUsed = Date.now();
      if (stats) {
        method.successRate = stats.successes / stats.attempts;
      }
    }
  }

  private updateDiscoveryStats(peersFound: number, discoveryTime: number): void {
    const currentAvg = this.discoveryStats.averageDiscoveryTime;
    this.discoveryStats.averageDiscoveryTime = currentAvg === 0 
      ? discoveryTime 
      : (currentAvg + discoveryTime) / 2;
    
    this.discoveryStats.activePeers = this.networkManager.getConnectedPeers().length;
  }

  private async startDiscoveryProcess(): Promise<void> {
    // Initial discovery
    await this.discoverPeers();
    
    // Periodic discovery
    this.discoveryInterval = setInterval(async () => {
      try {
        await this.discoverPeers();
        await this.advertiseSelf();
        await this.cleanupStaleEntries();
      } catch (error) {
        console.error('Discovery process error:', error);
      }
    }, this.discoveryIntervalMs);
  }

  private startTopologyUpdates(): void {
    this.topologyUpdateInterval = setInterval(async () => {
      try {
        await this.updateNetworkTopology();
      } catch (error) {
        console.error('Topology update error:', error);
      }
    }, this.topologyUpdateMs);
  }

  private async updateNetworkTopology(): Promise<void> {
    // Update routing paths for all known peers
    const knownPeerIds = Array.from(this.knownPeers.keys());
    
    for (const peerId of knownPeerIds) {
      if (!this.routingTable.routingPaths.has(peerId)) {
        await this.discoverRoutingPaths(peerId);
      }
    }

    this.routingTable.lastUpdated = Date.now();
    this.emit('topology_updated', this.routingTable);
  }

  private async cleanupStaleEntries(): Promise<void> {
    const now = Date.now();
    const staleThreshold = this.peerTimeout;

    // Remove stale peer advertisements
    for (const [peerId, advertisement] of this.knownPeers.entries()) {
      if (now - advertisement.timestamp > staleThreshold) {
        this.knownPeers.delete(peerId);
        this.routingTable.nodes.delete(peerId);
        this.routingTable.routingPaths.delete(peerId);
        
        this.emit('peer_removed', peerId);
      }
    }

    // Clean up routing paths
    for (const [destination, paths] of this.routingTable.routingPaths.entries()) {
      const validPaths = paths.filter(path => now - path.lastUsed < staleThreshold);
      
      if (validPaths.length !== paths.length) {
        this.routingTable.routingPaths.set(destination, validPaths);
      }
    }
  }

  private async bootstrapFromNodes(bootstrapNodes: string[]): Promise<void> {
    for (const nodeId of bootstrapNodes) {
      try {
        await this.connectToPeer(nodeId);
      } catch (error) {
        console.warn(`Failed to bootstrap from node ${nodeId}:`, error);
      }
    }
  }

  private setupNetworkEventHandlers(): void {
    this.networkManager.on('peer_connected', (peerId: string) => {
      this.updateRoutingTable(peerId, true);
    });

    this.networkManager.on('peer_disconnected', (peerId: string) => {
      this.updateRoutingTable(peerId, false);
    });

    this.networkManager.on('message', (message: MessagePacket) => {
      this.handleDiscoveryMessage(message);
    });
  }

  private handleDiscoveryMessage(message: MessagePacket): void {
    if (message.type !== 'peer_discovery') return;

    const { type, data } = message.data;

    switch (type) {
      case 'neighbor_request':
        this.handleNeighborRequest(message);
        break;
      case 'peer_list_request':
        this.handlePeerListRequest(message);
        break;
      case 'path_query':
        this.handlePathQuery(message);
        break;
      case 'advertisement':
        this.handlePeerAdvertisement(message);
        break;
    }
  }

  private handleNeighborRequest(message: MessagePacket): void {
    const neighbors = this.networkManager.getConnectedPeers()
      .map(peerId => this.networkManager.getPeerInfo(peerId))
      .filter((peer): peer is PeerInfo => peer !== undefined)
      .slice(0, 10); // Return up to 10 neighbors

    this.networkManager.sendMessage(message.from, {
      type: 'peer_discovery',
      to: message.from,
      data: {
        type: 'neighbor_response',
        requestId: message.data.requestId,
        peers: neighbors
      }
    });
  }

  private handlePeerListRequest(message: MessagePacket): void {
    const peerList = Array.from(this.knownPeers.values())
      .slice(0, 20) // Return up to 20 known peers
      .map(ad => ({
        id: ad.peerId,
        publicKey: ad.publicKey,
        capabilities: ad.capabilities,
        reputation: 0.5, // Default reputation
        latency: 100, // Estimate
        lastSeen: new Date(ad.timestamp),
        status: 'disconnected' as const
      }));

    this.networkManager.sendMessage(message.from, {
      type: 'peer_discovery',
      to: message.from,
      data: {
        type: 'peer_list_response',
        requestId: message.data.requestId,
        peers: peerList
      }
    });
  }

  private handlePathQuery(message: MessagePacket): void {
    const { destination } = message.data;
    const hasDirectConnection = this.networkManager.getConnectedPeers().includes(destination);
    const hasRoutingPath = this.routingTable.routingPaths.has(destination);

    this.networkManager.sendMessage(message.from, {
      type: 'peer_discovery',
      to: message.from,
      data: {
        type: 'path_response',
        requestId: message.data.requestId,
        hasPath: hasDirectConnection || hasRoutingPath
      }
    });
  }

  private handlePeerAdvertisement(message: MessagePacket): void {
    const { advertisement } = message.data;
    
    if (advertisement.peerId !== this.localPeerId) {
      this.knownPeers.set(advertisement.peerId, advertisement);
      this.emit('peer_advertised', advertisement);
    }
  }

  private generateRequestId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  // Public API methods
  public getKnownPeers(): PeerAdvertisement[] {
    return Array.from(this.knownPeers.values());
  }

  public getNetworkTopology(): NetworkTopology {
    return { ...this.routingTable };
  }

  public getDiscoveryStats(): DiscoveryStats {
    return { ...this.discoveryStats };
  }

  public getRoutingPaths(destination: string): RoutingPath[] {
    return this.routingTable.routingPaths.get(destination) || [];
  }

  public async forceDiscovery(): Promise<PeerInfo[]> {
    return await this.discoverPeers();
  }

  public updateDiscoveryMethod(name: string, enabled: boolean, priority?: number): void {
    const method = this.discoveryMethods.get(name);
    if (method) {
      method.enabled = enabled;
      if (priority !== undefined) {
        method.priority = priority;
      }
    }
  }

  public async shutdown(): Promise<void> {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }

    if (this.topologyUpdateInterval) {
      clearInterval(this.topologyUpdateInterval);
      this.topologyUpdateInterval = null;
    }

    this.isInitialized = false;
    this.emit('shutdown');
  }
} 