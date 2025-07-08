import { Platform } from 'react-native';
import * as Application from 'expo-application';

export interface DeviceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  batteryLevel: number;
  batteryState: string;
  thermalState: string;
  networkType: string;
  networkSpeed: number;
  storageUsed: number;
  storageTotal: number;
  uptime: number;
  timestamp: number;
}

export interface SystemInfo {
  platform: string;
  osVersion: string;
  deviceModel: string;
  deviceManufacturer: string;
  totalMemory: number;
  processorCount: number;
  isEmulator: boolean;
  hasGPU: boolean;
  gpuInfo: string;
}

export interface PerformanceProfile {
  computeScore: number;
  memoryScore: number;
  networkScore: number;
  thermalScore: number;
  overallScore: number;
  tier: 'low' | 'medium' | 'high' | 'premium';
}

export class DeviceMonitor {
  private metrics: DeviceMetrics[] = [];
  private systemInfo: SystemInfo | null = null;
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private performanceProfile: PerformanceProfile | null = null;

  constructor() {
    this.initializeSystemInfo();
  }

  private async initializeSystemInfo(): Promise<void> {
    try {
      const systemInfo: SystemInfo = {
        platform: Platform.OS,
        osVersion: Platform.Version.toString(),
        deviceModel: await this.getDeviceModel(),
        deviceManufacturer: await this.getDeviceManufacturer(),
        totalMemory: await this.getTotalMemory(),
        processorCount: await this.getProcessorCount(),
        isEmulator: await this.isEmulatorDevice(),
        hasGPU: await this.hasGPUSupport(),
        gpuInfo: await this.getGPUInfo(),
      };

      this.systemInfo = systemInfo;
      this.performanceProfile = this.calculatePerformanceProfile();
    } catch (error) {
      console.error('Failed to initialize system info:', error);
    }
  }

  private async getDeviceModel(): Promise<string> {
    try {
      if (Platform.OS === 'ios') {
        return await Application.getIosIdForVendorAsync() || 'Unknown iOS Device';
      } else {
        return 'Android Device'; // In real implementation, use device info library
      }
    } catch {
      return 'Unknown Device';
    }
  }

  private async getDeviceManufacturer(): Promise<string> {
    try {
      return Platform.OS === 'ios' ? 'Apple' : 'Android OEM';
    } catch {
      return 'Unknown';
    }
  }

  private async getTotalMemory(): Promise<number> {
    // Mock implementation - in real app, use native modules
    const memoryTiers = {
      low: 4,
      medium: 8,
      high: 12,
      premium: 16
    };
    return memoryTiers.medium * 1024 * 1024 * 1024; // 8GB in bytes
  }

  private async getProcessorCount(): Promise<number> {
    // Mock implementation - in real app, use native modules
    return Math.max(4, Math.floor(Math.random() * 4) + 4); // 4-8 cores
  }

  private async isEmulatorDevice(): Promise<boolean> {
    try {
      return __DEV__ && Platform.OS === 'ios' ? false : false;
    } catch {
      return false;
    }
  }

  private async hasGPUSupport(): Promise<boolean> {
    // Mock implementation - in real app, check hardware capabilities
    return true;
  }

  private async getGPUInfo(): Promise<string> {
    // Mock implementation - in real app, get actual GPU info
    if (Platform.OS === 'ios') {
      return 'Apple GPU';
    } else {
      return 'Adreno/Mali GPU';
    }
  }

  private calculatePerformanceProfile(): PerformanceProfile {
    if (!this.systemInfo) {
      return {
        computeScore: 0,
        memoryScore: 0,
        networkScore: 0,
        thermalScore: 0,
        overallScore: 0,
        tier: 'low'
      };
    }

    const computeScore = this.calculateComputeScore();
    const memoryScore = this.calculateMemoryScore();
    const networkScore = 80; // Mock network score
    const thermalScore = 85; // Mock thermal score

    const overallScore = (computeScore + memoryScore + networkScore + thermalScore) / 4;
    const tier = this.determineTier(overallScore);

    return {
      computeScore,
      memoryScore,
      networkScore,
      thermalScore,
      overallScore,
      tier
    };
  }

