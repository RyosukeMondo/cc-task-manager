import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { persist, createJSONStorage } from 'zustand/middleware';
import { TaskState, TaskStatus, ProcessConfig, WorkerConfig } from '@cc-task-manager/types';
import type {
  IMainStore,
  IUIState,
  IAuthState,
  ITaskState,
  IProcessState,
  User,
  Notification,
  TaskFilters,
  SystemMetrics,
} from './interfaces';

// Initial state values
const initialUIState: IUIState = {
  theme: 'system',
  sidebarOpen: true,
  loading: false,
  notifications: [],
};

const initialAuthState: IAuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  permissions: [],
};

const initialTaskState: ITaskState = {
  activeTasks: new Map(),
  selectedTaskId: null,
  taskHistory: [],
  filters: {},
};

const initialProcessState: IProcessState = {
  processes: new Map(),
  workers: new Map(),
  systemMetrics: {
    cpuUsage: 0,
    memoryUsage: 0,
    activeConnections: 0,
    tasksPerSecond: 0,
    lastUpdated: new Date(),
  },
};

/**
 * Main client store using Zustand with persistence and subscriptions
 * Implements the IMainStore interface following Dependency Inversion Principle
 */
export const useClientStore = create<IMainStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // State
        ui: initialUIState,
        auth: initialAuthState,
        task: initialTaskState,
        process: initialProcessState,

        // UI Actions
        setTheme: (theme) =>
          set((state) => ({
            ui: { ...state.ui, theme },
          })),

        toggleSidebar: () =>
          set((state) => ({
            ui: { ...state.ui, sidebarOpen: !state.ui.sidebarOpen },
          })),

        setLoading: (loading) =>
          set((state) => ({
            ui: { ...state.ui, loading },
          })),

        addNotification: (notification) => {
          const newNotification: Notification = {
            ...notification,
            id: crypto.randomUUID(),
            timestamp: new Date(),
            read: false,
          };

          set((state) => ({
            ui: {
              ...state.ui,
              notifications: [...state.ui.notifications, newNotification],
            },
          }));
        },

        removeNotification: (id) =>
          set((state) => ({
            ui: {
              ...state.ui,
              notifications: state.ui.notifications.filter((n) => n.id !== id),
            },
          })),

        markNotificationRead: (id) =>
          set((state) => ({
            ui: {
              ...state.ui,
              notifications: state.ui.notifications.map((n) =>
                n.id === id ? { ...n, read: true } : n
              ),
            },
          })),

        // Auth Actions
        login: async (email, password) => {
          set((state) => ({ ui: { ...state.ui, loading: true } }));

          try {
            // This would typically call an API endpoint
            // For now, simulating authentication
            const response = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
              throw new Error('Authentication failed');
            }

            const { user, token, permissions } = await response.json();

            set((state) => ({
              auth: {
                ...state.auth,
                user,
                token,
                isAuthenticated: true,
                permissions,
              },
              ui: { ...state.ui, loading: false },
            }));
          } catch (error) {
            set((state) => ({ ui: { ...state.ui, loading: false } }));
            get().addNotification({
              type: 'error',
              title: 'Authentication Error',
              message: error instanceof Error ? error.message : 'Login failed',
            });
            throw error;
          }
        },

        logout: () =>
          set((state) => ({
            auth: initialAuthState,
            ui: { ...state.ui, loading: false },
          })),

        setUser: (user) =>
          set((state) => ({
            auth: { ...state.auth, user },
          })),

        setToken: (token) =>
          set((state) => ({
            auth: { ...state.auth, token },
          })),

        updatePermissions: (permissions) =>
          set((state) => ({
            auth: { ...state.auth, permissions },
          })),

        // Task Actions
        updateTaskStatus: (taskId, status) => {
          set((state) => {
            const newActiveTasks = new Map(state.task.activeTasks);
            newActiveTasks.set(taskId, status);

            return {
              task: {
                ...state.task,
                activeTasks: newActiveTasks,
              },
            };
          });
        },

        selectTask: (taskId) =>
          set((state) => ({
            task: { ...state.task, selectedTaskId: taskId },
          })),

        addTaskToHistory: (status) =>
          set((state) => ({
            task: {
              ...state.task,
              taskHistory: [status, ...state.task.taskHistory].slice(0, 100), // Keep last 100
            },
          })),

        setFilters: (filters) =>
          set((state) => ({
            task: {
              ...state.task,
              filters: { ...state.task.filters, ...filters },
            },
          })),

        clearActiveTasks: () =>
          set((state) => ({
            task: { ...state.task, activeTasks: new Map() },
          })),

        // Process Actions
        updateProcess: (processId, config) => {
          set((state) => {
            const newProcesses = new Map(state.process.processes);
            newProcesses.set(processId, config);

            return {
              process: {
                ...state.process,
                processes: newProcesses,
              },
            };
          });
        },

        removeProcess: (processId) => {
          set((state) => {
            const newProcesses = new Map(state.process.processes);
            newProcesses.delete(processId);

            return {
              process: {
                ...state.process,
                processes: newProcesses,
              },
            };
          });
        },

        updateWorker: (workerId, config) => {
          set((state) => {
            const newWorkers = new Map(state.process.workers);
            newWorkers.set(workerId, config);

            return {
              process: {
                ...state.process,
                workers: newWorkers,
              },
            };
          });
        },

        removeWorker: (workerId) => {
          set((state) => {
            const newWorkers = new Map(state.process.workers);
            newWorkers.delete(workerId);

            return {
              process: {
                ...state.process,
                workers: newWorkers,
              },
            };
          });
        },

        updateSystemMetrics: (metrics) =>
          set((state) => ({
            process: {
              ...state.process,
              systemMetrics: metrics,
            },
          })),
      }),
      {
        name: 'cc-task-manager-store',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          // Only persist certain parts of the state
          ui: {
            theme: state.ui.theme,
            sidebarOpen: state.ui.sidebarOpen,
          },
          auth: {
            token: state.auth.token,
            user: state.auth.user,
            permissions: state.auth.permissions,
            isAuthenticated: state.auth.isAuthenticated,
          },
          task: {
            filters: state.task.filters,
            selectedTaskId: state.task.selectedTaskId,
          },
        }),
        // Custom serialization for Maps
        serialize: (state) => {
          const serializedState = {
            ...state,
            state: {
              ...state.state,
              task: {
                ...state.state.task,
                activeTasks: Array.from(state.state.task.activeTasks.entries()),
              },
              process: {
                ...state.state.process,
                processes: Array.from(state.state.process.processes.entries()),
                workers: Array.from(state.state.process.workers.entries()),
              },
            },
          };
          return JSON.stringify(serializedState);
        },
        deserialize: (str) => {
          const state = JSON.parse(str);
          if (state.state?.task?.activeTasks) {
            state.state.task.activeTasks = new Map(state.state.task.activeTasks);
          }
          if (state.state?.process?.processes) {
            state.state.process.processes = new Map(state.state.process.processes);
          }
          if (state.state?.process?.workers) {
            state.state.process.workers = new Map(state.state.process.workers);
          }
          return state;
        },
      }
    )
  )
);

