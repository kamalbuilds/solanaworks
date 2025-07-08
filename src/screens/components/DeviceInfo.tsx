import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

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

interface DeviceInfoProps {
  deviceSpecs: DeviceSpecs;
  deviceStatus: DeviceStatus;
  isLoading: boolean;
}

export function DeviceInfo({ deviceSpecs, deviceStatus, isLoading }: DeviceInfoProps) {
  const getStatusColor = () => {
    if (!deviceStatus.isRegistered) return '#888';
    if (deviceStatus.isActive) return '#34C759';
    return '#FF9500';
  };

  const getStatusText = () => {
    if (!deviceStatus.isRegistered) return 'Not Registered';
    if (deviceStatus.isActive) return 'Active';
    return 'Inactive';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Device Information</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
      </View>

      <View style={styles.specsContainer}>
        <View style={styles.specItem}>
          <Text style={styles.specLabel}>CPU Cores</Text>
          <Text style={styles.specValue}>{deviceSpecs.cpu_cores}</Text>
        </View>

        <View style={styles.specItem}>
          <Text style={styles.specLabel}>RAM</Text>
          <Text style={styles.specValue}>{deviceSpecs.ram_gb} GB</Text>
        </View>

        <View style={styles.specItem}>
          <Text style={styles.specLabel}>Storage</Text>
          <Text style={styles.specValue}>{deviceSpecs.storage_gb} GB</Text>
        </View>

        <View style={styles.specItem}>
          <Text style={styles.specLabel}>GPU</Text>
          <Text style={styles.specValue}>
            {deviceSpecs.gpu_available ? 'Available' : 'Not Available'}
          </Text>
        </View>

        <View style={styles.specItem}>
          <Text style={styles.specLabel}>Network Speed</Text>
          <Text style={styles.specValue}>{deviceSpecs.network_speed} Mbps</Text>
        </View>

        {deviceStatus.isRegistered && (
          <View style={styles.specItem}>
            <Text style={styles.specLabel}>Current Load</Text>
            <Text style={styles.specValue}>{deviceStatus.currentLoad}%</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e1e1e',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  specsContainer: {
    gap: 12,
  },
  specItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  specLabel: {
    fontSize: 14,
    color: '#666',
  },
  specValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e1e1e',
  },
}); 