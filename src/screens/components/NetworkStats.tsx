import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface NetworkState {
  totalDevices: number;
  totalTasksCompleted: number;
  totalTokensDistributed: number;
  networkUtilization: number;
}

interface NetworkStatsProps {
  networkState: NetworkState;
}

export function NetworkStats({ networkState }: NetworkStatsProps) {
  
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 80) return '#FF3B30';
    if (utilization >= 60) return '#FF9500';
    if (utilization >= 40) return '#FFCC00';
    return '#34C759';
  };

  const getUtilizationLabel = (utilization: number) => {
    if (utilization >= 80) return 'High Load';
    if (utilization >= 60) return 'Moderate Load';
    if (utilization >= 40) return 'Light Load';
    return 'Low Load';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Network Statistics</Text>
      
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{formatNumber(networkState.totalDevices)}</Text>
          <Text style={styles.statLabel}>Active Devices</Text>
        </View>
        
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{formatNumber(networkState.totalTasksCompleted)}</Text>
          <Text style={styles.statLabel}>Tasks Completed</Text>
        </View>
        
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{formatNumber(networkState.totalTokensDistributed)}</Text>
          <Text style={styles.statLabel}>SMC Distributed</Text>
        </View>
        
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: getUtilizationColor(networkState.networkUtilization) }]}>
            {networkState.networkUtilization}%
          </Text>
          <Text style={styles.statLabel}>Network Load</Text>
        </View>
      </View>
      
      <View style={styles.utilizationContainer}>
        <Text style={styles.utilizationTitle}>Network Utilization</Text>
        <View style={styles.utilizationBar}>
          <View 
            style={[
              styles.utilizationFill, 
              { 
                width: `${networkState.networkUtilization}%`, 
                backgroundColor: getUtilizationColor(networkState.networkUtilization) 
              }
            ]} 
          />
        </View>
        <Text style={[styles.utilizationLabel, { color: getUtilizationColor(networkState.networkUtilization) }]}>
          {getUtilizationLabel(networkState.networkUtilization)}
        </Text>
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
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e1e1e',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statBox: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
  utilizationContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 16,
  },
  utilizationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e1e1e',
    marginBottom: 12,
    textAlign: 'center',
  },
  utilizationBar: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginBottom: 8,
  },
  utilizationFill: {
    height: '100%',
    borderRadius: 4,
  },
  utilizationLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
}); 