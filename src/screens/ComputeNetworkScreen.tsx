import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Card, Button, ProgressBar, Badge, Surface, IconButton } from 'react-native-paper';
import { DeviceMonitor } from '../services/DeviceMonitor';
import { PerformanceAnalytics } from '../services/PerformanceAnalytics';
import { ResourceOptimizationAgent } from '../services/agents/ResourceOptimizationAgent';
import { P2POrchestrator, P2PNetworkStatus, TaskSubmissionOptions } from '../services/p2p/P2POrchestrator';
import { DeviceInfo } from './components/DeviceInfo';

const { width } = Dimensions.get('window');

interface NetworkMetrics {
  connectedPeers: number;
  activeTasks: number;
  completedTasks: number;
  networkHealth: number;
  reputation: number;
}

export default function ComputeNetworkScreen() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<P2PNetworkStatus | null>(null);
  const [networkMetrics, setNetworkMetrics] = useState<NetworkMetrics>({
    connectedPeers: 0,
    activeTasks: 0,
    completedTasks: 0,
    networkHealth: 0,
    reputation: 0.5,
  });

  // Service instances
  const deviceMonitor = useRef(new DeviceMonitor());
  const performanceAnalytics = useRef(new PerformanceAnalytics());
  const optimizationAgent = useRef(new ResourceOptimizationAgent({
    privateKey: 'your-private-key-here', // In production, load securely
    rpcUrl: 'https://api.devnet.solana.com',
    aggressiveness: 'balanced',
    batteryThreshold: 20,
    thermalThreshold: 'fair',
    maxConcurrentTasks: 3,
    rewardThreshold: 0.1
  }, performanceAnalytics.current, {} as any));
  
  const p2pOrchestrator = useRef(new P2POrchestrator(
    deviceMonitor.current,
    performanceAnalytics.current,
    optimizationAgent.current,
    {
      maxPeers: 20,
      bootstrapNodes: [], // Add bootstrap nodes in production
      discoveryMethods: ['dht', 'peer_exchange'],
      verificationRequired: true,
      networkResilience: true,
      trustedPeers: []
    }
  ));

  useEffect(() => {
    initializeServices();
    
    // Setup P2P event listeners
    const orchestrator = p2pOrchestrator.current;
    
    orchestrator.on('initialized', () => {
      console.log('P2P Network initialized');
      updateNetworkStatus();
    });

    orchestrator.on('peer_connected', (data) => {
      console.log('Peer connected:', data.peerId);
      updateNetworkStatus();
    });

    orchestrator.on('peer_disconnected', (data) => {
      console.log('Peer disconnected:', data.peerId);
      updateNetworkStatus();
    });

    orchestrator.on('task_received', (data) => {
      console.log('Task received:', data.task.id);
      updateNetworkStatus();
    });

    orchestrator.on('task_completed', (data) => {
      console.log('Task completed:', data.taskId);
      updateNetworkStatus();
    });

    orchestrator.on('health_updated', (health) => {
      setNetworkMetrics(prev => ({
        ...prev,
        networkHealth: health.overallHealth
      }));
    });

    return () => {
      orchestrator.removeAllListeners();
      shutdownServices();
    };
  }, []);

  const initializeServices = async () => {
    setIsLoading(true);
    try {
      console.log('Initializing DePIN services...');
      
      // Initialize P2P orchestrator
      await p2pOrchestrator.current.initialize();
      
      setIsInitialized(true);
      updateNetworkStatus();
      
      // Start periodic updates
      setInterval(updateNetworkStatus, 10000); // Update every 10 seconds
      
    } catch (error) {
      console.error('Failed to initialize services:', error);
      Alert.alert('Initialization Error', 'Failed to start DePIN services');
    } finally {
      setIsLoading(false);
    }
  };

  const shutdownServices = async () => {
    try {
      await p2pOrchestrator.current.shutdown();
      optimizationAgent.current.stopOptimization();
    } catch (error) {
      console.error('Error shutting down services:', error);
    }
  };

  const updateNetworkStatus = () => {
    if (!isInitialized) return;

    try {
      const status = p2pOrchestrator.current.getNetworkStatus();
      const connectedPeers = p2pOrchestrator.current.getConnectedPeers();
      const activeTasks = p2pOrchestrator.current.getActiveTasks();
      const completedTasks = p2pOrchestrator.current.getCompletedTasks();
      const health = p2pOrchestrator.current.getNetworkHealth();

      setNetworkStatus(status);
      setNetworkMetrics({
        connectedPeers: connectedPeers.length,
        activeTasks: activeTasks.length,
        completedTasks: completedTasks.length,
        networkHealth: health?.overallHealth || 0,
        reputation: 0.75 // Would be calculated from verification results
      });
    } catch (error) {
      console.error('Error updating network status:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await p2pOrchestrator.current.discoverPeers();
      await p2pOrchestrator.current.optimizeNetworkPerformance();
      updateNetworkStatus();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const submitComputeTask = async () => {
    if (!isInitialized) {
      Alert.alert('Error', 'P2P Network not initialized');
      return;
    }

    try {
      const taskOptions: TaskSubmissionOptions = {
        priority: 'medium',
        requireVerification: true,
        maxExecutionTime: 60000, // 1 minute
        reward: 0.01 // SOL
      };

      const taskId = await p2pOrchestrator.current.submitTask(
        'compute',
        {
          operation: 'hash',
          data: { message: 'Hello DePIN World!', timestamp: Date.now() }
        },
        {
          cpuCores: 1,
          memoryGB: 1,
          gpuRequired: false,
          estimatedDuration: 30000
        },
        taskOptions
      );

      Alert.alert('Success', `Task submitted with ID: ${taskId.substring(0, 8)}...`);
      updateNetworkStatus();
    } catch (error) {
      console.error('Error submitting task:', error);
      Alert.alert('Error', 'Failed to submit compute task');
    }
  };

  const submitAITask = async () => {
    if (!isInitialized) {
      Alert.alert('Error', 'P2P Network not initialized');
      return;
    }

    try {
      const taskOptions: TaskSubmissionOptions = {
        priority: 'high',
        requireVerification: true,
        maxExecutionTime: 120000, // 2 minutes
        reward: 0.05 // SOL
      };

      const taskId = await p2pOrchestrator.current.submitTask(
        'ai_inference',
        {
          model: 'text-classification',
          input: 'Analyze the sentiment of this DePIN network performance'
        },
        {
          cpuCores: 2,
          memoryGB: 4,
          gpuRequired: true,
          estimatedDuration: 60000
        },
        taskOptions
      );

      Alert.alert('Success', `AI Task submitted with ID: ${taskId.substring(0, 8)}...`);
      updateNetworkStatus();
    } catch (error) {
      console.error('Error submitting AI task:', error);
      Alert.alert('Error', 'Failed to submit AI task');
    }
  };

  const discoverPeers = async () => {
    if (!isInitialized) return;

    try {
      setIsLoading(true);
      const peers = await p2pOrchestrator.current.discoverPeers();
      Alert.alert('Discovery Complete', `Found ${peers.length} new peers`);
      updateNetworkStatus();
    } catch (error) {
      console.error('Error discovering peers:', error);
      Alert.alert('Error', 'Failed to discover peers');
    } finally {
      setIsLoading(false);
    }
  };

  const resetNetwork = async () => {
    Alert.alert(
      'Reset Network',
      'This will disconnect from all peers and restart the network. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await p2pOrchestrator.current.resetNetwork();
              updateNetworkStatus();
              Alert.alert('Success', 'Network reset complete');
            } catch (error) {
              console.error('Error resetting network:', error);
              Alert.alert('Error', 'Failed to reset network');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const getHealthColor = (health: number): string => {
    if (health >= 0.8) return '#4CAF50';
    if (health >= 0.6) return '#FF9800';
    return '#F44336';
  };

  const getReputationBadge = (reputation: number): { color: string; text: string } => {
    if (reputation >= 0.9) return { color: '#4CAF50', text: 'Excellent' };
    if (reputation >= 0.7) return { color: '#8BC34A', text: 'Good' };
    if (reputation >= 0.5) return { color: '#FF9800', text: 'Fair' };
    return { color: '#F44336', text: 'Poor' };
  };

  if (isLoading && !isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Initializing DePIN Network...</Text>
        <ProgressBar indeterminate style={styles.loadingProgress} />
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Network Status Header */}
      <Card style={styles.statusCard}>
        <Card.Content>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>P2P DePIN Network</Text>
            <Badge 
              style={[
                styles.statusBadge, 
                { backgroundColor: networkStatus?.isInitialized ? '#4CAF50' : '#F44336' }
              ]}
            >
              {networkStatus?.isInitialized ? 'ONLINE' : 'OFFLINE'}
            </Badge>
          </View>
          
          <View style={styles.nodeInfo}>
            <Text style={styles.nodeId}>
              Node ID: {p2pOrchestrator.current.getNodeId().substring(0, 12)}...
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Network Metrics */}
      <Card style={styles.metricsCard}>
        <Card.Content>
          <Text style={styles.cardTitle}>Network Metrics</Text>
          
          <View style={styles.metricsGrid}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{networkMetrics.connectedPeers}</Text>
              <Text style={styles.metricLabel}>Connected Peers</Text>
            </View>
            
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{networkMetrics.activeTasks}</Text>
              <Text style={styles.metricLabel}>Active Tasks</Text>
            </View>
            
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{networkMetrics.completedTasks}</Text>
              <Text style={styles.metricLabel}>Completed Tasks</Text>
            </View>
            
            <View style={styles.metric}>
              <Text style={[styles.metricValue, { color: getHealthColor(networkMetrics.networkHealth) }]}>
                {Math.round(networkMetrics.networkHealth * 100)}%
              </Text>
              <Text style={styles.metricLabel}>Network Health</Text>
            </View>
          </View>

          <View style={styles.reputationSection}>
            <Text style={styles.reputationLabel}>Node Reputation</Text>
            <View style={styles.reputationContainer}>
              <ProgressBar 
                progress={networkMetrics.reputation} 
                style={styles.reputationBar}
                color={getReputationBadge(networkMetrics.reputation).color}
              />
              <Badge style={[
                styles.reputationBadge,
                { backgroundColor: getReputationBadge(networkMetrics.reputation).color }
              ]}>
                {getReputationBadge(networkMetrics.reputation).text}
              </Badge>
            </View>
          </View>
        </Card.Content>
      </Card>

             {/* Device Information */}
       <DeviceInfo />

      {/* Task Submission */}
      <Card style={styles.actionCard}>
        <Card.Content>
          <Text style={styles.cardTitle}>Submit Tasks</Text>
          <Text style={styles.cardSubtitle}>
            Contribute to the DePIN network by submitting compute tasks
          </Text>
          
          <View style={styles.actionButtons}>
            <Button
              mode="contained"
              onPress={submitComputeTask}
              disabled={!isInitialized || isLoading}
              style={styles.actionButton}
              icon="calculator"
            >
              Submit Compute Task
            </Button>
            
            <Button
              mode="contained"
              onPress={submitAITask}
              disabled={!isInitialized || isLoading}
              style={[styles.actionButton, styles.aiButton]}
              icon="brain"
            >
              Submit AI Task
            </Button>
          </View>
        </Card.Content>
      </Card>

      {/* Network Actions */}
      <Card style={styles.actionCard}>
        <Card.Content>
          <Text style={styles.cardTitle}>Network Management</Text>
          
          <View style={styles.actionButtons}>
            <Button
              mode="outlined"
              onPress={discoverPeers}
              disabled={!isInitialized || isLoading}
              style={styles.actionButton}
              icon="radar"
            >
              Discover Peers
            </Button>
            
            <Button
              mode="outlined"
              onPress={() => p2pOrchestrator.current.optimizeNetworkPerformance()}
              disabled={!isInitialized || isLoading}
              style={styles.actionButton}
              icon="tune"
            >
              Optimize Network
            </Button>
            
            <Button
              mode="outlined"
              onPress={resetNetwork}
              disabled={!isInitialized || isLoading}
              style={[styles.actionButton, styles.resetButton]}
              icon="restart"
            >
              Reset Network
            </Button>
          </View>
        </Card.Content>
      </Card>

      {/* Network Statistics */}
      <Card style={styles.statsCard}>
        <Card.Content>
          <Text style={styles.cardTitle}>Detailed Statistics</Text>
          
          {networkStatus && (
            <View style={styles.statsList}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Known Peers:</Text>
                <Text style={styles.statValue}>{networkStatus.knownPeers}</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Pending Verifications:</Text>
                <Text style={styles.statValue}>{networkStatus.pendingVerifications}</Text>
              </View>
              
              {networkStatus.networkHealth && (
                <>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Connectivity:</Text>
                    <Text style={styles.statValue}>
                      {Math.round(networkStatus.networkHealth.connectivity * 100)}%
                    </Text>
                  </View>
                  
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Reliability:</Text>
                    <Text style={styles.statValue}>
                      {Math.round(networkStatus.networkHealth.reliability * 100)}%
                    </Text>
                  </View>
                  
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Security Score:</Text>
                    <Text style={styles.statValue}>
                      {Math.round(networkStatus.networkHealth.security * 100)}%
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  loadingProgress: {
    width: '80%',
  },
  statusCard: {
    margin: 16,
    marginBottom: 8,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 8,
  },
  nodeInfo: {
    marginTop: 8,
  },
  nodeId: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  metricsCard: {
    margin: 16,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metric: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  reputationSection: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 16,
  },
  reputationLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  reputationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reputationBar: {
    flex: 1,
    height: 8,
    marginRight: 12,
  },
  reputationBadge: {
    paddingHorizontal: 8,
  },
  actionCard: {
    margin: 16,
    marginBottom: 8,
  },
  actionButtons: {
    gap: 12,
  },
  actionButton: {
    marginVertical: 4,
  },
  aiButton: {
    backgroundColor: '#9C27B0',
  },
  resetButton: {
    borderColor: '#F44336',
  },
  statsCard: {
    margin: 16,
    marginBottom: 32,
  },
  statsList: {
    gap: 8,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '500',
  },
}); 