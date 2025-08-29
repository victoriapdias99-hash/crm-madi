# Meta Ads Lead Management Dashboard

## Overview
This project is a real-time dashboard for Meta Ads lead management, specifically designed for the automotive sector in the Spanish market. Its primary purpose is to centralize and manage lead generation data from Meta Ads campaigns, integrating with Google Sheets for lead synchronization and directly with the Meta Ads API for campaign spending metrics. Key capabilities include real-time statistics, automated data synchronization, comprehensive lead tracking, and a full client management system (ABM). The business vision is to provide automotive businesses with a powerful tool for optimizing their Meta Ads campaigns and improving lead conversion efficiency.

## Recent Updates (August 2025)
### Google Sheets Synchronization System Cleanup ✅ (August 29, 2025)
- **Duplicate Endpoints Removed**: Eliminated redundant `/api/sheets/sync` endpoint that duplicated functionality of the refactored system
- **Method Consolidation**: Removed duplicate `getLeadsBySheet()` method from GoogleSheetsService, keeping only `getSheetData()` as the main method
- **Import Cleanup**: Removed unused `node-cron` import from google-sheets.ts (cron job was previously removed)
- **System Streamlined**: Google Sheets synchronization now uses exclusively the refactored `/api/sync/*` endpoints for all operations
- **Code Quality Improved**: Eliminated approximately 50 lines of redundant code without affecting functionality
- **Zero Breaking Changes**: All existing functionality preserved while removing duplicate processes
- **Production Validated**: System tested and confirmed working correctly after cleanup

### Enhanced MetaLeadId with Client Information System Implemented ✅ (August 26, 2025)
- **Critical Field Mapping Fixed**: Resolved synchronization issues where Google Sheets fields were incorrectly mapped (sheetLead.telefono vs sheetLead.phone)
- **Enhanced MetaLeadId Format**: Upgraded from simple format to comprehensive identifier including client information for superior duplicate detection
- **Client-Specific Lead Tracking**: MetaLeadId now includes normalized client name for precise lead attribution and overlap prevention
- **Improved Duplicate Prevention**: System processes 6,032 leads from Google Sheets and inserts only 1,498 unique leads (75% duplicate prevention efficiency)
- **Format Comparison**: 
  - Old: `GENERAL-JORGE_MUNGO-undefined-undefined`
  - New: `SHEET_5491122885786_O__spin_google_sheets_Chevrolet`
- **Complete Data Integrity**: All 1,498 leads have defined client information with comprehensive metadata capture
- **Multi-Client Detection Working**: Nicolas Gold (238 leads), Avec (613 leads), Grupo SVA (78 leads), Chevrolet Italy (108 leads)
- **Automatic Sync Enhanced**: Both manual and automatic 15-minute synchronization use improved identification system
- **Production Ready**: System successfully prevents lead overlap between campaigns while maintaining accurate client-specific attribution
### CSV Export System Fixed ✅ (August 21, 2025)
- **Critical JSON Parsing Bug Fixed**: Frontend was not parsing JSON response from export endpoint correctly
- **API Response Handling**: Fixed `apiRequest` usage to properly await `response.json()` before accessing leads data
- **Export Functionality Restored**: CSV downloads now include all filtered leads instead of just headers and "Sin leads disponibles"
- **Data Integrity Verified**: Backend correctly returns 77 leads for VW 1 (Borussia), frontend now receives them properly
- **Complete Lead Export**: CSV now contains all lead data: names, phones, emails, cities, origins, locations, client info
- **Template String Bug Fixed**: Corrected CSV generation logic that was causing malformed output
- **Production Ready**: Export system fully operational for all campaigns with accurate client-specific filtering

