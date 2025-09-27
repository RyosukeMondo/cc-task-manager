import { TaskState, TaskStatus, ProcessConfig, WorkerConfig, ClaudeCodeOptions } from '@cc-task-manager/types';

/**
 * Abstract interfaces for state management following Dependency Inversion Principle
 * These interfaces define contracts that concrete stores must implement
 */

export interface IUIState {
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  loading: boolean;
  notifications: Notification[];
}

export interface IAuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  permissions: string[];
}

export interface ITaskState {
  activeTasks: Map<string, TaskStatus>;
  selectedTaskId: string | null;
  taskHistory: TaskStatus[];
  filters: TaskFilters;
}

export interface IProcessState {
  processes: Map<string, ProcessConfig>;
  workers: Map<string, WorkerConfig>;
  systemMetrics: SystemMetrics;
}

export interface IClientStore {
  ui: IUIState;
  auth: IAuthState;
  task: ITaskState;
  process: IProcessState;
}

// Supporting types
export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  language: string;
  timezone: string;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  action?: NotificationAction;
}

export interface NotificationAction {
  label: string;
  action: () => void;
}

export interface TaskFilters {
  state?: TaskState[];
  dateRange?: { start: Date; end: Date };
  search?: string;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  tasksPerSecond: number;
  lastUpdated: Date;
}

// Store action interfaces following DIP
export interface IUIActions {
  setTheme: (theme: IUIState['theme']) => void;
  toggleSidebar: () => void;
  setLoading: (loading: boolean) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  removeNotification: (id: string) => void;
  markNotificationRead: (id: string) => void;
}

export interface IAuthActions {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  updatePermissions: (permissions: string[]) => void;
}

export interface ITaskActions {
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  selectTask: (taskId: string | null) => void;
  addTaskToHistory: (status: TaskStatus) => void;
  setFilters: (filters: Partial<TaskFilters>) => void;
  clearActiveTasks: () => void;
}

export interface IProcessActions {
  updateProcess: (processId: string, config: ProcessConfig) => void;
  removeProcess: (processId: string) => void;
  updateWorker: (workerId: string, config: WorkerConfig) => void;
  removeWorker: (workerId: string) => void;
  updateSystemMetrics: (metrics: SystemMetrics) => void;
}

// Combined store interface
export interface IStoreActions extends IUIActions, IAuthActions, ITaskActions, IProcessActions {}

// Main store interface combining state and actions
export interface IMainStore extends IClientStore, IStoreActions {}