// Selector hooks for optimized re-renders
export const useUIStore = () => useClientStore((state) => state.ui);
export const useAuthStore = () => useClientStore((state) => state.auth);
export const useTaskStore = () => useClientStore((state) => state.task);
export const useProcessStore = () => useClientStore((state) => state.process);

// Action hooks
export const useUIActions = () => useClientStore((state) => ({
  setTheme: state.setTheme,
  toggleSidebar: state.toggleSidebar,
  setLoading: state.setLoading,
  addNotification: state.addNotification,
  removeNotification: state.removeNotification,
  markNotificationRead: state.markNotificationRead,
}));

export const useAuthActions = () => useClientStore((state) => ({
  login: state.login,
  logout: state.logout,
  setUser: state.setUser,
  setToken: state.setToken,
  updatePermissions: state.updatePermissions,
}));

export const useTaskActions = () => useClientStore((state) => ({
  updateTaskStatus: state.updateTaskStatus,
  selectTask: state.selectTask,
  addTaskToHistory: state.addTaskToHistory,
  setFilters: state.setFilters,
  clearActiveTasks: state.clearActiveTasks,
}));

export const useProcessActions = () => useClientStore((state) => ({
  updateProcess: state.updateProcess,
  removeProcess: state.removeProcess,
  updateWorker: state.updateWorker,
  removeWorker: state.removeWorker,
  updateSystemMetrics: state.updateSystemMetrics,
}));