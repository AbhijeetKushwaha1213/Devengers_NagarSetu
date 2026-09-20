# UrbanCare - Community Issue Management Platform

## 📋 Project Overview

UrbanCare is a modern web application built with React, TypeScript, and Vite that enables communities to report, track, and manage local issues efficiently. The platform features real-time updates, Google Maps integration, and authority management capabilities.

## 🏗️ Architecture

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Radix UI Components
- **Backend**: Supabase (Database + Auth + Real-time)
- **Maps**: Google Maps API
- **AI**: Google Vision API for image analysis
- **Deployment**: Vercel

## 📁 Project Structure

```
├── public/                 # Static assets
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── ui/           # Base UI components (Radix)
│   │   └── ...           # Feature components
│   ├── pages/            # Route components
│   ├── hooks/            # Custom React hooks
│   ├── services/         # API services
│   ├── contexts/         # React contexts
│   ├── types/            # TypeScript definitions
│   ├── constants/        # App constants
│   ├── utils/            # Utility functions
│   └── lib/              # Third-party configurations
├── docs/                 # Documentation
├── scripts/              # Build/deployment scripts
└── config files          # Various configuration files
```

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd urban-care
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Fill in your API keys and configuration
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

## 🔧 Environment Variables

Create a `.env.local` file with the following variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google APIs
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Authority Access Code
VITE_AUTHORITY_ACCESS_CODE=your_secure_access_code
```

## 📦 Deployment

### Vercel Deployment

1. **Connect to Vercel**
   - Import your repository to Vercel
   - Configure environment variables in Vercel dashboard

2. **Automatic Deployment**
   - Push to main branch triggers automatic deployment
   - Preview deployments for pull requests

### Manual Deployment

```bash
npm run build
npm run preview
```

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run generate-access-code` - Generate authority access codes

### Code Quality

- **TypeScript** for type safety
- **ESLint** for code linting
- **Prettier** for code formatting (via IDE)
- **Tailwind CSS** for consistent styling

## 🔐 Security

- Authority access codes for secure account creation
- Row Level Security (RLS) in Supabase
- Environment variable protection
- Input validation and sanitization

## 📱 Features

- **Issue Reporting**: Citizens can report community issues
- **Real-time Updates**: Live status updates and notifications
- **Google Maps Integration**: Location-based issue tracking
- **Authority Dashboard**: Management interface for authorities
- **AI-Powered Analysis**: Automatic issue description generation
- **Photo Upload**: Multiple image upload with various capture methods
- **User Authentication**: Secure login with Google OAuth

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.