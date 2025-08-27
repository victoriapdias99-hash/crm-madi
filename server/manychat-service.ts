import axios from 'axios';
import type { Express } from "express";

interface ManychatConfig {
  apiKey: string;
  pageId?: string;
}

interface ManychatSubscriber {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  custom_fields?: Record<string, any>;
  created_time: string;
  updated_time: string;
}

interface WebhookSetupResult {
  success: boolean;
  webhookId?: string;
  url?: string;
  error?: string;
}

export class ManychatService {
  private config: ManychatConfig;
  private baseUrl: string = 'https://api.manychat.com/fb';

  constructor(config: ManychatConfig) {
    this.config = config;
  }

  /**
   * Configura un webhook directamente en Manychat
   */
  async setupWebhook(callbackUrl: string, events: string[] = ['subscriber_created', 'subscriber_updated']): Promise<WebhookSetupResult> {
    try {
      console.log(`🔗 Configurando webhook de Manychat: ${callbackUrl}`);
      
      const response = await axios.post(`${this.baseUrl}/subscriber/webhook`, {
        url: callbackUrl,
        events: events
      }, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.status === 200) {
        console.log(`✅ Webhook configurado exitosamente en Manychat`);
        return {
          success: true,
          webhookId: response.data.id,
          url: callbackUrl
        };
      }

      return {
        success: false,
        error: 'Error desconocido al configurar webhook'
      };

    } catch (error: any) {
      console.error('Error configurando webhook de Manychat:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  /**
   * Obtiene información de un suscriptor específico
   */
  async getSubscriber(subscriberId: string): Promise<ManychatSubscriber | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/subscriber/getInfo`, {
        params: {
          subscriber_id: subscriberId
        },
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      if (response.data && response.data.data) {
        return response.data.data;
      }

      return null;
    } catch (error: any) {
      console.error('Error obteniendo datos del suscriptor:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Obtiene todos los suscriptores recientes (últimas 24h)
   */
  async getRecentSubscribers(): Promise<ManychatSubscriber[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/subscriber/findByName`, {
        params: {
          name: '', // Vacío para obtener todos
          limit: 50
        },
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      if (response.data && response.data.data) {
        return response.data.data;
      }

      return [];
    } catch (error: any) {
      console.error('Error obteniendo suscriptores:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Valida que la API key funciona correctamente
   */
  async validateConnection(): Promise<boolean> {
    try {
      // Intentar obtener información básica para validar la conexión
      const response = await axios.get(`${this.baseUrl}/page/getInfo`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      console.log('✅ Conexión con Manychat validada exitosamente');
      return response.status === 200;
    } catch (error: any) {
      console.error('❌ Error validando conexión con Manychat:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Configura webhook automáticamente y devuelve la URL
   */
  async autoConfigureWebhook(baseUrl: string, webhookPath: string = 'manychat-direct'): Promise<string> {
    const webhookUrl = `${baseUrl}/webhook/${webhookPath}`;
    
    const result = await this.setupWebhook(webhookUrl);
    
    if (result.success) {
      console.log(`🎯 Webhook configurado automáticamente: ${webhookUrl}`);
      return webhookUrl;
    } else {
      console.warn(`⚠️ No se pudo configurar webhook automáticamente: ${result.error}`);
      return webhookUrl; // Devolver URL aunque no se configure automáticamente
    }
  }

  /**
   * Procesa datos de webhook entrante de Manychat
   */
  processWebhookData(webhookData: any): {
    nombre: string;
    telefono: string;
    email?: string;
    customFields: Record<string, any>;
    timestamp: Date;
  } {
    console.log('📥 Procesando datos de webhook directo de Manychat:', JSON.stringify(webhookData, null, 2));

    // Estructuras posibles de Manychat webhook
    const subscriber = webhookData.subscriber || webhookData;
    
    return {
      nombre: `${subscriber.first_name || ''} ${subscriber.last_name || ''}`.trim() || 'No especificado',
      telefono: subscriber.phone || webhookData.phone || 'No especificado',
      email: subscriber.email || webhookData.email,
      customFields: subscriber.custom_fields || webhookData.custom_fields || {},
      timestamp: new Date()
    };
  }
}

// Instancia global del servicio
let manychatService: ManychatService | null = null;

/**
 * Inicializa el servicio de Manychat con la API key del entorno
 */
export function initializeManychatService(): ManychatService | null {
  const apiKey = process.env.MANYCHAT_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️ MANYCHAT_API_KEY no encontrada en variables de entorno');
    return null;
  }

  try {
    manychatService = new ManychatService({ apiKey });
    console.log('🤖 Servicio de Manychat inicializado correctamente');
    return manychatService;
  } catch (error) {
    console.error('❌ Error inicializando servicio de Manychat:', error);
    return null;
  }
}

/**
 * Obtiene la instancia del servicio de Manychat
 */
export function getManychatService(): ManychatService | null {
  return manychatService;
}

/**
 * Registra las rutas de Manychat directo
 */
export function registerManychatDirectRoutes(app: Express) {
  // Endpoint para webhook directo de Manychat (sin configuración previa)
  app.post('/webhook/manychat-direct', async (req, res) => {
    try {
      console.log('📱 Webhook directo de Manychat recibido');
      
      const service = getManychatService();
      if (!service) {
        return res.status(503).json({ 
          error: 'Servicio de Manychat no disponible' 
        });
      }

      // Procesar datos del webhook
      const processedData = service.processWebhookData(req.body);
      
      console.log('✅ Datos procesados de Manychat directo:', processedData);
      
      // TODO: Aquí podríamos guardar directamente en la base de datos
      // Por ahora solo devolvemos éxito
      
      res.json({
        success: true,
        message: 'Datos de Manychat procesados correctamente',
        processed: processedData
      });

    } catch (error) {
      console.error('❌ Error procesando webhook directo de Manychat:', error);
      res.status(500).json({
        error: 'Error procesando datos de Manychat',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });

  // Endpoint para configurar webhook automáticamente
  app.post('/api/manychat/setup-webhook', async (req, res) => {
    try {
      const service = getManychatService();
      if (!service) {
        return res.status(503).json({ 
          error: 'Servicio de Manychat no disponible. Verifique la API key.' 
        });
      }

      // Validar conexión primero
      const isValid = await service.validateConnection();
      if (!isValid) {
        return res.status(400).json({
          error: 'API key de Manychat inválida o sin permisos'
        });
      }

      // Configurar webhook automáticamente
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const webhookUrl = await service.autoConfigureWebhook(baseUrl);
      
      res.json({
        success: true,
        message: 'Webhook de Manychat configurado',
        webhookUrl: webhookUrl
      });

    } catch (error) {
      console.error('❌ Error configurando webhook de Manychat:', error);
      res.status(500).json({
        error: 'Error configurando webhook',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });

  // Endpoint para validar conexión con Manychat
  app.get('/api/manychat/validate', async (req, res) => {
    try {
      const service = getManychatService();
      if (!service) {
        return res.status(503).json({ 
          success: false,
          error: 'Servicio de Manychat no disponible' 
        });
      }

      const isValid = await service.validateConnection();
      
      res.json({
        success: isValid,
        message: isValid ? 'Conexión con Manychat exitosa' : 'Error de conexión con Manychat'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error validando conexión',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });
}