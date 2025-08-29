/**
 * Configuración específica para el sistema de sincronización
 * Centraliza todas las configuraciones relacionadas con sync
 */

export const SYNC_CONFIG = {
  // Configuración de procesamiento
  DEFAULT_BATCH_SIZE: 100,
  MAX_CONCURRENT_REQUESTS: 3,
  
  // Timeouts
  SYNC_TIMEOUT_MS: 10 * 60 * 1000, // 10 minutos
  SHEET_REQUEST_TIMEOUT_MS: 30 * 1000, // 30 segundos
  
  // Validación
  ENABLE_DATA_VALIDATION: true,
  ENABLE_DUPLICATE_DETECTION: true,
  
  // Logging
  ENABLE_DEBUG_LOGGING: process.env.NODE_ENV === 'development',
  LOG_SYNC_PERFORMANCE: true,
  
  // Sheets
  AVAILABLE_SHEETS: [
    'Fiat',
    'Peugeot', 
    'Citroen',
    'Toyota',
    'Chevrolet',
    'Renault',
    'VW',
    'Jeep',
    'Ford'
  ],
  
  // Columnas de Google Sheets
  SHEET_COLUMNS: {
    TIMESTAMP: 'A',
    NAME: 'B',
    EMAIL: 'C',
    PHONE: 'D',
    CITY: 'E',
    INTEREST: 'F',
    ORIGEN: 'G',      // Nuevo: Origen del lead
    LOCALIZACION: 'H', // Nuevo: Ubicación geográfica
    CLIENTE: 'I'      // Nuevo: Cliente específico
  },
  
  // Filtros y exclusiones
  EXCLUDED_SHEETS: [
    'Datos Diarios',
    'Control Campañas',
    'Template',
    'Config'
  ],
  
  // Duplicados
  DUPLICATE_DETECTION_FIELDS: ['phone', 'metaLeadId'],
  SIMILARITY_THRESHOLD: 80, // Porcentaje
  
  // Performance
  MAX_LEADS_PER_SYNC: 10000,
  ENABLE_PARALLEL_PROCESSING: true,
  
  // Retry
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
  
  // Sync automático
  AUTO_SYNC_ENABLED: process.env.NODE_ENV === 'production',
  AUTO_SYNC_INTERVAL_MINUTES: 15,
  
  // Metadatos
  SYNC_VERSION: '2.0.0',
  LAST_MIGRATION_DATE: '2025-08-29'
} as const;

/**
 * Configuración específica por entorno
 */
export const getEnvironmentConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return {
        ...SYNC_CONFIG,
        ENABLE_DEBUG_LOGGING: false,
        AUTO_SYNC_ENABLED: true,
        DEFAULT_BATCH_SIZE: 200,
        MAX_CONCURRENT_REQUESTS: 5
      };
    
    case 'test':
      return {
        ...SYNC_CONFIG,
        ENABLE_DEBUG_LOGGING: true,
        AUTO_SYNC_ENABLED: false,
        DEFAULT_BATCH_SIZE: 10,
        MAX_CONCURRENT_REQUESTS: 1,
        SYNC_TIMEOUT_MS: 5000
      };
    
    case 'development':
    default:
      return SYNC_CONFIG;
  }
};

/**
 * Utilidad para validar configuración
 */
export const validateConfig = (): boolean => {
  const config = getEnvironmentConfig();
  
  // Validaciones básicas
  if (config.DEFAULT_BATCH_SIZE <= 0) {
    console.error('❌ Config error: DEFAULT_BATCH_SIZE must be greater than 0');
    return false;
  }
  
  if (config.MAX_CONCURRENT_REQUESTS <= 0) {
    console.error('❌ Config error: MAX_CONCURRENT_REQUESTS must be greater than 0');
    return false;
  }
  
  if (config.AVAILABLE_SHEETS.length === 0) {
    console.error('❌ Config error: AVAILABLE_SHEETS cannot be empty');
    return false;
  }
  
  console.log('✅ Sync configuration validated successfully');
  return true;
};

/**
 * Configuración de logging para sync
 */
export const SYNC_LOGGER_CONFIG = {
  levels: {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
  },
  
  currentLevel: SYNC_CONFIG.ENABLE_DEBUG_LOGGING ? 3 : 2,
  
  formatters: {
    sync: (message: string) => `🔄 SYNC: ${message}`,
    error: (message: string) => `❌ SYNC ERROR: ${message}`,
    success: (message: string) => `✅ SYNC SUCCESS: ${message}`,
    warn: (message: string) => `⚠️ SYNC WARNING: ${message}`,
    info: (message: string) => `ℹ️ SYNC INFO: ${message}`
  }
};

/**
 * Log helper específico para sync
 */
export const syncLogger = {
  error: (message: string, ...args: any[]) => {
    if (SYNC_LOGGER_CONFIG.currentLevel >= 0) {
      console.error(SYNC_LOGGER_CONFIG.formatters.error(message), ...args);
    }
  },
  
  warn: (message: string, ...args: any[]) => {
    if (SYNC_LOGGER_CONFIG.currentLevel >= 1) {
      console.warn(SYNC_LOGGER_CONFIG.formatters.warn(message), ...args);
    }
  },
  
  info: (message: string, ...args: any[]) => {
    if (SYNC_LOGGER_CONFIG.currentLevel >= 2) {
      console.info(SYNC_LOGGER_CONFIG.formatters.info(message), ...args);
    }
  },
  
  debug: (message: string, ...args: any[]) => {
    if (SYNC_LOGGER_CONFIG.currentLevel >= 3) {
      console.log(SYNC_LOGGER_CONFIG.formatters.sync(message), ...args);
    }
  },
  
  success: (message: string, ...args: any[]) => {
    console.log(SYNC_LOGGER_CONFIG.formatters.success(message), ...args);
  }
};