  private calculateComputeScore(): number {
    if (!this.systemInfo) return 0;
    
    const baseScore = this.systemInfo.processorCount * 10;
    const platformBonus = Platform.OS === 'ios' ? 20 : 15;
    const gpuBonus = this.systemInfo.hasGPU ? 15 : 0;
    
    return Math.min(100, baseScore + platformBonus + gpuBonus);
  }

  private calculateMemoryScore(): number {
    if (!this.systemInfo) return 0;
    
    const totalMemoryGB = this.systemInfo.totalMemory / (1024 * 1024 * 1024);
    return Math.min(100, (totalMemoryGB / 16) * 100);
  }

  private determineTier(score: number): 'low' | 'medium' | 'high' | 'premium' {
    if (score >= 90) return 'premium';
    if (score >= 75) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  public async startMonitoring(intervalMs: number = 5000): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
    }, intervalMs);

    // Collect initial metrics
    await this.collectMetrics();
  }

  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
  }

  private async collectMetrics(): Promise<void> {
    try {
      const metrics: DeviceMetrics = {
        cpuUsage: await this.getCPUUsage(),
        memoryUsage: await this.getMemoryUsage(),
        batteryLevel: await this.getBatteryLevel(),
        batteryState: await this.getBatteryState(),
        thermalState: await this.getThermalState(),
        networkType: await this.getNetworkType(),
        networkSpeed: await this.getNetworkSpeed(),
        storageUsed: await this.getStorageUsed(),
        storageTotal: await this.getStorageTotal(),
        uptime: await this.getUptime(),
        timestamp: Date.now(),
      };

      this.metrics.push(metrics);
      
      // Keep only last 100 metrics to prevent memory issues
      if (this.metrics.length > 100) {
        this.metrics = this.metrics.slice(-100);
      }
    } catch (error) {
      console.error('Failed to collect metrics:', error);
    }
  }

  private async getCPUUsage(): Promise<number> {
    // Mock implementation - in real app, use native modules
    return Math.random() * 100;
  }

  private async getMemoryUsage(): Promise<number> {
    // Mock implementation - in real app, use native modules
    return Math.random() * 100;
  }

  private async getBatteryLevel(): Promise<number> {
    // Mock implementation - in real app, use expo-battery
    return Math.random() * 100;
  }

  private async getBatteryState(): Promise<string> {
    // Mock implementation - in real app, use expo-battery
    const states = ['charging', 'discharging', 'full', 'unknown'];
    return states[Math.floor(Math.random() * states.length)];
  }

  private async getThermalState(): Promise<string> {
    // Mock implementation - in real app, use native modules
    const states = ['nominal', 'fair', 'serious', 'critical'];
    return states[Math.floor(Math.random() * states.length)];
  }

  private async getNetworkType(): Promise<string> {
    // Mock implementation - in real app, use @react-native-community/netinfo
    const types = ['wifi', '5g', '4g', '3g', 'none'];
    return types[Math.floor(Math.random() * types.length)];
  }

  private async getNetworkSpeed(): Promise<number> {
    // Mock implementation - in real app, perform speed test
    return Math.random() * 1000; // Mbps
  }

  private async getStorageUsed(): Promise<number> {
    // Mock implementation - in real app, use file system APIs
    return Math.random() * 128 * 1024 * 1024 * 1024; // GB in bytes
  }

  private async getStorageTotal(): Promise<number> {
    // Mock implementation - in real app, use file system APIs
    return 128 * 1024 * 1024 * 1024; // 128GB in bytes
  }

  private async getUptime(): Promise<number> {
    // Mock implementation - in real app, use native modules
    return Date.now() - (Math.random() * 86400000); // Random uptime up to 24 hours
  }

  public getCurrentMetrics(): DeviceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  public getMetricsHistory(): DeviceMetrics[] {
    return [...this.metrics];
  }

  public getSystemInfo(): SystemInfo | null {
    return this.systemInfo;
  }

  public getPerformanceProfile(): PerformanceProfile | null {
    return this.performanceProfile;
  }

  public getAverageMetrics(minutes: number = 5): Partial<DeviceMetrics> | null {
    const cutoffTime = Date.now() - (minutes * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoffTime);
    
    if (recentMetrics.length === 0) return null;

    const average = recentMetrics.reduce((acc, metrics) => ({
      cpuUsage: acc.cpuUsage + metrics.cpuUsage,
      memoryUsage: acc.memoryUsage + metrics.memoryUsage,
      batteryLevel: acc.batteryLevel + metrics.batteryLevel,
      networkSpeed: acc.networkSpeed + metrics.networkSpeed,
    }), {
      cpuUsage: 0,
      memoryUsage: 0,
      batteryLevel: 0,
      networkSpeed: 0,
    });

    const count = recentMetrics.length;
    return {
      cpuUsage: average.cpuUsage / count,
      memoryUsage: average.memoryUsage / count,
      batteryLevel: average.batteryLevel / count,
      networkSpeed: average.networkSpeed / count,
    };
  }

  public canHandleTask(requirements: {
    cpuCores: number;
    memoryGB: number;
    gpuRequired: boolean;
    estimatedDuration: number;
  }): boolean {
    if (!this.systemInfo || !this.performanceProfile) return false;

    const currentMetrics = this.getCurrentMetrics();
    if (!currentMetrics) return false;

    // Check system requirements
    if (requirements.cpuCores > this.systemInfo.processorCount) return false;
    if (requirements.memoryGB > (this.systemInfo.totalMemory / (1024 * 1024 * 1024))) return false;
    if (requirements.gpuRequired && !this.systemInfo.hasGPU) return false;

    // Check current resource usage
    if (currentMetrics.cpuUsage > 80) return false;
    if (currentMetrics.memoryUsage > 85) return false;
    if (currentMetrics.batteryLevel < 20) return false;
    if (currentMetrics.thermalState === 'critical') return false;

    // Check estimated duration vs battery
    const estimatedBatteryDrain = requirements.estimatedDuration * 0.1; // 0.1% per second
    if (currentMetrics.batteryLevel < estimatedBatteryDrain) return false;

    return true;
  }

  public getOptimalTaskCapacity(): {
    maxConcurrentTasks: number;
    recommendedTaskTypes: string[];
    currentLoad: number;
  } {
    const currentMetrics = this.getCurrentMetrics();
    const profile = this.getPerformanceProfile();
    
    if (!currentMetrics || !profile) {
      return {
        maxConcurrentTasks: 0,
        recommendedTaskTypes: [],
        currentLoad: 100,
      };
    }

    const currentLoad = Math.max(currentMetrics.cpuUsage, currentMetrics.memoryUsage);
    const availableCapacity = 100 - currentLoad;
    
    let maxConcurrentTasks = 0;
    let recommendedTaskTypes: string[] = [];

    switch (profile.tier) {
      case 'premium':
        maxConcurrentTasks = Math.floor(availableCapacity / 20);
        recommendedTaskTypes = ['MLInference', 'VideoTranscoding', 'ImageProcessing', 'DataProcessing'];
        break;
      case 'high':
        maxConcurrentTasks = Math.floor(availableCapacity / 25);
        recommendedTaskTypes = ['MLInference', 'ImageProcessing', 'DataProcessing'];
        break;
      case 'medium':
        maxConcurrentTasks = Math.floor(availableCapacity / 35);
        recommendedTaskTypes = ['DataProcessing', 'GeneralCompute'];
        break;
      case 'low':
        maxConcurrentTasks = Math.floor(availableCapacity / 50);
        recommendedTaskTypes = ['GeneralCompute'];
        break;
    }

    return {
      maxConcurrentTasks: Math.max(0, maxConcurrentTasks),
      recommendedTaskTypes,
      currentLoad,
    };
  }
} 