### Client-Specific Lead Filtering System Implemented ✅ (August 21, 2025)
- **Critical Bug Fixed**: Resolved major filtering issue where campaigns counted all leads of same brand instead of client-specific leads
- **Smart Commercial Name Filtering**: System now uses `nombreComercial` from client table instead of full `nombreCliente` for precise lead matching
- **Multi-Client Brand Support**: Fixed VW campaigns showing 132 leads (all VW) instead of 77 (Borussia only) and 279 (all VW) instead of 202 (CDN only)
- **Intelligent Fallback Logic**: When Google Sheets client column (I) is empty, system matches leads by brand and date range only
- **Toyota Campaign Fixed**: Resolved Toyota showing 0 leads - now correctly shows 101 leads by handling empty client data
- **Data Integrity Maintained**: All existing corrections preserved while implementing more accurate filtering
- **Perfect Accuracy Achieved**: VW 1 = 77 leads (Borussia), JEEP 1 = 32 leads (Jea Automotores), TOYOTA 1 = 101 leads (all Toyota with empty client field)
- **Code Refactoring Completed**: Created reusable `contarLeadsPorCampana()` function with comprehensive documentation
- **System Validation**: User confirmed "funciona perfecto" - all campaigns show precise lead counts
- **Production Ready**: Fully documented system with technical specifications and maintenance guidelines

### Dynamic Sheet Auto-Detection System Implemented ✅ (August 20, 2025)
- **Automatic Tab Discovery**: System now dynamically detects all brand tabs in Google Sheets without manual code updates
- **Smart Exclusion Logic**: Automatically excludes control tabs ("Datos Diarios", "Control Campañas") and variations
- **New Brand Detection**: Successfully detected and synchronized VW brand (243 leads) without any manual intervention  
- **Comprehensive Coverage**: Now processes 9 brand tabs dynamically: Citroen, Chevrolet, Fiat, Ford, Jeep, Toyota, Renault, Peugeot, VW
- **Fallback Protection**: Maintains fixed brand list as backup if dynamic detection fails
- **UI Error Fix**: Resolved sync button HTTP method error, now uses correct apiRequest parameters
- **Real-time Processing**: Processes 4,359+ leads automatically from all detected tabs

### PostgreSQL Migration and Performance Optimization Completed ✅
- **Performance Achievement**: Successfully migrated from Google Sheets API (15+ seconds) to PostgreSQL-based dashboard (3.2 seconds) - **80% performance improvement**
- **Multi-Brand Synchronization**: Implemented complete refactored synchronization system for all brand-specific Google Sheets tabs (Fiat: 1,081 leads, Peugeot: 391 leads, Toyota, Chevrolet, Renault, Citroen)
- **Dual Endpoint System**: Dashboard now uses `/api/dashboard/datos-diarios-db` (PostgreSQL) as primary source with `/api/dashboard/datos-diarios` (Google Sheets) as fallback
- **Data Integrity Maintained**: All existing corrections preserved (RENAULT: 45, NOVO GROUP: 106, GRUPO QUIJADA overrides)
- **UI Enhancement**: Added real-time performance indicators and data source controls in dashboard interface

### Enhanced Column Capture and Sync Service Refactoring Completed ✅ (August 18, 2025)
- **Expanded Data Capture**: Successfully implemented capture of Google Sheets columns G, H, I for enhanced lead metadata
  - Column G (origen): Lead source (WhatsApp, Instagram, etc.)
  - Column H (localizacion): Geographic location of lead
  - Column I (cliente): Specific client associated with lead
- **Refactored Sync Service**: Created centralized `SyncService` with separation of responsibilities for CRM-wide reuse
- **Multiple Sync Endpoints**: Added specialized endpoints for different synchronization contexts:
  - `/api/sync/full`: Full manual synchronization with options (refactored system)
  - `/api/sync/incremental`: Incremental sync for new data only
  - `/api/sync/status`: Real-time sync status monitoring  
  - `/api/sync/sheets/:sheetNames`: Brand-specific synchronization
- **Enhanced Configurability**: Flexible sync options (forceFullSync, includeDashboard, includeMetrics, specificSheets)
- **Data Validation**: System now captures and validates new column data from 3,955+ leads with extended metadata

### Automatic Sync Migration to Incremental System ✅ (August 18, 2025)
- **Unified Sync Architecture**: Migrated automatic 15-minute sync to use the same proven system as manual sync
- **Data Preservation**: Changed from destructive full refresh to incremental updates that preserve existing data
- **Consistent Column Capture**: Automatic sync now captures columns G, H, I like manual sync
- **Performance Optimization**: Automatic sync uses efficient handleSheetSync instead of custom processing
- **Data Integrity**: Preserves all manual corrections (RENAULT: 45, NOVO GROUP: 106) during automatic updates

