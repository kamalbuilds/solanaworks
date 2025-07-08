import { DeviceMetrics, SystemInfo, PerformanceProfile } from './DeviceMonitor';

export interface PerformanceReport {
  deviceId: string;
  reportDate: string;
  averagePerformance: {
    cpuUsage: number;
    memoryUsage: number;
    thermalState: string;
    batteryEfficiency: number;
  };
  taskCompletionRate: number;
  reliabilityScore: number;
  recommendations: string[];
  historicalTrends: {
    period: string;
    performanceChange: number;
    trend: 'improving' | 'stable' | 'declining';
  };
}

export interface TaskPerformanceMetrics {
  taskId: string;
  taskType: string;
  startTime: number;
  endTime: number;
  duration: number;
  cpuUsageMin: number;
  cpuUsageMax: number;
  cpuUsageAvg: number;
  memoryUsageMin: number;
  memoryUsageMax: number;
  memoryUsageAvg: number;
  thermalImpact: number;
  batteryDrain: number;
  success: boolean;
  errorCode?: string;
}

export interface OptimizationSuggestion {
  category: 'performance' | 'efficiency' | 'reliability';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  expectedImprovement: number;
  implementationComplexity: 'easy' | 'medium' | 'hard';
  estimatedImpact: string;
}

export class PerformanceAnalytics {
  private metricsHistory: DeviceMetrics[] = [];
  private taskPerformanceHistory: TaskPerformanceMetrics[] = [];
  private systemInfo: SystemInfo | null = null;
  private performanceProfile: PerformanceProfile | null = null;
  private lastAnalysisTime: number = 0;
  private performanceReports: PerformanceReport[] = [];

  constructor() {
    this.initializeAnalytics();
  }

  private initializeAnalytics(): void {
    // Initialize analytics service
    this.lastAnalysisTime = Date.now();
  }

  public updateSystemInfo(systemInfo: SystemInfo): void {
    this.systemInfo = systemInfo;
  }

  public updatePerformanceProfile(profile: PerformanceProfile): void {
    this.performanceProfile = profile;
  }

  public addMetrics(metrics: DeviceMetrics): void {
    this.metricsHistory.push(metrics);
    
    // Keep last 1000 metrics for analysis
    if (this.metricsHistory.length > 1000) {
      this.metricsHistory = this.metricsHistory.slice(-1000);
    }
  }

  public addTaskPerformance(taskMetrics: TaskPerformanceMetrics): void {
    this.taskPerformanceHistory.push(taskMetrics);
    
    // Keep last 500 task performance records
    if (this.taskPerformanceHistory.length > 500) {
      this.taskPerformanceHistory = this.taskPerformanceHistory.slice(-500);
    }
  }

  public generatePerformanceReport(): PerformanceReport {
    const deviceId = this.systemInfo?.deviceModel || 'unknown';
    const reportDate = new Date().toISOString();
    
    const averagePerformance = this.calculateAveragePerformance();
    const taskCompletionRate = this.calculateTaskCompletionRate();
    const reliabilityScore = this.calculateReliabilityScore();
    const recommendations = this.generateRecommendations();
    const historicalTrends = this.analyzeHistoricalTrends();

    const report: PerformanceReport = {
      deviceId,
      reportDate,
      averagePerformance,
      taskCompletionRate,
      reliabilityScore,
      recommendations,
      historicalTrends
    };

    this.performanceReports.push(report);
    return report;
  }

  private calculateAveragePerformance(): PerformanceReport['averagePerformance'] {
    if (this.metricsHistory.length === 0) {
      return {
        cpuUsage: 0,
        memoryUsage: 0,
        thermalState: 'unknown',
        batteryEfficiency: 0
      };
    }

    const recentMetrics = this.metricsHistory.slice(-100); // Last 100 metrics
    const avgCpu = recentMetrics.reduce((sum, m) => sum + m.cpuUsage, 0) / recentMetrics.length;
    const avgMemory = recentMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / recentMetrics.length;
    
    // Calculate most common thermal state
    const thermalStates = recentMetrics.map(m => m.thermalState);
    const mostCommonThermal = this.getMostCommon(thermalStates);
    
    // Calculate battery efficiency (lower is better)
    const batteryEfficiency = this.calculateBatteryEfficiency(recentMetrics);

    return {
      cpuUsage: Math.round(avgCpu * 100) / 100,
      memoryUsage: Math.round(avgMemory * 100) / 100,
      thermalState: mostCommonThermal,
      batteryEfficiency: Math.round(batteryEfficiency * 100) / 100
    };
  }

  private calculateTaskCompletionRate(): number {
    if (this.taskPerformanceHistory.length === 0) return 0;
    
    const completedTasks = this.taskPerformanceHistory.filter(t => t.success).length;
    return (completedTasks / this.taskPerformanceHistory.length) * 100;
  }

