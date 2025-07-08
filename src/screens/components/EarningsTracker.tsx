import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface EarningsTrackerProps {
  totalTokensEarned: number;
  totalTasksCompleted: number;
  reputation: number;
}

export function EarningsTracker({ 
  totalTokensEarned, 
  totalTasksCompleted, 
  reputation 
}: EarningsTrackerProps) {
  
  const formatTokens = (tokens: number) => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  const getReputationColor = (reputation: number) => {
    if (reputation >= 90) return '#34C759';
    if (reputation >= 70) return '#FF9500';
    if (reputation >= 50) return '#FFCC00';
    return '#FF3B30';
  };

  const getReputationLabel = (reputation: number) => {
    if (reputation >= 90) return 'Excellent';
    if (reputation >= 70) return 'Good';
    if (reputation >= 50) return 'Fair';
    return 'Poor';
  };

  const dailyAverage = totalTasksCompleted > 0 ? 
    Math.round((totalTokensEarned / totalTasksCompleted) * 10) / 10 : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Earnings & Performance</Text>
      
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatTokens(totalTokensEarned)}</Text>
          <Text style={styles.statLabel}>SMC Earned</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalTasksCompleted}</Text>
          <Text style={styles.statLabel}>Tasks Completed</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{dailyAverage}</Text>
          <Text style={styles.statLabel}>Avg per Task</Text>
        </View>
      </View>
      
      <View style={styles.reputationContainer}>
        <Text style={styles.reputationTitle}>Reputation Score</Text>
        <View style={styles.reputationRow}>
          <View style={styles.reputationBar}>
            <View 
              style={[
                styles.reputationFill, 
                { 
                  width: `${reputation}%`, 
                  backgroundColor: getReputationColor(reputation) 
                }
              ]} 
            />
          </View>
          <Text style={[styles.reputationScore, { color: getReputationColor(reputation) }]}>
            {reputation}%
          </Text>
        </View>
        <Text style={[styles.reputationLabel, { color: getReputationColor(reputation) }]}>
          {getReputationLabel(reputation)}
        </Text>
      </View>
      
      <View style={styles.performanceContainer}>
        <Text style={styles.performanceTitle}>Performance Metrics</Text>
        <View style={styles.performanceRow}>
          <Text style={styles.performanceLabel}>Success Rate</Text>
          <Text style={styles.performanceValue}>
            {totalTasksCompleted > 0 ? '100%' : '0%'}
          </Text>
        </View>
        <View style={styles.performanceRow}>
          <Text style={styles.performanceLabel}>Response Time</Text>
          <Text style={styles.performanceValue}>Fast</Text>
        </View>
        <View style={styles.performanceRow}>
          <Text style={styles.performanceLabel}>Network Rank</Text>
          <Text style={styles.performanceValue}>
            {reputation >= 90 ? 'Top 10%' : reputation >= 70 ? 'Top 25%' : 'Average'}
          </Text>
        </View>
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
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  reputationContainer: {
    marginBottom: 16,
  },
  reputationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e1e1e',
    marginBottom: 8,
  },
  reputationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  reputationBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginRight: 12,
  },
  reputationFill: {
    height: '100%',
    borderRadius: 4,
  },
  reputationScore: {
    fontSize: 16,
    fontWeight: 'bold',
    minWidth: 50,
    textAlign: 'right',
  },
  reputationLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  performanceContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 16,
  },
  performanceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e1e1e',
    marginBottom: 12,
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  performanceLabel: {
    fontSize: 14,
    color: '#666',
  },
  performanceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e1e1e',
  },
}); 