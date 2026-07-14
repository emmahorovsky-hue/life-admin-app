# Frontend Components Guide

Complete documentation of React components and patterns used in Life Admin App.

## Component Architecture

```
App (Root)
├── Layout (Header, Sidebar, Footer)
│   ├── ProtectedRoute (Auth wrapper)
│   │   ├── Dashboard
│   │   │   ├── SummaryCard
│   │   │   ├── CategoryChart (Recharts)
│   │   │   └── UpcomingRenewals
│   │   ├── Subscriptions
│   │   │   ├── SubscriptionList
│   │   │   │   └── SubscriptionItem
│   │   │   └── AddSubscriptionDialog
│   │   └── SettingsShell (/settings)
│   │       ├── AccountPanel (+ Edit name / Change email / Change password dialogs)
│   │       ├── NotificationsPanel
│   │       ├── AppearancePanel
│   │       └── PrivacyPanel (Delete account)
│   ├── Login
│   ├── Register
│   └── NotFound
```

## Base Components

### Toaster (toasts)

Global toast region (`client/src/components/ui/toaster.tsx`, wraps [sonner](https://sonner.emilkowal.ski/)), mounted once in `App.tsx` and styled to the receipt aesthetic (2px corners, ink border, paper surface). Fire from anywhere:

```tsx
import { toast } from 'sonner';

toast.success('Settings saved');
toast.error('Could not save. Please try again.');
```

### Layout

Main layout component wrapping all pages.

**Location:** `src/components/Layout.tsx`

**Props:**
```typescript
interface LayoutProps {
  children: React.ReactNode;
}
```

**Features:**
- Header with navigation
- Sidebar (mobile-responsive)
- Footer
- Dark/light mode toggle (future)

**Usage:**
```typescript
import { Layout } from '@/components/Layout';

export function Dashboard() {
  return (
    <Layout>
      <div>Dashboard content</div>
    </Layout>
  );
}
```

### ProtectedRoute

Wraps authenticated pages. Redirects to login if not authenticated.

**Location:** `src/components/ProtectedRoute.tsx`

**Props:**
```typescript
interface ProtectedRouteProps {
  children: React.ReactNode;
}
```

**Features:**
- Checks auth status (from AuthContext)
- Redirects to /login if not authenticated
- Shows loading state while checking

**Usage:**
```typescript
<ProtectedRoute>
  <Dashboard />
</ProtectedRoute>
```

## Feature Components

### Dashboard

Shows subscription summary and upcoming renewals.

**Location:** `src/pages/Dashboard.tsx`

**State:**
- Subscription summary (monthly total, count, by category)
- Upcoming renewals (next 30 days)

**Child Components:**
- `SummaryCard` - Shows total monthly/annual spending
- `CategoryChart` - Pie/bar chart by category (Recharts)
- `UpcomingRenewals` - List of subscriptions renewing soon

**API Calls:**
- `GET /api/dashboard/summary`
- `GET /api/dashboard/upcoming`

**Error Handling:**
- Shows error message if API fails
- Retry button

### Subscriptions

List and manage subscriptions.

**Location:** `src/pages/Subscriptions.tsx`

**State:**
- List of subscriptions
- Filters (category, status)
- Sort (date, cost, name)
- Pagination (future)

**Child Components:**
- `SubscriptionList` - Table/grid of subscriptions
  - `SubscriptionItem` - Individual subscription row
- `AddSubscriptionDialog` - Create new subscription
- `EditSubscriptionDialog` - Edit existing subscription
- `DeleteConfirmation` - Confirm deletion

**API Calls:**
- `GET /api/subscriptions?category=X&sort=Y`
- `POST /api/subscriptions` (create)
- `PATCH /api/subscriptions/:id` (update)
- `DELETE /api/subscriptions/:id` (delete)

**Features:**
- Search by name
- Filter by category
- Sort by cost/date/name
- Inline edit/delete actions

### Authentication Pages

#### Login

**Location:** `src/pages/Login.tsx`

**Form Fields:**
- Email (text input)
- Password (password input)

**Features:**
- Form validation
- Error messages
- "Forgot password?" link (future)
- "Don't have account?" -> Register link

**API Call:**
- `POST /api/auth/login`

**On Success:**
- Store user in AuthContext
- Redirect to /dashboard

#### Register

**Location:** `src/pages/Register.tsx`

**Form Fields:**
- Name (text input)
- Email (email input)
- Password (password input)
- Confirm password (password input)

**Validation:**
- Email: valid format
- Password: 8+ chars, 1 uppercase, 1 number
- Passwords: must match

**API Call:**
- `POST /api/auth/register`

**On Success:**
- Auto-login user
- Redirect to /dashboard

## shadcn/ui Components

All UI components use shadcn/ui for consistency.

### Commonly Used

**Buttons:**
```typescript
import { Button } from '@/components/ui/button';

<Button variant="default">Primary</Button>
<Button variant="outline">Secondary</Button>
<Button variant="ghost">Tertiary</Button>
<Button variant="destructive">Delete</Button>
```

**Forms:**
```typescript
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';

<Input type="email" placeholder="Email" />
<Textarea placeholder="Notes" />
<Select>
  <option>Monthly</option>
  <option>Annual</option>
</Select>
```

**Dialogs:**
```typescript
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>Title</DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

**Cards:**
```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Total Spending</CardTitle>
  </CardHeader>
  <CardContent>$150.00/month</CardContent>
</Card>
```

**Tables:**
```typescript
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Cost</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Netflix</TableCell>
      <TableCell>$15.99</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

## State Management

### AuthContext

User authentication state.

**Location:** `src/contexts/AuthContext.tsx`

**Properties:**
```typescript
interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}
```

**Usage:**
```typescript
import { useAuth } from '@/contexts/AuthContext';

export function Dashboard() {
  const { user, logout } = useAuth();
  
  return (
    <div>
      <p>Hello, {user?.name}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### Hooks

#### useAuth()

Get authentication state and methods.

```typescript
const { user, isAuthenticated, logout } = useAuth();
```

#### useSubscriptions()

Fetch and manage subscriptions.

```typescript
const { subscriptions, loading, error, create, update, delete } = useSubscriptions();
```

#### useDashboard()

Fetch dashboard data.

```typescript
const { summary, upcoming, loading } = useDashboard();
```

## Form Handling

### Subscription Form

Example of creating/editing subscription:

```typescript
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function SubscriptionForm({ onSubmit }: { onSubmit: (data: FormData) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm();
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input
        {...register('name', { required: 'Name required' })}
        placeholder="Subscription name"
      />
      {errors.name && <span>{errors.name.message}</span>}
      
      <Input
        {...register('cost', { required: 'Cost required', min: 0 })}
        type="number"
        step="0.01"
        placeholder="Cost"
      />
      
      <Button type="submit">Save</Button>
    </form>
  );
}
```

## Charts with Recharts

### Category Breakdown Pie Chart

```typescript
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';

export function CategoryChart({ data }: { data: CategoryData[] }) {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
  
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={100}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

### Monthly Trend Line Chart

```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function TrendChart({ data }: { data: TrendData[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="amount" stroke="#3b82f6" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

## Responsive Design

### Breakpoints

Tailwind breakpoints (mobile-first):

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

### Example: Responsive Layout

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <Card>Card 1</Card>
  <Card>Card 2</Card>
  <Card>Card 3</Card>
</div>
```

### Mobile Menu (Hidden on Desktop)

```typescript
<nav className="hidden md:flex">
  {/* Desktop nav */}
</nav>

<nav className="md:hidden">
  {/* Mobile nav */}
</nav>
```

## Styling with TailwindCSS

### Utility Classes

**Spacing:**
```html
<!-- Padding: 1rem on all sides -->
<div className="p-4"></div>

<!-- Margin: 2rem bottom -->
<div className="mb-8"></div>
```

**Colors:**
```html
<!-- Primary blue -->
<button className="bg-blue-500 text-white"></button>

<!-- Danger red -->
<button className="bg-red-500"></button>
```

**Responsive:**
```html
<!-- Mobile: 1 column, Tablet: 2 cols, Desktop: 3 cols -->
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"></div>
```

### Custom Colors

Defined in `tailwind.config.ts`:

```typescript
export const config = {
  theme: {
    colors: {
      primary: 'oklch(0.55 0.22 250)',  // Blue
      accent: 'oklch(0.60 0.15 190)',   // Teal
      success: 'oklch(0.65 0.18 145)',  // Green
    }
  }
}
```

**Usage:**
```html
<button className="bg-primary text-white">Primary</button>
```

## Best Practices

### Component Organization

```typescript
// src/components/MyComponent.tsx

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

interface MyComponentProps {
  title: string;
  onSubmit: (data: unknown) => void;
}

export function MyComponent({ title, onSubmit }: MyComponentProps) {
  const { user } = useAuth();
  
  return (
    <div>
      <h1>{title}</h1>
      <Button onClick={() => onSubmit({})}>Submit</Button>
    </div>
  );
}
```

### Error Handling

```typescript
export function UserProfile() {
  const { user, loading, error } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!user) return <div>Not authenticated</div>;
  
  return <div>{user.name}</div>;
}
```

### TypeScript Types

```typescript
// Define clear types
interface Subscription {
  id: string;
  name: string;
  cost: number;
  renewalDate: Date;
}

// Use in component
interface SubscriptionItemProps {
  subscription: Subscription;
  onDelete: (id: string) => void;
}

export function SubscriptionItem({ subscription, onDelete }: SubscriptionItemProps) {
  return <div>{subscription.name}</div>;
}
```

---

**Last Updated:** 2026-06-02  
**Target Audience:** Frontend Developers  
**Related Docs:** [STYLING.md](STYLING.md), [docs/DEVELOPMENT.md](../../docs/DEVELOPMENT.md)
