# Project Structure

This document explains the organization of the Civic Connect codebase.

## Directory Overview

```
civic-connect/
├── src/                          # Source code
│   ├── features/                 # Feature modules (organized by domain)
│   ├── shared/                   # Shared/common code
│   ├── App.tsx                   # Main app component
│   ├── main.tsx                  # Application entry point
│   └── index.css                 # Global styles
│
├── docs/                         # Documentation
│   ├── setup/                    # Setup and configuration guides
│   ├── features/                 # Feature-specific documentation
│   ├── migration/                # Database migration scripts
│   └── archive/                  # Old/deprecated docs
│
├── public/                       # Static assets
│   ├── images/                   # Image files
│   └── icons/                    # Icon files
│
└── [config files]                # Root configuration files
```

## Source Code Organization

### Feature-Based Structure

We use a feature-based architecture where related code is grouped by domain/feature:

```
src/features/
├── auth/                         # Authentication & authorization
│   ├── components/               # Auth-specific components
│   ├── hooks/                    # Auth hooks
│   ├── services/                 # Auth API calls
│   └── types/                    # Auth TypeScript types
│
├── issues/                       # Issue management
│   ├── components/               # Issue components
│   ├── pages/                    # Issue pages
│   ├── hooks/                    # Issue hooks
│   ├── services/                 # Issue API calls
│   └── types/                    # Issue types
│
├── official/                     # Official portal
│   ├── components/               # Official components
│   ├── pages/                    # Official pages
│   ├── services/                 # Official API calls
│   └── types/                    # Official types
│
├── profile/                      # User profiles
│   ├── components/               # Profile components
│   ├── pages/                    # Profile pages
│   └── services/                 # Profile API calls
│
└── events/                       # Community events
    ├── components/               # Event components
    ├── pages/                    # Event pages
    └── services/                 # Event API calls
```

### Shared Resources

Common code used across features:

```
src/shared/
├── components/                   # Reusable components
│   ├── ui/                       # UI primitives (shadcn/ui)
│   ├── layout/                   # Layout components
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   └── Sidebar.tsx
│   └── common/                   # Common components
│       ├── LoadingSpinner.tsx
│       ├── ErrorBoundary.tsx
│       └── NotificationCenter.tsx
│
├── hooks/                        # Custom React hooks
│   ├── useDebounce.ts
│   ├── useLocalStorage.ts
│   └── use-toast.ts
│
├── utils/                        # Utility functions
│   ├── authValidation.ts
│   ├── dateFormatters.ts
│   └── validators.ts
│
├── types/                        # Shared TypeScript types
│   ├── index.ts
│   └── google-maps.d.ts
│
├── constants/                    # Application constants
│   └── index.ts
│
└── lib/                          # Third-party library configs
    ├── supabase.ts
    ├── utils.ts
    └── animations.ts
```

## File Naming Conventions

### Components
- **PascalCase** for component files: `IssueCard.tsx`
- **PascalCase** for component names: `export const IssueCard`

### Hooks
- **camelCase** with `use` prefix: `useDebounce.ts`
- **camelCase** for hook names: `export const useDebounce`

### Utilities
- **camelCase** for utility files: `authValidation.ts`
- **camelCase** for function names: `export const validateEmail`

### Types
- **PascalCase** for type names: `export type Issue`
- **PascalCase** for interface names: `export interface IssueProps`

### Constants
- **SCREAMING_SNAKE_CASE** for constants: `export const API_BASE_URL`

## Import Organization

Imports should be organized in this order:

```typescript
// 1. External libraries
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// 2. Internal features
import { useAuth } from '@/features/auth/hooks/useAuth';
import { IssueCard } from '@/features/issues/components/IssueCard';

// 3. Shared resources
import { Button } from '@/shared/components/ui/button';
import { useToast } from '@/shared/hooks/use-toast';
import { formatDate } from '@/shared/utils/dateFormatters';

// 4. Types
import type { Issue } from '@/shared/types';

// 5. Styles
import './styles.css';
```

## Path Aliases

We use TypeScript path aliases for cleaner imports:

```typescript
// Instead of:
import { Button } from '../../../shared/components/ui/button';

// Use:
import { Button } from '@/shared/components/ui/button';
```

Configured in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## Component Structure

### Standard Component Template

```typescript
// Imports
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import type { ComponentProps } from './types';

// Component
export const ComponentName: React.FC<ComponentProps> = ({ prop1, prop2 }) => {
  // Hooks
  const navigate = useNavigate();
  const [state, setState] = useState();

  // Effects
  useEffect(() => {
    // Effect logic
  }, []);

  // Handlers
  const handleClick = () => {
    // Handler logic
  };

  // Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
};
```

## Page Structure

Pages should be thin and delegate logic to components:

```typescript
// src/features/issues/pages/IssueListPage.tsx
import { IssueList } from '../components/IssueList';
import { IssueFilters } from '../components/IssueFilters';
import { useIssues } from '../hooks/useIssues';

export const IssueListPage = () => {
  const { issues, loading } = useIssues();

  return (
    <div>
      <IssueFilters />
      <IssueList issues={issues} loading={loading} />
    </div>
  );
};
```

## Service Layer

API calls should be in service files:

```typescript
// src/features/issues/services/issueService.ts
import { supabase } from '@/shared/lib/supabase';
import type { Issue } from '@/shared/types';

export const issueService = {
  async getAll(): Promise<Issue[]> {
    const { data, error } = await supabase
      .from('issues')
      .select('*');
    
    if (error) throw error;
    return data;
  },

  async create(issue: Partial<Issue>): Promise<Issue> {
    const { data, error } = await supabase
      .from('issues')
      .insert(issue)
      .single();
    
    if (error) throw error;
    return data;
  },
};
```

## State Management

We use React hooks and Context API for state management:

```typescript
// src/features/auth/contexts/AuthContext.tsx
import { createContext, useContext } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // Auth logic
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
```

## Testing Structure

Tests should be colocated with their source files:

```
src/features/issues/
├── components/
│   ├── IssueCard.tsx
│   └── IssueCard.test.tsx
├── services/
│   ├── issueService.ts
│   └── issueService.test.ts
└── hooks/
    ├── useIssues.ts
    └── useIssues.test.ts
```

## Documentation

Each feature should have a README:

```
src/features/issues/
├── README.md                     # Feature overview
├── components/
├── pages/
└── services/
```

## Best Practices

1. **Keep components small**: Max 200-300 lines
2. **Extract custom hooks**: Reuse logic across components
3. **Use TypeScript**: Type everything
4. **Write tests**: Aim for 80%+ coverage
5. **Document complex logic**: Add comments for non-obvious code
6. **Follow conventions**: Stick to the established patterns
7. **Keep features isolated**: Minimize cross-feature dependencies
8. **Use absolute imports**: Leverage path aliases

## Migration Guide

If you're refactoring existing code:

1. Create new feature folder
2. Move related files
3. Update imports
4. Test thoroughly
5. Remove old files
6. Update documentation

## Related Documentation

- [Contributing Guidelines](CONTRIBUTING.md)
- [Code Style Guide](CODE_STYLE.md)
- [Testing Guide](TESTING.md)
