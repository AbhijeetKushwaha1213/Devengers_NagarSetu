# 📁 Project Folder Structure

## Overview

This document explains the organized folder structure of the UrbanCare project, optimized for Vercel deployment and maintainability.

## Root Directory Structure

```
urban-care/
├── 📁 public/                 # Static assets served directly
│   ├── favicon.ico           # App favicon
│   ├── robots.txt           # SEO robots file
│   ├── _redirects           # Netlify redirects (backup)
│   └── *.jpeg, *.svg        # Images and icons
│
├── 📁 src/                   # Source code
│   ├── 📁 components/       # React components
│   ├── 📁 pages/           # Route/page components
│   ├── 📁 hooks/           # Custom React hooks
│   ├── 📁 services/        # API services & external integrations
│   ├── 📁 contexts/        # React context providers
│   ├── 📁 types/           # TypeScript type definitions
│   ├── 📁 constants/       # App constants & configuration
│   ├── 📁 utils/           # Utility functions
│   ├── 📁 lib/             # Third-party library configurations
│   ├── App.tsx             # Main App component
│   ├── main.tsx            # App entry point
│   └── index.css           # Global styles
│
├── 📁 docs/                 # Documentation
│   ├── README.md           # Project overview
│   ├── DEPLOYMENT.md       # Deployment guide
│   └── FOLDER_STRUCTURE.md # This file
│
├── 📁 scripts/             # Build & deployment scripts
│   ├── deploy.sh           # Deployment preparation script
│   └── generate-access-code.js # Access code generator
│
├── 📁 .kiro/               # Kiro IDE specifications
│   └── specs/              # Feature specifications
│
├── 📄 Configuration Files
│   ├── package.json        # Dependencies & scripts
│   ├── vercel.json         # Vercel deployment config
│   ├── vite.config.ts      # Vite build configuration
│   ├── tailwind.config.ts  # Tailwind CSS config
│   ├── tsconfig.json       # TypeScript configuration
│   ├── .env.example        # Environment variables template
│   └── .env.local          # Local environment variables (gitignored)
│
└── 📄 Documentation Files
    ├── README.md           # Main project README
    ├── *.md                # Various documentation files
    └── *.sql               # Database migration files
```

## Source Code Organization (`src/`)

### 🧩 Components (`src/components/`)

```
components/
├── ui/                     # Base UI components (Radix UI)
│   ├── button.tsx         # Base button component
│   ├── input.tsx          # Base input component
│   ├── dialog.tsx         # Modal/dialog component
│   └── ...                # Other base components
│
├── AuthModal.tsx          # Authentication modal
├── Navbar.tsx             # Navigation component
├── IssueCard.tsx          # Issue display card
├── IssueMap.tsx           # Google Maps integration
├── LocationPicker.tsx     # Location selection component
└── ...                    # Other feature components
```

**Purpose**: Reusable UI components organized by complexity
- `ui/` - Base components from Radix UI
- Root level - Feature-specific components

### 📄 Pages (`src/pages/`)

```
pages/
├── Index.tsx              # Landing page
├── Issues.tsx             # Issues listing page
├── IssueDetail.tsx        # Individual issue page
├── ReportIssue.tsx        # Issue reporting form
├── AuthorityDashboard.tsx # Authority management dashboard
├── Profile.tsx            # User profile page
└── ...                    # Other route components
```

**Purpose**: Top-level route components that represent full pages

### 🎣 Hooks (`src/hooks/`)

```
hooks/
├── useIssues.ts           # Issue management hook
├── useLocalStorage.ts     # Local storage management
├── useDebounce.ts         # Debouncing utility
├── use-toast.ts           # Toast notifications
└── use-mobile.tsx         # Mobile detection
```

**Purpose**: Custom React hooks for state management and reusable logic

### 🔧 Services (`src/services/`)

```
services/
├── supabaseService.ts     # Supabase database operations
├── authorityService.ts    # Authority-specific operations
├── visionService.ts       # Google Vision API integration
└── simpleVisionService.ts # Simplified vision service
```

**Purpose**: External API integrations and data layer services

### 🌐 Contexts (`src/contexts/`)

```
contexts/
└── SupabaseAuthContext.tsx # Authentication context provider
```

**Purpose**: React context providers for global state management

### 📝 Types (`src/types/`)

```
types/
├── index.ts               # Main type definitions
└── google-maps.d.ts       # Google Maps type declarations
```

**Purpose**: TypeScript type definitions and interfaces

### 📊 Constants (`src/constants/`)

```
constants/
└── index.ts               # App constants, enums, and configuration
```

**Purpose**: Application-wide constants and configuration values

### 🛠️ Utils (`src/utils/`)

```
utils/
├── authValidation.ts      # Authentication utilities
└── ...                    # Other utility functions (in lib/utils.ts)
```

**Purpose**: Pure utility functions and helpers

### 📚 Lib (`src/lib/`)

```
lib/
├── utils.ts               # General utility functions
├── supabase.ts            # Supabase client configuration
└── animations.ts          # Animation configurations
```

**Purpose**: Third-party library configurations and general utilities

## Configuration Files

### 📦 Package Management
- `package.json` - Dependencies, scripts, and project metadata
- `package-lock.json` - Locked dependency versions

### 🏗️ Build Configuration
- `vite.config.ts` - Vite build tool configuration
- `tsconfig.json` - TypeScript compiler configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `postcss.config.js` - PostCSS configuration

### 🚀 Deployment Configuration
- `vercel.json` - Vercel deployment settings
- `.env.example` - Environment variables template
- `.env.local` - Local environment variables (not in git)

### 🔍 Code Quality
- `eslint.config.js` - ESLint linting rules
- `.gitignore` - Git ignore patterns

## Documentation Structure (`docs/`)

```
docs/
├── README.md              # Project overview and quick start
├── DEPLOYMENT.md          # Detailed deployment guide
├── FOLDER_STRUCTURE.md    # This file
└── ...                    # Additional documentation
```

## Scripts Directory (`scripts/`)

```
scripts/
├── deploy.sh              # Deployment preparation script
├── generate-access-code.js # Authority access code generator
└── ...                    # Other utility scripts
```

## Best Practices

### 📁 Folder Naming
- Use **kebab-case** for folders: `user-profile/`
- Use **PascalCase** for React components: `UserProfile.tsx`
- Use **camelCase** for utilities: `authValidation.ts`

### 📄 File Organization
- Group related files together
- Keep components close to where they're used
- Separate concerns (UI, logic, data)
- Use index files for clean imports

### 🔄 Import Patterns
```typescript
// Absolute imports using @ alias
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/SupabaseAuthContext'
import { Issue } from '@/types'

// Relative imports for nearby files
import './Component.css'
```

### 📈 Scalability
- Components are organized by feature and complexity
- Services are separated by domain
- Types are centralized but can be split by domain
- Utilities are organized by functionality

This structure supports:
- ✅ Easy navigation and file discovery
- ✅ Clear separation of concerns
- ✅ Scalable architecture
- ✅ Optimal Vercel deployment
- ✅ Maintainable codebase