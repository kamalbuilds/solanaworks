import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthorization } from '../utils/useAuthorization';
import { useConnection } from '../utils/ConnectionProvider';
import { DeviceInfo } from './components/DeviceInfo';
import { TaskQueue } from './components/TaskQueue';
import { EarningsTracker } from './components/EarningsTracker';
import { NetworkStats } from './components/NetworkStats';
import { ComputeService } from '../services/ComputeService';

interface DeviceSpecs {
  cpu_cores: number;
  ram_gb: number;
  storage_gb: number;
  gpu_available: boolean;
  network_speed: number;
}

interface DeviceStatus {
  isRegistered: boolean;
  isActive: boolean;
  currentLoad: number;
  reputation: number;
  totalTasksCompleted: number;
  totalTokensEarned: number;
}

interface NetworkState {
  totalDevices: number;
  totalTasksCompleted: number;
  totalTokensDistributed: number;
  networkUtilization: number;
}

export default function ComputeNetworkScreen() {
  const navigation = useNavigation();
  const { selectedAccount } = useAuthorization();
  const { connection } = useConnection();
  
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>({
    isRegistered: false,
    isActive: false,
    currentLoad: 0,
    reputation: 0,
    totalTasksCompleted: 0,
    totalTokensEarned: 0,
  });
  
  const [networkState, setNetworkState] = useState<NetworkState>({
    totalDevices: 0,
    totalTasksCompleted: 0,
    totalTokensDistributed: 0,
    networkUtilization: 0,
  });
  
  const [deviceSpecs, setDeviceSpecs] = useState<DeviceSpecs>({
    cpu_cores: 4,
    ram_gb: 8,
    storage_gb: 128,
    gpu_available: true,
    network_speed: 100,
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const computeService = new ComputeService(connection);

  useEffect(() => {
    loadDeviceStatus();
    loadNetworkState();
    detectDeviceSpecs();
  }, [selectedAccount]);

  const detectDeviceSpecs = async () => {
    try {
      // This would be replaced with actual device detection
      // For now, we'll use mock data
      const specs: DeviceSpecs = {
        cpu_cores: 8,
        ram_gb: 6,
        storage_gb: 256,
        gpu_available: true,
        network_speed: 150,
      };
      setDeviceSpecs(specs);
    } catch (error) {
      console.error('Error detecting device specs:', error);
    }
  };

  const loadDeviceStatus = async () => {
    if (!selectedAccount) return;
    
    try {
      setIsLoading(true);
      const status = await computeService.getDeviceStatus(selectedAccount.publicKey);
      setDeviceStatus(status);
    } catch (error) {
      console.error('Error loading device status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadNetworkState = async () => {
    try {
      const state = await computeService.getNetworkState();
      setNetworkState(state);
    } catch (error) {
      console.error('Error loading network state:', error);
    }
  };

  const registerDevice = async () => {
    if (!selectedAccount) {
      Alert.alert('Error', 'Please connect your wallet first');
      return;
    }

    try {
      setIsLoading(true);
      const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await computeService.registerDevice(
        selectedAccount,
        deviceId,
        deviceSpecs
      );
      
      Alert.alert('Success', 'Device registered successfully!');
      await loadDeviceStatus();
      await loadNetworkState();
    } catch (error) {
      console.error('Error registering device:', error);
      Alert.alert('Error', 'Failed to register device. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDeviceStatus = async () => {
    if (!selectedAccount) return;

    try {
      setIsLoading(true);
      const newStatus = !deviceStatus.isActive;
      
      await computeService.updateDeviceStatus(
        selectedAccount,
        newStatus,
        deviceStatus.currentLoad
      );
      
      setDeviceStatus(prev => ({ ...prev, isActive: newStatus }));
      
      Alert.alert(
        'Success',
        `Device ${newStatus ? 'activated' : 'deactivated'} successfully!`
      );
    } catch (error) {
      console.error('Error toggling device status:', error);
      Alert.alert('Error', 'Failed to update device status. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadDeviceStatus(), loadNetworkState()]);
    setRefreshing(false);
  };

  const renderDeviceActions = () => {
    if (!deviceStatus.isRegistered) {
      return (
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton]}
          onPress={registerDevice}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Registering...' : 'Register Device'}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            deviceStatus.isActive ? styles.dangerButton : styles.successButton
          ]}
          onPress={toggleDeviceStatus}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading
              ? 'Updating...'
              : deviceStatus.isActive
              ? 'Stop Contributing'
              : 'Start Contributing'
            }
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>SolMobile Compute</Text>
        <Text style={styles.subtitle}>
          Decentralized Physical Infrastructure Network
        </Text>
      </View>

      <NetworkStats networkState={networkState} />

              <DeviceInfo />

      {renderDeviceActions()}

      {deviceStatus.isRegistered && (
        <>
          <EarningsTracker
            totalTokensEarned={deviceStatus.totalTokensEarned}
            totalTasksCompleted={deviceStatus.totalTasksCompleted}
            reputation={deviceStatus.reputation}
          />
          
          <TaskQueue
            deviceStatus={deviceStatus}
            onTaskUpdate={loadDeviceStatus}
          />
        </>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Contribute your device's compute power to earn tokens
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#1e1e1e',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  actionContainer: {
    padding: 20,
  },
  actionButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 8,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  successButton: {
    backgroundColor: '#34C759',
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
}); 