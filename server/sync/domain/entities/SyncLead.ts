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
  ciudad: string;
  modelo: string;                   // Modelo del auto
  comentarioHorario: string;        // Horario/Comentarios
  
  // Metadatos de origen
  marca: string;
  origen: string;        // WhatsApp, Instagram, etc.
  localizacion: string;  // Ubicación geográfica
  cliente: string;       // Cliente específico asociado
  
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
  email: string;
  phone: string;
  city: string;
  interest: string;
  budget: string;
  modelo: string;                   // Modelo del auto
  comentarioHorario: string;        // Horario/Comentarios
  origen: string;      // Columna G
  localizacion: string; // Columna H
  cliente: string;     // Columna I
  source: string;
  campaign: string;
  cost: string;
}