  private calculateReliabilityScore(): number {
    if (this.taskPerformanceHistory.length === 0) return 0;
    
    const factors = {
      taskCompletionRate: this.calculateTaskCompletionRate(),
      averagePerformance: this.calculateAveragePerformance(),
      systemStability: this.calculateSystemStability(),
      thermalManagement: this.calculateThermalManagement()
    };

    // Weighted reliability score
    const reliabilityScore = (
      factors.taskCompletionRate * 0.4 +
      (100 - factors.averagePerformance.cpuUsage) * 0.3 +
      factors.systemStability * 0.2 +
      factors.thermalManagement * 0.1
    );

    return Math.min(100, Math.max(0, reliabilityScore));
  }

  private calculateSystemStability(): number {
    if (this.metricsHistory.length < 10) return 50;
    
    const recentMetrics = this.metricsHistory.slice(-50);
    const cpuVariance = this.calculateVariance(recentMetrics.map(m => m.cpuUsage));
    const memoryVariance = this.calculateVariance(recentMetrics.map(m => m.memoryUsage));
    
    // Lower variance = higher stability
    const stabilityScore = 100 - Math.min(100, (cpuVariance + memoryVariance) / 2);
    return Math.max(0, stabilityScore);
  }

  private calculateThermalManagement(): number {
    if (this.metricsHistory.length === 0) return 50;
    
    const recentMetrics = this.metricsHistory.slice(-100);
    const thermalStates = recentMetrics.map(m => m.thermalState);
    
    const stateScores = {
      'nominal': 100,
      'fair': 75,
      'serious': 40,
      'critical': 10
    };
    
    const avgScore = thermalStates.reduce((sum, state) => {
      return sum + (stateScores[state as keyof typeof stateScores] || 50);
    }, 0) / thermalStates.length;
    
    return avgScore;
  }

  private calculateBatteryEfficiency(metrics: DeviceMetrics[]): number {
    if (metrics.length < 2) return 0;
    
    const batteryDrain = metrics[0].batteryLevel - metrics[metrics.length - 1].batteryLevel;
    const timeElapsed = metrics[metrics.length - 1].timestamp - metrics[0].timestamp;
    
    // Battery efficiency: % per hour
    const hoursElapsed = timeElapsed / (1000 * 60 * 60);
    return hoursElapsed > 0 ? batteryDrain / hoursElapsed : 0;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const avgPerf = this.calculateAveragePerformance();
    
    if (avgPerf.cpuUsage > 80) {
      recommendations.push('Consider reducing concurrent tasks to improve CPU efficiency');
    }
    
    if (avgPerf.memoryUsage > 85) {
      recommendations.push('Memory usage is high - optimize memory-intensive tasks');
    }
    
    if (avgPerf.thermalState === 'serious' || avgPerf.thermalState === 'critical') {
      recommendations.push('Device is overheating - implement thermal throttling');
    }
    
    if (avgPerf.batteryEfficiency > 10) {
      recommendations.push('High battery drain detected - optimize power consumption');
    }
    
    const taskCompletionRate = this.calculateTaskCompletionRate();
    if (taskCompletionRate < 90) {
      recommendations.push('Task completion rate is low - investigate task failures');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Device is performing optimally');
    }
    
    return recommendations;
  }

  private analyzeHistoricalTrends(): PerformanceReport['historicalTrends'] {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    const recentMetrics = this.metricsHistory.filter(m => m.timestamp >= oneDayAgo);
    const olderMetrics = this.metricsHistory.filter(m => m.timestamp >= oneWeekAgo && m.timestamp < oneDayAgo);
    
    if (recentMetrics.length === 0 || olderMetrics.length === 0) {
      return {
        period: '24h',
        performanceChange: 0,
        trend: 'stable'
      };
    }
    
    const recentAvgPerf = this.calculateAveragePerformanceForMetrics(recentMetrics);
    const olderAvgPerf = this.calculateAveragePerformanceForMetrics(olderMetrics);
    
    const performanceChange = recentAvgPerf - olderAvgPerf;
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    
    if (performanceChange > 5) {
      trend = 'improving';
    } else if (performanceChange < -5) {
      trend = 'declining';
    }
    
    return {
      period: '24h',
      performanceChange: Math.round(performanceChange * 100) / 100,
      trend
    };
  }

  private calculateAveragePerformanceForMetrics(metrics: DeviceMetrics[]): number {
    if (metrics.length === 0) return 0;
    
    const avgCpu = metrics.reduce((sum, m) => sum + m.cpuUsage, 0) / metrics.length;
    const avgMemory = metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / metrics.length;
    
    // Lower usage = better performance
    return 100 - ((avgCpu + avgMemory) / 2);
  }

  public getOptimizationSuggestions(): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const avgPerf = this.calculateAveragePerformance();
    const reliability = this.calculateReliabilityScore();
    
    if (avgPerf.cpuUsage > 70) {
      suggestions.push({
        category: 'performance',
        priority: 'high',
        title: 'Optimize CPU Usage',
        description: 'Implement task scheduling to reduce CPU load during peak times',
        expectedImprovement: 25,
        implementationComplexity: 'medium',
        estimatedImpact: 'Reduce CPU usage by 15-30%'
      });
    }
    
