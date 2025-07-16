# Meta Ads Lead Management Dashboard

## Overview

This is a real-time dashboard for Meta Ads lead management with integrated Google Sheets synchronization. The system displays lead generation data from Meta Ads campaigns organized by car brands (Fiat, Peugeot, Toyota, Chevrolet, Renault, Citroen). Features include real-time statistics, automated data synchronization, and comprehensive lead tracking with PHP-style accessibility.

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
- **Users**: Player accounts with authentication
- **Game Rooms**: Multiplayer game instances with host management
- **Players**: Character assignments within game rooms
- **Chat Messages**: Real-time communication between players
- **Game Progress**: Tracking player actions and vocabulary learning

## Key Components

### Game Flow
1. **Character Selection**: Players choose from detective, linguist, translator, or cultural expert roles
2. **Room Management**: Create or join multiplayer game rooms with configurable settings
3. **Mystery Solving**: Collaborative gameplay with language learning elements
4. **Real-time Communication**: WebSocket-based chat and game state synchronization

### UI Components
- **Character Panel**: Displays team members, progress tracking, and character abilities
- **Main Game Area**: Central mystery interface with clues and vocabulary learning
- **Communication Panel**: Real-time chat with game action capabilities
- **Game Header**: Room status, connection state, and language selection

### Storage Layer
- **Database Storage**: Production-ready PostgreSQL implementation via Drizzle
- **Memory Storage**: Development fallback with in-memory data structures
- **Interface Pattern**: IStorage interface allows switching between storage backends

## Data Flow

1. **Client Connection**: WebSocket connection established on game page load
2. **Room Joining**: Players join rooms and receive current game state
3. **Real-time Updates**: Game actions broadcast to all room participants
4. **State Synchronization**: Game progress, chat messages, and player status synced across clients
5. **Persistence**: All game data persisted to PostgreSQL for resume capability

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL driver optimized for serverless
- **drizzle-orm**: Type-safe database ORM with PostgreSQL support
- **@tanstack/react-query**: Server state management and caching
- **ws**: WebSocket implementation for real-time communication

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