# Meta Ads Lead Management Dashboard

## Overview
This project is a real-time dashboard for Meta Ads lead management, specifically designed for the automotive sector in the Spanish market. Its primary purpose is to centralize and manage lead generation data from Meta Ads campaigns, integrating with Google Sheets for lead synchronization and directly with the Meta Ads API for campaign spending metrics. Key capabilities include real-time statistics, automated data synchronization, comprehensive lead tracking, and a full client management system (ABM). The business vision is to provide automotive businesses with a powerful tool for optimizing their Meta Ads campaigns and improving lead conversion efficiency.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### Frontend Architecture
- **Framework**: React 18 with TypeScript, built with Vite.
- **UI/UX**: Tailwind CSS with shadcn/ui for a modern, clean design, focusing on usability with a business-oriented color scheme (blue-purple gradients, amber/orange accents) and interactive elements.
- **State Management**: TanStack Query for server state, local React state for UI.
- **Routing**: Wouter.
- **Real-time**: Native WebSocket API.

### Backend Architecture
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript with ES modules.
- **Database**: PostgreSQL with Drizzle ORM.
- **Real-time**: WebSocket Server (ws library).
- **Session Storage**: PostgreSQL-based sessions with connect-pg-simple.

### Data Model & Features
- **Database Schema**: Key entities include Users, Campaigns, Leads, Daily Stats, Lead Notes, Clientes (Client management with commercial info, brands, zones), and Dashboard Campaigns.
- **Dashboard Features**: Real-time "Datos Diarios" display with CPL, "CPL Directo" for CPL management, "Finanzas Dashboard" for financial analysis (profit, ROI, taxes), Client Management (ABM) with CRUD, Campaign Analytics (lead counts, spending, conversion), Google Sheets Integration, and Meta Ads API Integration for real-time spending.
- **Lead Synchronization**: Advanced duplicate detection using phone number, MetaLeadId, and Google Sheets row number. Supports full, smart, incremental, and brand-specific synchronization. Dynamic sheet auto-detection for Google Sheets tabs.
- **Data Capture**: Expanded lead data capture from Google Sheets to include origin, location, and specific client information.
- **Performance Optimization**: Migration from Google Sheets API to PostgreSQL for significant performance improvement (80% faster dashboard data loading).
- **Reporting**: CSV export functionality for leads and finalized campaigns.
- **Business Logic**: Automatic `fecha_fin` calculation for campaigns based on `cantidad_datos_solicitados`.

### System Design Choices
- **Data Flow**: Automatic periodic synchronization with Google Sheets, WebSocket for live dashboard updates, manual input processing, and full CRUD operations for client data, all persisting to PostgreSQL.
- **Storage Layer**: Production-ready PostgreSQL via Drizzle, with an `IStorage` interface for backend flexibility.

## External Dependencies
- **@neondatabase/serverless**: PostgreSQL driver
- **drizzle-orm**: ORM for database interaction
- **@tanstack/react-query**: Server state management
- **ws**: WebSocket implementation
- **axios**: HTTP client for API integrations
- **@radix-ui/***: Accessible component primitives
- **tailwindcss**: CSS framework
- **lucide-react**: Icon library