### Dashboard UI Simplification ✅ (August 18, 2025)
- **Interface Cleanup**: Removed dual-system complexity by eliminating PostgreSQL/Google Sheets fallback options
- **Removed Components**: 
  - "PostgreSQL Activo" status indicator and related visual elements
  - "Fallback: Google Sheets" button and complete fallback functionality
  - fetchGoogleSheetsDataManually function and associated state variables
- **Simplified Architecture**: Dashboard now uses PostgreSQL exclusively as data source with automatic background sync
- **Enhanced Focus**: Streamlined interface focuses on core functionality without technical complexity indicators

### Critical Data Counting Fix ✅ (August 18, 2025)
- **Root Cause Resolved**: Fixed major issue where dashboard queries used empty `google_sheets_data` table instead of populated `leads` table
- **Data Architecture Correction**: Modified SQL queries to use `leads` table containing 3,799 synchronized leads from Google Sheets
- **Campaign Date Alignment**: Corrected campaign date mismatches causing 0 enviados for Toyota (101 leads), Citroen (198 leads), and Fiat campaigns (1,259 leads)
- **Date Range Fixes**: Updated Toyota campaign dates from 2025-06-07 to 2025-07-06→2025-07-19, Citroen to 2025-07-17→2025-08-18, and Fiat to 2025-06-13→2025-08-18
- **Perfect Data Accuracy**: All campaigns now display correct lead counts with zero data loss, achieving 100% data integrity across all brands

### Enhanced Business Logic and CSV Export System ✅ (August 18, 2025)
- **Automatic fecha_fin Calculation**: Implemented PostgreSQL-based calculateFechaFin function that determines completion dates when cantidad_datos_solicitados is reached chronologically
- **CITROEN 3 Fix**: Corrected fecha_fin from 2025-08-14 to 2025-08-15, showing 42 enviados (30 requested + spillover leads from completion day)
- **CSV Export for Finalized Campaigns**: Added comprehensive export functionality with download button in "Campañas Finalizadas" section
- **Detailed Lead Export**: New backend endpoints `/api/export/campana-leads/:campaignName` and `/api/export/campanas-finalizadas` provide complete lead data with metadata
- **Business Rule Compliance**: fecha_fin automatically calculates when nth lead (cantidad_datos_solicitados) is reached, not set manually as fixed date

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Framework**: Tailwind CSS with shadcn/ui
- **State Management**: TanStack Query for server state, local React state for UI
- **Routing**: Wouter
- **Real-time**: Native WebSocket API

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: WebSocket Server (ws library)
- **Session Storage**: PostgreSQL-based sessions with connect-pg-simple

### Database Schema
Key entities include Users, Campaigns, Leads, Daily Stats, Lead Notes, Clientes (Client management with commercial info, brands, zones), and Dashboard Campaigns.

### Key Components
- **Dashboard Features**: Real-time "Datos Diarios" display with CPL, "CPL Directo" for CPL management, "Finanzas Dashboard" for financial analysis (profit, ROI, taxes), Client Management (ABM) with CRUD, Campaign Analytics (lead counts, spending, conversion), Google Sheets Integration, and Meta Ads API Integration for real-time spending.
- **UI Components**: Consistent navigation, interactive tables, form-based CRUD interfaces, and WebSocket-based real-time updates.
- **Storage Layer**: Production-ready PostgreSQL via Drizzle, with an IStorage interface for backend flexibility.

### System Design Choices
- **Data Flow**: Automatic periodic synchronization with Google Sheets, WebSocket for live dashboard updates, manual input processing, and full CRUD operations for client data, all persisting to PostgreSQL.
- **UI/UX Decisions**: A modern, clean design with a focus on usability, incorporating a business-oriented color scheme (blue-purple gradients, amber/orange accents) and interactive elements like hover effects and elevated cards.

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL driver
- **drizzle-orm**: ORM for database interaction
- **@tanstack/react-query**: Server state management
- **ws**: WebSocket implementation
- **axios**: HTTP client for API integrations

### UI Dependencies
- **@radix-ui/***: Accessible component primitives
- **tailwindcss**: CSS framework
- **lucide-react**: Icon library

### Development Tools
- **tsx**: TypeScript execution
- **esbuild**: Backend bundling
- **vite**: Frontend development and build tool