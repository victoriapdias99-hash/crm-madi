import type { Express } from "express";
import { storage } from "./storage";
import { 
  insertManychatWebhookSchema,
  insertIntegracionManychatSchema
} from "@shared/schema";
import { z } from "zod";

export function registerIntegracionManychatRoutes(app: Express) {
  // ===== WEBHOOK MANAGEMENT ENDPOINTS =====
  
  // Obtener todos los webhooks configurados
  app.get('/api/integracion-manychat/webhooks', async (req, res) => {
    try {
      const webhooks = await storage.getAllManychatWebhooks();
      res.json(webhooks);
    } catch (error) {
      console.error('Error fetching Manychat webhooks:', error);
      res.status(500).json({ 
        error: 'Error al obtener los webhooks de Manychat' 
      });
    }
  });

  // Crear nuevo webhook
  app.post('/api/integracion-manychat/webhooks', async (req, res) => {
    try {
      const webhookData = insertManychatWebhookSchema.parse(req.body);
      const newWebhook = await storage.createManychatWebhook(webhookData);
      
      console.log(`✅ Nuevo webhook Manychat creado: ${newWebhook.marca} - ${newWebhook.webhookUrl}`);
      res.status(201).json(newWebhook);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Datos de webhook inválidos',
          details: error.errors 
        });
      }
      
      console.error('Error creating Manychat webhook:', error);
      res.status(500).json({ 
        error: 'Error al crear el webhook de Manychat' 
      });
    }
  });

  // Actualizar webhook
  app.put('/api/integracion-manychat/webhooks/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'ID inválido' });
      }

      const updates = insertManychatWebhookSchema.partial().parse(req.body);
      const updatedWebhook = await storage.updateManychatWebhook(id, updates);
      
      if (!updatedWebhook) {
        return res.status(404).json({ error: 'Webhook no encontrado' });
      }

      console.log(`✅ Webhook Manychat actualizado: ${updatedWebhook.marca}`);
      res.json(updatedWebhook);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Datos de webhook inválidos',
          details: error.errors 
        });
      }
      
      console.error('Error updating Manychat webhook:', error);
      res.status(500).json({ 
        error: 'Error al actualizar el webhook' 
      });
    }
  });

  // Eliminar webhook
  app.delete('/api/integracion-manychat/webhooks/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'ID inválido' });
      }

      const deleted = await storage.deleteManychatWebhook(id);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Webhook no encontrado' });
      }

      console.log(`🗑️ Webhook Manychat eliminado: ID ${id}`);
      res.json({ success: true, message: 'Webhook eliminado correctamente' });
    } catch (error) {
      console.error('Error deleting Manychat webhook:', error);
      res.status(500).json({ 
        error: 'Error al eliminar el webhook' 
      });
    }
  });

  // ===== WEBHOOK DATA RECEIVER ENDPOINT =====
  
  // Recibir datos de webhook de Manychat (endpoint público que Make.com llama)
  app.post('/webhook/manychat/:webhookUrl', async (req, res) => {
    try {
      const { webhookUrl } = req.params;
      
      // Buscar el webhook por URL
      const webhook = await storage.getManychatWebhookByUrl(webhookUrl);
      if (!webhook || !webhook.activo) {
        console.warn(`❌ Webhook no encontrado o inactivo: ${webhookUrl}`);
        return res.status(404).json({ error: 'Webhook no encontrado o inactivo' });
      }

      console.log(`📥 Datos recibidos en webhook ${webhook.marca}:`, JSON.stringify(req.body, null, 2));

      // Procesar los datos según la estructura de Manychat
      const manychatData = req.body;
      
      // Extraer datos según el mapeo de la imagen
      const leadData = {
        webhookId: webhook.id,
        fecha: new Date(), // Fecha actual
        nombre: manychatData.subscriber?.name || manychatData['1']?.subscriber?.name || 'No especificado',
        telefono: manychatData.whatsapp_phone || manychatData['2']?.whatsapp_phone || 'No especificado',
        localidad: webhook.localizacionField, // Campo configurable
        modelo: manychatData.custom_fields?.auto || manychatData['2']?.custom_fields?.auto || '',
        horarioComentarios: manychatData.custom_fields?.comentario || manychatData['2']?.custom_fields?.comentario || '',
        origen: 'Whatsapp', // Siempre Whatsapp según la imagen
        localizacion: webhook.clienteField, // Campo configurable
        marca: webhook.marca,
        rawData: manychatData // Almacenar datos originales para debugging
      };

      // Validar y crear el registro
      const validatedData = insertIntegracionManychatSchema.parse(leadData);
      const createdIntegracion = await storage.createIntegracionManychat(validatedData);
      
      console.log(`✅ Lead de Manychat registrado: ${leadData.nombre} - ${leadData.telefono} (${webhook.marca})`);
      
      res.json({ 
        success: true, 
        message: 'Datos procesados correctamente',
        leadId: createdIntegracion.id
      });
      
    } catch (error) {
      console.error('Error processing Manychat webhook:', error);
      res.status(500).json({ 
        error: 'Error al procesar los datos del webhook',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  });

  // ===== DATA VIEWING ENDPOINTS =====
  
  // Obtener todos los datos de integración
  app.get('/api/integracion-manychat/datos', async (req, res) => {
    try {
      const { webhookId, marca, limit = 100 } = req.query;
      
      const filters: { webhookId?: number; marca?: string; limit?: number } = {};
      
      if (webhookId) {
        const id = parseInt(webhookId as string);
        if (!isNaN(id)) filters.webhookId = id;
      }
      
      if (marca) {
        filters.marca = marca as string;
      }
      
      if (limit) {
        const limitNum = parseInt(limit as string);
        if (!isNaN(limitNum)) filters.limit = limitNum;
      }

      const datos = await storage.getAllIntegracionManychat(filters);
      res.json(datos);
    } catch (error) {
      console.error('Error fetching Manychat integration data:', error);
      res.status(500).json({ 
        error: 'Error al obtener los datos de integración' 
      });
    }
  });

  // Obtener un registro específico
  app.get('/api/integracion-manychat/datos/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'ID inválido' });
      }

      const dato = await storage.getIntegracionManychat(id);
      
      if (!dato) {
        return res.status(404).json({ error: 'Registro no encontrado' });
      }

      res.json(dato);
    } catch (error) {
      console.error('Error fetching Manychat integration record:', error);
      res.status(500).json({ 
        error: 'Error al obtener el registro' 
      });
    }
  });
}