import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';

interface Task {
  id: string;
  taskType: string;
  reward: number;
  estimatedDuration: number;
  requirements: {
    cpu_cores: number;
    ram_gb: number;
    gpu_required: boolean;
  };
  status: 'pending' | 'assigned' | 'in_progress' | 'completed';
}

interface DeviceStatus {
  isRegistered: boolean;
  isActive: boolean;
  currentLoad: number;
  reputation: number;
  totalTasksCompleted: number;
  totalTokensEarned: number;
}

interface TaskQueueProps {
  deviceStatus: DeviceStatus;
  onTaskUpdate: () => void;
}

export function TaskQueue({ deviceStatus, onTaskUpdate }: TaskQueueProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadAvailableTasks();
  }, [deviceStatus.isActive]);

  const loadAvailableTasks = async () => {
    // Mock data - in real implementation, this would fetch from the network
    const mockTasks: Task[] = [
      {
        id: '1',
        taskType: 'ML Inference',
        reward: 50,
        estimatedDuration: 300,
        requirements: {
          cpu_cores: 2,
          ram_gb: 4,
          gpu_required: true,
        },
        status: 'pending',
      },
      {
        id: '2',
        taskType: 'Data Processing',
        reward: 25,
        estimatedDuration: 180,
        requirements: {
          cpu_cores: 1,
          ram_gb: 2,
          gpu_required: false,
        },
        status: 'pending',
      },
      {
        id: '3',
        taskType: 'Image Processing',
        reward: 75,
        estimatedDuration: 450,
        requirements: {
          cpu_cores: 4,
          ram_gb: 8,
          gpu_required: true,
        },
        status: 'pending',
      },
    ];

    setTasks(mockTasks);
  };

  const acceptTask = async (task: Task) => {
    try {
      setIsLoading(true);
      
      // Mock task acceptance
      setCurrentTask(task);
      setTasks(prev => prev.filter(t => t.id !== task.id));
      
      Alert.alert('Task Accepted', `You've accepted the ${task.taskType} task!`);
      
      // Simulate task completion after some time
      setTimeout(() => {
        completeTask(task);
      }, 5000);
      
    } catch (error) {
      console.error('Error accepting task:', error);
      Alert.alert('Error', 'Failed to accept task. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const completeTask = async (task: Task) => {
    try {
      setCurrentTask(null);
      onTaskUpdate();
      
      Alert.alert(
        'Task Completed',
        `You've earned ${task.reward} tokens for completing the ${task.taskType} task!`
      );
      
      // Reload available tasks
      loadAvailableTasks();
      
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  const getTaskTypeColor = (taskType: string) => {
    switch (taskType) {
      case 'ML Inference':
        return '#007AFF';
      case 'Data Processing':
        return '#34C759';
      case 'Image Processing':
        return '#FF9500';
      default:
        return '#888';
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  };

  const renderTask = ({ item }: { item: Task }) => (
    <View style={styles.taskItem}>
      <View style={styles.taskHeader}>
        <View style={[styles.taskTypeBadge, { backgroundColor: getTaskTypeColor(item.taskType) }]}>
          <Text style={styles.taskTypeText}>{item.taskType}</Text>
        </View>
        <Text style={styles.taskReward}>{item.reward} SMC</Text>
      </View>
      
      <View style={styles.taskDetails}>
        <Text style={styles.taskDetailText}>
          Duration: {formatDuration(item.estimatedDuration)}
        </Text>
        <Text style={styles.taskDetailText}>
          CPU: {item.requirements.cpu_cores} cores
        </Text>
        <Text style={styles.taskDetailText}>
          RAM: {item.requirements.ram_gb} GB
        </Text>
        <Text style={styles.taskDetailText}>
          GPU: {item.requirements.gpu_required ? 'Required' : 'Not Required'}
        </Text>
      </View>
      
      <TouchableOpacity
        style={styles.acceptButton}
        onPress={() => acceptTask(item)}
        disabled={isLoading}
      >
        <Text style={styles.acceptButtonText}>
          {isLoading ? 'Accepting...' : 'Accept Task'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (!deviceStatus.isRegistered || !deviceStatus.isActive) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Task Queue</Text>
        <View style={styles.inactiveContainer}>
          <Text style={styles.inactiveText}>
            Device must be registered and active to receive tasks
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Task Queue</Text>
      
      {currentTask && (
        <View style={styles.currentTaskContainer}>
          <Text style={styles.currentTaskTitle}>Current Task</Text>
          <View style={styles.currentTask}>
            <View style={[styles.taskTypeBadge, { backgroundColor: getTaskTypeColor(currentTask.taskType) }]}>
              <Text style={styles.taskTypeText}>{currentTask.taskType}</Text>
            </View>
            <Text style={styles.currentTaskStatus}>In Progress...</Text>
          </View>
        </View>
      )}
      
      <FlatList
        data={tasks}
        renderItem={renderTask}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No tasks available at the moment</Text>
          </View>
        }
      />
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
  inactiveContainer: {
    padding: 20,
    alignItems: 'center',
  },
  inactiveText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  currentTaskContainer: {
    marginBottom: 16,
  },
  currentTaskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  currentTask: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  currentTaskStatus: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  taskItem: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  taskTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  taskReward: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#34C759',
  },
  taskDetails: {
    marginBottom: 12,
  },
  taskDetailText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  acceptButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
}); 