    if (avgPerf.memoryUsage > 75) {
      suggestions.push({
        category: 'performance',
        priority: 'medium',
        title: 'Memory Optimization',
        description: 'Implement memory pooling and garbage collection optimization',
        expectedImprovement: 20,
        implementationComplexity: 'medium',
        estimatedImpact: 'Reduce memory usage by 10-25%'
      });
    }
    
    if (avgPerf.batteryEfficiency > 8) {
      suggestions.push({
        category: 'efficiency',
        priority: 'high',
        title: 'Battery Life Optimization',
        description: 'Implement power-aware task scheduling and background processing limits',
        expectedImprovement: 30,
        implementationComplexity: 'hard',
        estimatedImpact: 'Extend battery life by 20-40%'
      });
    }
    
    if (reliability < 85) {
      suggestions.push({
        category: 'reliability',
        priority: 'critical',
        title: 'System Stability Improvement',
        description: 'Implement error recovery mechanisms and system monitoring',
        expectedImprovement: 15,
        implementationComplexity: 'medium',
        estimatedImpact: 'Improve system reliability by 10-20%'
      });
    }
    
    return suggestions;
  }

  public getTaskTypePerformance(): Record<string, {
    averageDuration: number;
    successRate: number;
    averageCpuUsage: number;
    averageMemoryUsage: number;
    averageBatteryDrain: number;
  }> {
    const taskTypes: Record<string, TaskPerformanceMetrics[]> = {};
    
    // Group tasks by type
    this.taskPerformanceHistory.forEach(task => {
      if (!taskTypes[task.taskType]) {
        taskTypes[task.taskType] = [];
      }
      taskTypes[task.taskType].push(task);
    });
    
    // Calculate performance metrics for each type
    const result: Record<string, any> = {};
    
    Object.entries(taskTypes).forEach(([type, tasks]) => {
      const successfulTasks = tasks.filter(t => t.success);
      const successRate = (successfulTasks.length / tasks.length) * 100;
      
      result[type] = {
        averageDuration: tasks.reduce((sum, t) => sum + t.duration, 0) / tasks.length,
        successRate,
        averageCpuUsage: tasks.reduce((sum, t) => sum + t.cpuUsageAvg, 0) / tasks.length,
        averageMemoryUsage: tasks.reduce((sum, t) => sum + t.memoryUsageAvg, 0) / tasks.length,
        averageBatteryDrain: tasks.reduce((sum, t) => sum + t.batteryDrain, 0) / tasks.length
      };
    });
    
    return result;
  }

  public predictOptimalTaskScheduling(): {
    recommendedTimeSlots: { start: number; end: number; score: number }[];
    peakPerformanceHours: number[];
    lowPerformanceHours: number[];
  } {
    // Analyze historical performance by hour
    const hourlyPerformance: Record<number, number[]> = {};
    
    this.metricsHistory.forEach(metric => {
      const hour = new Date(metric.timestamp).getHours();
      if (!hourlyPerformance[hour]) {
        hourlyPerformance[hour] = [];
      }
      
      const performanceScore = 100 - ((metric.cpuUsage + metric.memoryUsage) / 2);
      hourlyPerformance[hour].push(performanceScore);
    });
    
    // Calculate average performance for each hour
    const avgHourlyPerformance: Record<number, number> = {};
    Object.entries(hourlyPerformance).forEach(([hour, scores]) => {
      avgHourlyPerformance[parseInt(hour)] = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    });
    
    // Generate recommendations
    const recommendedTimeSlots: { start: number; end: number; score: number }[] = [];
    const peakPerformanceHours: number[] = [];
    const lowPerformanceHours: number[] = [];
    
    Object.entries(avgHourlyPerformance).forEach(([hour, score]) => {
      const hourNum = parseInt(hour);
      
      if (score > 75) {
        peakPerformanceHours.push(hourNum);
        recommendedTimeSlots.push({
          start: hourNum,
          end: hourNum + 1,
          score
        });
      } else if (score < 50) {
        lowPerformanceHours.push(hourNum);
      }
    });
    
    return {
      recommendedTimeSlots: recommendedTimeSlots.sort((a, b) => b.score - a.score),
      peakPerformanceHours: peakPerformanceHours.sort((a, b) => avgHourlyPerformance[b] - avgHourlyPerformance[a]),
      lowPerformanceHours: lowPerformanceHours.sort((a, b) => avgHourlyPerformance[a] - avgHourlyPerformance[b])
    };
  }

  // Utility methods
  private getMostCommon<T>(array: T[]): T {
    if (array.length === 0) return array[0];
    
    const counts: Record<string, number> = {};
    array.forEach(item => {
      const key = String(item);
      counts[key] = (counts[key] || 0) + 1;
    });
    
    return Object.entries(counts).reduce((a, b) => counts[a[0]] > counts[b[0]] ? a : b)[0] as T;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance);
  }

  public getPerformanceReports(): PerformanceReport[] {
    return [...this.performanceReports];
  }

  public getLatestReport(): PerformanceReport | null {
    return this.performanceReports.length > 0 ? 
      this.performanceReports[this.performanceReports.length - 1] : null;
  }
} 