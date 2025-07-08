import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Card, ProgressBar, Badge, Divider } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { DeviceMonitor, DeviceMetrics, SystemInfo, PerformanceProfile } from '../../services/DeviceMonitor';
import { PerformanceAnalytics } from '../../services/PerformanceAnalytics';

export function DeviceInfo() {
  const [deviceMonitor] = useState(new DeviceMonitor());
  const [performanceAnalytics] = useState(new PerformanceAnalytics());
  const [currentMetrics, setCurrentMetrics] = useState<DeviceMetrics | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [performanceProfile, setPerformanceProfile] = useState<PerformanceProfile | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    initializeMonitoring();
    
    return () => {
      deviceMonitor.stopMonitoring();
    };
  }, []);

  const initializeMonitoring = async () => {
    try {
      // Wait for system info to be initialized
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const sysInfo = deviceMonitor.getSystemInfo();
      const perfProfile = deviceMonitor.getPerformanceProfile();
      
      setSystemInfo(sysInfo);
      setPerformanceProfile(perfProfile);
      
      if (sysInfo) {
        performanceAnalytics.updateSystemInfo(sysInfo);
      }
      if (perfProfile) {
        performanceAnalytics.updatePerformanceProfile(perfProfile);
      }
      
      // Start monitoring
      await deviceMonitor.startMonitoring(3000); // Every 3 seconds
      setIsMonitoring(true);
      
      // Update metrics every 3 seconds
      const interval = setInterval(() => {
        const metrics = deviceMonitor.getCurrentMetrics();
        if (metrics) {
          setCurrentMetrics(metrics);
          performanceAnalytics.addMetrics(metrics);
        }
      }, 3000);
      
      return () => clearInterval(interval);
    } catch (error) {
      console.error('Failed to initialize monitoring:', error);
    }
  };

  const getStorageInfo = () => {
    if (!currentMetrics) return { used: 0, total: 0, percentage: 0 };
    
    const used = currentMetrics.storageUsed / (1024 * 1024 * 1024); // Convert to GB
    const total = currentMetrics.storageTotal / (1024 * 1024 * 1024); // Convert to GB
    const percentage = (used / total) * 100;
    
    return { used, total, percentage };
  };

  const getUptimeString = () => {
    if (!currentMetrics) return '0m';
    
    const uptimeMs = Date.now() - currentMetrics.uptime;
    const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const getBatteryColor = (level: number) => {
    if (level > 60) return '#4CAF50';
    if (level > 30) return '#FF9800';
    return '#F44336';
  };

  const getThermalColor = (state: string) => {
    switch (state) {
      case 'nominal': return '#4CAF50';
      case 'fair': return '#FF9800';
      case 'serious': return '#FF5722';
      case 'critical': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getNetworkIcon = (type: string) => {
    switch (type) {
      case 'wifi': return 'wifi';
      case '5g': return 'signal-cellular-4-bar';
      case '4g': return 'signal-cellular-4-bar';
      case '3g': return 'signal-cellular-4-bar';
      default: return 'signal-cellular-off';
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'premium': return '#9C27B0';
      case 'high': return '#2196F3';
      case 'medium': return '#FF9800';
      case 'low': return '#4CAF50';
      default: return '#9E9E9E';
    }
  };

  const getProgressColor = (value: number) => {
    if (value <= 50) return '#4CAF50';
    if (value <= 75) return '#FF9800';
    return '#F44336';
  };

  if (!systemInfo || !currentMetrics || !performanceProfile) {
    return (
      <Card style={styles.container}>
        <Card.Content>
          <Text style={styles.title}>Initializing Device Monitor...</Text>
        </Card.Content>
      </Card>
    );
  }

  const storage = getStorageInfo();

  return (
    <ScrollView style={styles.scrollContainer}>
      <Card style={styles.container}>
        <Card.Content>
          <View style={styles.header}>
            <Text style={styles.title}>Device Information</Text>
            <Badge 
              style={[styles.badge, { backgroundColor: getTierColor(performanceProfile.tier) }]}
              size={24}
            >
              {performanceProfile.tier.toUpperCase()}
            </Badge>
          </View>

          <Divider style={styles.divider} />

          {/* System Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>System Specifications</Text>
            <View style={styles.specGrid}>
              <View style={styles.specItem}>
                <MaterialIcons name="memory" size={20} color="#666" />
                <Text style={styles.specLabel}>Model</Text>
                <Text style={styles.specValue}>{systemInfo.deviceModel}</Text>
              </View>
              
              <View style={styles.specItem}>
                <MaterialIcons name="developer-board" size={20} color="#666" />
                <Text style={styles.specLabel}>CPU</Text>
                <Text style={styles.specValue}>{systemInfo.processorCount} cores</Text>
              </View>
              
              <View style={styles.specItem}>
                <MaterialIcons name="memory" size={20} color="#666" />
                <Text style={styles.specLabel}>RAM</Text>
                <Text style={styles.specValue}>{Math.round(systemInfo.totalMemory / (1024 * 1024 * 1024))} GB</Text>
              </View>
              
              <View style={styles.specItem}>
                <MaterialIcons name="storage" size={20} color="#666" />
                <Text style={styles.specLabel}>Storage</Text>
                <Text style={styles.specValue}>{Math.round(storage.total)} GB</Text>
              </View>
              
              <View style={styles.specItem}>
                <MaterialIcons name="graphic-eq" size={20} color="#666" />
                <Text style={styles.specLabel}>GPU</Text>
                <Text style={styles.specValue}>{systemInfo.hasGPU ? 'Available' : 'None'}</Text>
              </View>
              
              <View style={styles.specItem}>
                <MaterialIcons name="smartphone" size={20} color="#666" />
                <Text style={styles.specLabel}>Platform</Text>
                <Text style={styles.specValue}>{systemInfo.platform.toUpperCase()}</Text>
              </View>
            </View>
          </View>

          <Divider style={styles.divider} />

          {/* Real-time Metrics */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Real-time Performance</Text>
            
            <View style={styles.metricItem}>
              <View style={styles.metricHeader}>
                <MaterialIcons name="memory" size={20} color="#666" />
                <Text style={styles.metricLabel}>CPU Usage</Text>
                <Text style={styles.metricValue}>{Math.round(currentMetrics.cpuUsage)}%</Text>
              </View>
              <ProgressBar 
                progress={currentMetrics.cpuUsage / 100} 
                color={getProgressColor(currentMetrics.cpuUsage)}
                style={styles.progressBar}
              />
            </View>

            <View style={styles.metricItem}>
              <View style={styles.metricHeader}>
                <MaterialIcons name="memory" size={20} color="#666" />
                <Text style={styles.metricLabel}>Memory Usage</Text>
                <Text style={styles.metricValue}>{Math.round(currentMetrics.memoryUsage)}%</Text>
              </View>
              <ProgressBar 
                progress={currentMetrics.memoryUsage / 100} 
                color={getProgressColor(currentMetrics.memoryUsage)}
                style={styles.progressBar}
              />
            </View>

            <View style={styles.metricItem}>
              <View style={styles.metricHeader}>
                <MaterialIcons name="storage" size={20} color="#666" />
                <Text style={styles.metricLabel}>Storage Usage</Text>
                <Text style={styles.metricValue}>{Math.round(storage.percentage)}%</Text>
              </View>
              <ProgressBar 
                progress={storage.percentage / 100} 
                color={getProgressColor(storage.percentage)}
                style={styles.progressBar}
              />
            </View>

            <View style={styles.metricItem}>
              <View style={styles.metricHeader}>
                <MaterialIcons name="battery-full" size={20} color={getBatteryColor(currentMetrics.batteryLevel)} />
                <Text style={styles.metricLabel}>Battery</Text>
                <Text style={styles.metricValue}>{Math.round(currentMetrics.batteryLevel)}%</Text>
              </View>
              <ProgressBar 
                progress={currentMetrics.batteryLevel / 100} 
                color={getBatteryColor(currentMetrics.batteryLevel)}
                style={styles.progressBar}
              />
            </View>
          </View>

          <Divider style={styles.divider} />

          {/* Status Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status & Health</Text>
            
            <View style={styles.statusGrid}>
              <View style={styles.statusItem}>
                <MaterialIcons name="thermostat" size={20} color={getThermalColor(currentMetrics.thermalState)} />
                <Text style={styles.statusLabel}>Thermal</Text>
                <Text style={[styles.statusValue, { color: getThermalColor(currentMetrics.thermalState) }]}>
                  {currentMetrics.thermalState.toUpperCase()}
                </Text>
              </View>

              <View style={styles.statusItem}>
                <MaterialIcons name={getNetworkIcon(currentMetrics.networkType)} size={20} color="#666" />
                <Text style={styles.statusLabel}>Network</Text>
                <Text style={styles.statusValue}>{currentMetrics.networkType.toUpperCase()}</Text>
              </View>

              <View style={styles.statusItem}>
                <MaterialIcons name="speed" size={20} color="#666" />
                <Text style={styles.statusLabel}>Speed</Text>
                <Text style={styles.statusValue}>{Math.round(currentMetrics.networkSpeed)} Mbps</Text>
              </View>

              <View style={styles.statusItem}>
                <MaterialIcons name="timer" size={20} color="#666" />
                <Text style={styles.statusLabel}>Uptime</Text>
                <Text style={styles.statusValue}>{getUptimeString()}</Text>
              </View>
            </View>
          </View>

          <Divider style={styles.divider} />

          {/* Performance Profile */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Performance Profile</Text>
            
            <View style={styles.profileGrid}>
              <View style={styles.profileItem}>
                <Text style={styles.profileLabel}>Compute Score</Text>
                <Text style={styles.profileValue}>{Math.round(performanceProfile.computeScore)}</Text>
              </View>

              <View style={styles.profileItem}>
                <Text style={styles.profileLabel}>Memory Score</Text>
                <Text style={styles.profileValue}>{Math.round(performanceProfile.memoryScore)}</Text>
              </View>

              <View style={styles.profileItem}>
                <Text style={styles.profileLabel}>Network Score</Text>
                <Text style={styles.profileValue}>{Math.round(performanceProfile.networkScore)}</Text>
              </View>

              <View style={styles.profileItem}>
                <Text style={styles.profileLabel}>Overall Score</Text>
                <Text style={[styles.profileValue, { color: getTierColor(performanceProfile.tier) }]}>
                  {Math.round(performanceProfile.overallScore)}
                </Text>
              </View>
            </View>
          </View>

          {/* Monitoring Status */}
          <View style={styles.monitoringStatus}>
            <MaterialIcons 
              name={isMonitoring ? "visibility" : "visibility-off"} 
              size={16} 
              color={isMonitoring ? "#4CAF50" : "#F44336"} 
            />
            <Text style={[styles.monitoringText, { color: isMonitoring ? "#4CAF50" : "#F44336" }]}>
              {isMonitoring ? "Monitoring Active" : "Monitoring Inactive"}
            </Text>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  container: {
    margin: 16,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e1e1e',
  },
  badge: {
    color: '#fff',
  },
  divider: {
    marginVertical: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  specGrid: {
    gap: 8,
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  specLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  specValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e1e1e',
  },
  metricItem: {
    marginBottom: 16,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e1e1e',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statusItem: {
    alignItems: 'center',
    minWidth: 80,
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statusValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e1e1e',
    marginTop: 2,
  },
  profileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  profileItem: {
    alignItems: 'center',
    minWidth: 80,
  },
  profileLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  profileValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e1e1e',
    marginTop: 4,
  },
  monitoringStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  monitoringText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '600',
  },
}); 