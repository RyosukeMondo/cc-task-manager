# Authentication System

A comprehensive JWT-based authentication system with role-based UI adaptation following SOLID principles.

## Features

- 🔐 JWT token management with secure storage
- 👥 Role-based access control (Admin, User, Viewer)
- 🛡️ Permission-based UI components
- 🔄 Automatic token refresh
- 🚧 Route protection middleware
- 📱 Responsive design support
- ♿ Accessibility compliance

## Quick Start

### 1. Wrap your app with AuthProvider

```tsx
// app/layout.tsx
import { AuthProvider } from '@/lib/auth';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider apiBaseUrl={process.env.NEXT_PUBLIC_API_URL}>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

### 2. Use authentication in components

```tsx
// components/LoginForm.tsx
import { useAuth, useAuthActions } from '@/lib/auth';

export function LoginForm() {
  const { isLoading } = useAuth();
  const { login } = useAuthActions();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const result = await login({ email, password });
    if (result.success) {
      router.push('/dashboard');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
    </form>
  );
}
```

### 3. Role-based UI components

```tsx
// components/AdminPanel.tsx
import { AdminOnly, CanAccess, MinRole } from '@/lib/auth';

export function AdminPanel() {
  return (
    <div>
      <AdminOnly>
        <button>Admin Settings</button>
      </AdminOnly>

      <CanAccess permission="tasks:create">
        <button>Create Task</button>
      </CanAccess>

      <MinRole minRole="user">
        <button>User Features</button>
      </MinRole>
    </div>
  );
}
```

### 4. Permission hooks

```tsx
// components/TaskList.tsx
import { usePermissions, useCurrentUser } from '@/lib/auth';

export function TaskList() {
  const { canManageTasks, canViewTasks } = usePermissions();
  const { user, role } = useCurrentUser();

  return (
    <div>
      {canViewTasks() && <TaskGrid />}
      {canManageTasks() && <CreateTaskButton />}
      <p>Welcome, {user?.email} ({role})</p>
    </div>
  );
}
```

## Architecture

### SOLID Principles Implementation

#### Single Responsibility Principle (SRP)
- `TokenStorage`: Handles only token storage operations
- `PermissionChecker`: Handles only permission validation
- `AuthContext`: Handles only authentication state management

#### Interface Segregation Principle (ISP)
- `ITokenStorage`: Token operations interface
- `IUserStorage`: User data operations interface
- `IPermissionChecker`: Permission checking interface

#### Open/Closed Principle (OCP)
- Role-based components can be extended without modification
- Permission system supports custom permissions
- Storage can be extended with different backends

#### Liskov Substitution Principle (LSP)
- All role components inherit from base `RoleBasedProps`
- Storage implementations are interchangeable

#### Dependency Inversion Principle (DIP)
- Components depend on abstractions (interfaces)
- Storage and permission systems use dependency injection

## Route Protection

The middleware automatically protects routes based on configuration:

```typescript
// middleware.ts configuration
const AUTH_CONFIG = {
  protectedRoutes: ['/dashboard', '/tasks', '/profile', '/admin'],
  roleProtectedRoutes: {
    '/admin': ['admin'],
  },
  permissionProtectedRoutes: {
    '/tasks/create': ['tasks:create'],
  },
};
```

## Role Hierarchy

```
Admin (Level 3)
  ├── All permissions (*)
  └── Can manage users and system settings

User (Level 2)
  ├── Can manage own tasks
  ├── Can access dashboard
  └── Can update profile

Viewer (Level 1)
  ├── Can view tasks (read-only)
  ├── Can view dashboard
  └── Can read profile
```

## Security Features

- ✅ Secure token storage with fallbacks
- ✅ Automatic token expiration handling
- ✅ XSS protection through proper storage
- ✅ Route-level access control
- ✅ Permission-based component rendering
- ✅ Automatic token refresh before expiration

## Components Reference

### Access Control Components
- `CanAccess` - Show content if user has specific permission
- `CanAccessAny` - Show content if user has any of specified permissions
- `CanAccessAll` - Show content if user has all specified permissions
- `RoleRequired` - Show content if user has specific role
- `MinRole` - Show content if user meets minimum role requirement
- `AdminOnly` - Show content only to admin users
- `UserOrAdmin` - Show content to users and admins (excludes viewers)
- `AuthenticatedOnly` - Show content only to authenticated users
- `UnauthenticatedOnly` - Show content only to unauthenticated users

### Task-Specific Components
- `CanManageTasks` - Show content if user can manage tasks
- `CanViewTasks` - Show content if user can view tasks
- `CanAccessDashboard` - Show content if user can access dashboard
- `CanManageUsers` - Show content if user can manage users

### Higher-Order Components
- `withRoleGuard` - HOC for role-based access control
- `withPermissionGuard` - HOC for permission-based access control

## Hooks Reference

### Core Hooks
- `useAuth()` - Main authentication hook
- `usePermissions()` - Permission checking utilities
- `useCurrentUser()` - Current user information
- `useAuthActions()` - Authentication actions (login, logout, refresh)
- `useAuthStatus()` - Authentication status information

### Utility Hooks
- `useRoleBasedNavigation()` - Get available routes based on user role
- `useConditionalRender()` - Conditional rendering utilities

## Error Handling

The system includes comprehensive error handling:

```tsx
import { useAuth } from '@/lib/auth';

export function LoginForm() {
  const { error, isLoading } = useAuth();

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  // ... rest of component
}
```

## Testing

The authentication system is designed to be easily testable:

```tsx
// __tests__/auth.test.tsx
import { renderWithAuth } from '@/test-utils';
import { AdminOnly } from '@/lib/auth';

const mockUser = {
  id: '1',
  email: 'admin@example.com',
  role: 'admin' as const,
  permissions: ['*'],
};

test('AdminOnly shows content for admin users', () => {
  const { getByText } = renderWithAuth(
    <AdminOnly>
      <div>Admin Content</div>
    </AdminOnly>,
    { user: mockUser }
  );

  expect(getByText('Admin Content')).toBeInTheDocument();
});
```

## Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Type Safety

All components and hooks are fully typed with TypeScript:

```typescript
// Full type inference
const { user } = useCurrentUser(); // user: User | null
const { canManageTasks } = usePermissions(); // canManageTasks: () => boolean

// Role type safety
<RoleRequired role="admin"> {/* role: 'admin' | 'user' | 'viewer' */}
  <AdminPanel />
</RoleRequired>
```

This authentication system provides a robust, secure, and maintainable foundation for user authentication and authorization in the frontend application.