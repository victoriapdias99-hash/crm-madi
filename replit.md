# Meta Ads Lead Management Dashboard

## Overview

This is a real-time dashboard for Meta Ads lead management with integrated Google Sheets synchronization and direct Meta Ads API integration. The system displays lead generation data from Meta Ads campaigns organized by car brands (Fiat, Peugeot, Toyota, Chevrolet, Renault, Citroen). Features include real-time statistics, automated data synchronization, comprehensive lead tracking, full client management system (ABM), and direct Meta Ads API integration for real-time campaign spending metrics.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Framework**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query for server state, local React state for UI
- **Routing**: Wouter for lightweight client-side routing
- **Real-time**: Native WebSocket API for real-time game communication

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: WebSocket Server (ws library) for game communication
- **Session Storage**: PostgreSQL-based sessions with connect-pg-simple

### Database Schema
The application uses PostgreSQL with the following main entities:
- **Users**: System user accounts with authentication
- **Campaigns**: Meta Ads campaigns with budget and status tracking
- **Leads**: Individual lead records from Meta Ads with detailed information
- **Daily Stats**: Performance metrics for campaigns by date
- **Lead Notes**: User notes and interactions with leads
- **Clientes**: Client management with commercial information, brands, and zones
- **Dashboard Campaigns**: Campaign tracking for dashboard analytics

## Key Components

### Dashboard Features
1. **Datos Diarios Dashboard**: Real-time view of Google Sheets "Datos Diarios" data with manual CPL and order inputs
2. **Client Management (ABM)**: Complete CRUD system for client information with brands, zones, and commercial details
3. **Campaign Analytics**: Performance tracking with lead counts, spending, and conversion rates
4. **Google Sheets Integration**: Automatic synchronization with Fiat and Peugeot lead sheets
5. **Meta Ads API Integration**: Real-time campaign spending data directly from Meta Ads Marketing API v21.0

### UI Components
- **Navigation**: Consistent navigation bar across all pages
- **Datos Diarios Table**: Interactive table with manual input fields and automatic calculations
- **Client Management**: Form-based CRUD interface with validation for client data
- **Real-time Updates**: WebSocket-based dashboard updates and data synchronization

### Storage Layer
- **Database Storage**: Production-ready PostgreSQL implementation via Drizzle
- **Memory Storage**: Development fallback with in-memory data structures
- **Interface Pattern**: IStorage interface allows switching between storage backends

## Data Flow

1. **Google Sheets Sync**: Automatic periodic synchronization with Google Sheets for lead and client data
2. **Real-time Dashboard**: WebSocket connections provide live updates of campaign metrics
3. **Manual Input Processing**: User inputs for CPL and orders processed with automatic calculations
4. **Client Management**: Full CRUD operations for client data with validation and persistence
5. **Database Persistence**: All data stored in PostgreSQL with proper relationships and indexing

## Recent Changes (January 2025)

### Meta Ads API Integration (Latest)
- **Meta Ads Service**: Created separate module using Marketing API v21.0 for real-time campaign spending data
- **API Endpoints**: Full REST API for Meta Ads configuration, campaign metrics, budgets, and account summaries
- **Real-time Metrics**: Campaign spending, impressions, clicks, CPC, CPM, and frequency data
- **Auto-sync**: Automatic synchronization every 30 minutes with manual sync capabilities
- **Dashboard**: Complete Meta Ads dashboard with configuration, status monitoring, and campaign visualization
- **Isolated Module**: Designed as separate system to avoid conflicts with existing Google Sheets integration

### Client Management System Implementation
- **Database Schema**: Added comprehensive "clientes" table with fields for commercial information, CUIT, billing type, brands, and zones
- **API Endpoints**: Implemented full CRUD REST API for client management (/api/clientes)
- **Frontend Interface**: Created responsive client management page with forms, validation, and data tables
- **Navigation**: Added navigation component for seamless movement between dashboard sections
- **Integration**: Connected Google Sheets "Clientes" data with database storage and UI

### Technical Improvements
- **Storage Layer**: Extended IStorage interface and MemStorage implementation for client operations
- **Form Validation**: Implemented Zod schema validation for client data with TypeScript type safety
- **UI Components**: Enhanced forms with multi-select checkboxes for brands and zones, proper field validation
- **Data Synchronization**: Maintained real-time updates with TanStack Query and proper cache invalidation

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL driver optimized for serverless
- **drizzle-orm**: Type-safe database ORM with PostgreSQL support
- **@tanstack/react-query**: Server state management and caching
- **ws**: WebSocket implementation for real-time communication
- **axios**: HTTP client for Meta Ads API integration

### UI Dependencies
- **@radix-ui/***: Accessible component primitives for shadcn/ui
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Icon library for consistent UI elements

### Development Tools
- **tsx**: TypeScript execution for development server
- **esbuild**: Fast bundling for production backend builds
- **vite**: Frontend development server and build tool

## Deployment Strategy

### Development Mode
- Frontend served via Vite dev server with HMR
- Backend runs via tsx with auto-reload on changes
- Database migrations applied via drizzle-kit
- WebSocket server runs on same port as HTTP server

### Production Build
- Frontend built to static assets via Vite
- Backend bundled with esbuild for Node.js execution
- Static assets served by Express in production
- Database migrations run separately before deployment

### Environment Configuration
- **DATABASE_URL**: PostgreSQL connection string (required)
- **NODE_ENV**: Environment mode (development/production)
- **REPL_ID**: Replit-specific configuration for development tools

The application follows a modern full-stack architecture optimized for real-time multiplayer gaming with integrated language learning features. The modular design allows for easy extension of game mechanics, character types, and language support.