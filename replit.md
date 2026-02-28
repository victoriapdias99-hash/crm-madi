# CRM MADI - Lead Management & Campaign System

## Overview

CRM MADI is a comprehensive Customer Relationship Management system designed for managing advertising leads and commercial campaigns. The platform integrates with Meta Ads and Google Sheets to centralize lead data, automate campaign closures when targets are met, and provide real-time dashboard analytics. Built with a React frontend and Express backend, it follows Clean Architecture principles for maintainable and testable code.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: Radix UI primitives with shadcn/ui styling
- **Styling**: Tailwind CSS with CSS variables for theming
- **Build Tool**: Vite with path aliases (@/, @shared, @assets)

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Architecture Pattern**: Clean Architecture (Hexagonal) with 4 layers:
  - **Presentation**: Controllers and Routes (HTTP/WebSocket handlers)
  - **Application**: Use Cases and DTOs (business logic orchestration)
  - **Domain**: Entities, Services, and Interfaces (core business rules)
  - **Infrastructure**: Repositories and Factories (database access)
- **Real-time**: WebSocket server for live updates (campaign progress tracking)
- **Session Management**: express-session with PostgreSQL store (connect-pg-simple)

### Database Design
- **Database**: PostgreSQL via Neon Serverless
- **ORM**: Drizzle ORM with drizzle-kit for migrations
- **Key Tables**:
  - `clientes` - Client/customer records
  - `campanas_comerciales` - Commercial campaigns with daily tracking (dia_1 through dia_31)
  - `op_lead` - Operational leads with campaign assignments
  - `op_lead_webhook` - Leads received via external webhooks
  - `op_leads_rep` - Consolidated leads for analysis
  - `users` - User authentication with role-based access (admin/user)
  - `sync_control` - Synchronization state tracking
  - `meta_token_store` - Stores Meta Ads access token with expiry for auto-refresh

### Key Modules
1. **Campaign Closure System** (`server/campaign-closure/`)
   - Automated lead assignment to campaigns
   - Multi-brand support (automatic and manual modes)
   - Batch processing with transaction safety
   - WebSocket progress tracking

2. **Campaign Reset System** (`server/campaign-reset/`)
   - Reopen closed campaigns
   - Clear lead assignments
   - Batch reset capabilities

3. **Finished Campaigns** (`server/finished-campaigns/`)
   - Query and filter completed campaigns
   - Statistics aggregation
   - Reopen functionality

4. **Webhook System** (`server/webhook/`)
   - Receive leads from external sources (Make.com, Zapier, n8n)
   - Automatic phone normalization
   - Zod schema validation

5. **Authentication System** (`server/auth/`)
   - Role-based access control (admin/user)
   - Scrypt password hashing
   - Session-based authentication

### Data Synchronization
- **Google Sheets Integration**: Reads lead data from spreadsheets using API key authentication
- **Smart-Fast Sync** (`server/sync-smart-fast/`): Efficient migration of leads with deduplication
- **Materialized Views**: Pre-computed dashboard data for performance (`mv_dashboard_datos_diarios`)

### API Structure
- `/api/auth/*` - Authentication endpoints
- `/api/campaign-closure/*` - Campaign closure operations
- `/api/campaign-reset/*` - Campaign reset operations
- `/api/finished-campaigns/*` - Finished campaign queries
- `/api/webhook/*` - External webhook receivers
- `/api/dashboard/*` - Dashboard data endpoints
- `/api/meta-ads/*` - Meta Ads integration

## External Dependencies

### Database
- **PostgreSQL** (Neon Serverless) - Primary data store
- Connection via `@neondatabase/serverless` with WebSocket support

### External APIs
- **Meta Ads API** - Campaign spend data, impressions, clicks, CPL metrics
  - Requires: `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_APP_SECRET`
- **Google Sheets API** - Lead data synchronization
  - Requires: `GOOGLE_SHEETS_API_KEY`, `GOOGLE_SHEETS_SPREADSHEET_ID`

### Key NPM Packages
- `drizzle-orm` / `drizzle-kit` - Database ORM and migrations
- `@tanstack/react-query` - Server state management
- `axios` - HTTP client for external APIs
- `googleapis` - Google Sheets integration
- `zod` - Schema validation
- `ws` - WebSocket server
- `express-session` / `connect-pg-simple` - Session management

### Data Architecture Decisions
- **Deduplication Strategy**: UPSERT uses `metaLeadId` (phone+date+brand) as conflict target, allowing multiple leads with same phone+brand on different dates to coexist
- **op_leads_rep table**: Consolidated/deduplicated view of op_lead, grouped by telefono+marca. Contains `duplicate_ids` array and `cantidad_duplicados` count. Auto-refreshed after each Google Sheets sync via `migrateSmartFast()`
- **Campaign Counting**: Uses `op_leads_rep` to count unique available leads per campaign (filters by cliente, campaign/marca, localizacion/zona)
- **Location fields**: `ciudad` = actual city from Google Sheet (Column D), `localizacion` = zone/area (Column H). Frontend "Localidad" displays `ciudad`

### Environment Variables Required
```
DATABASE_URL - PostgreSQL connection string
SESSION_SECRET - Express session secret
META_ACCESS_TOKEN - Meta Ads API token (optional)
META_AD_ACCOUNT_ID - Meta Ads account ID (optional)
GOOGLE_SHEETS_API_KEY - Google API key (optional)
GOOGLE_SHEETS_SPREADSHEET_ID - Target spreadsheet ID (optional)
```