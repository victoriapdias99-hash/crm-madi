/**
 * Entidad de dominio para un Lead en el proceso de sincronización
 * Esta entidad contiene la lógica de negocio pura sin dependencias externas
 */
export interface SyncLead {
  // Identificador único para detección de duplicados
  metaLeadId: string;
  
  // Datos básicos del lead
  nombre: string;
  telefono: string;
  email: string;
  ciudad: string | null;            // ✅ Permite NULL
  modelo: string | null;            // ✅ Permite NULL - Modelo del auto
  comentarioHorario: string | null; // ✅ Permite NULL - Horario/Comentarios
  
  // Metadatos de origen
  marca: string;
  origen: string | null;            // ✅ Permite NULL - WhatsApp, Instagram, etc.
  localizacion: string | null;      // ✅ Permite NULL - Ubicación geográfica
  cliente: string | null;           // ✅ Permite NULL - Cliente específico asociado
  
  // Control de sincronización
  googleSheetsRowNumber?: number;   // Número de fila exacto en Google Sheets
  
  // Información temporal
  fechaCreacion: string;
  
  // Origen del dato
  source: 'google_sheets' | 'meta_ads' | 'manual';
  campaign: string;
}

/**
 * Lead procesado listo para almacenamiento
 */
export interface ProcessedSyncLead extends SyncLead {
  // Campos normalizados y validados
  normalizedPhone: string;
  normalizedEmail: string;
  normalizedClient: string;
  
  // Estado de procesamiento
  isValid: boolean;
  validationErrors: string[];
  isDuplicate: boolean;
  duplicateOf?: string;
}

/**
 * Lead raw desde Google Sheets
 */
export interface RawSheetLead {
  timestamp: string;
  name: string;
  email: string | null;
  phone: string;
  city: string | null;
  interest: string | null;
  budget: string | null;
  modelo: string | null;                   // Modelo del auto
  comentarioHorario: string | null;        // Horario/Comentarios
  origen: string | null;      // Columna G
  localizacion: string | null; // Columna H
  cliente: string | null;     // Columna I
  googleSheetsRowNumber?: number;   // Número de fila exacto en Google Sheets
  source: string;
  campaign: string;
  cost: string;
}