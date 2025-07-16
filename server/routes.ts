import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { 
  insertLeadSchema, 
  insertCampaignSchema, 
  insertDailyStatsSchema,
  insertLeadNoteSchema,
  insertUserSchema
} from "@shared/schema";

interface WebSocketWithData extends WebSocket {
  userId?: number;
  dashboardId?: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // WebSocket server for real-time dashboard updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  const dashboardConnections = new Set<WebSocketWithData>();

  wss.on('connection', (ws: WebSocketWithData) => {
    console.log('Dashboard client connected');
    dashboardConnections.add(ws);

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'join_dashboard':
            ws.userId = message.userId;
            ws.dashboardId = message.dashboardId;
            
            // Send current stats to new connection
            const stats = await getRealtimeStats();
            ws.send(JSON.stringify({
              type: 'dashboard_update',
              data: stats
            }));
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      dashboardConnections.delete(ws);
    });
  });

  async function getRealtimeStats() {
    const [leadsCount, totalSpend, conversionRate, costPerLead] = await Promise.all([
      storage.getLeadsCount('today'),
      storage.getTotalSpend('today'),
      storage.getConversionRate('today'),
      storage.getCostPerLead('today')
    ]);

    return {
      leadsCount,
      totalSpend,
      conversionRate,
      costPerLead,
      timestamp: new Date()
    };
  }

  function broadcastDashboardUpdate(data: any) {
    const message = JSON.stringify({
      type: 'dashboard_update',
      data
    });
    
    dashboardConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  // Auth routes
  app.post('/api/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      
      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Simple session (in production use proper session management)
      res.json({ 
        user: { 
          id: user.id, 
          username: user.username, 
          email: user.email,
          role: user.role 
        },
        token: `user_${user.id}_${Date.now()}`
      });
    } catch (error) {
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // Dashboard analytics routes
  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      const timeframe = req.query.timeframe as string || 'today';
      
      const [leadsCount, totalSpend, conversionRate, costPerLead] = await Promise.all([
        storage.getLeadsCount(timeframe),
        storage.getTotalSpend(timeframe),
        storage.getConversionRate(timeframe),
        storage.getCostPerLead(timeframe)
      ]);

      const stats = {
        leadsCount,
        totalSpend: Number(totalSpend.toFixed(2)),
        conversionRate: Number(conversionRate.toFixed(2)),
        costPerLead: Number(costPerLead.toFixed(2))
      };

      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  });

  // Campaign routes
  app.get('/api/campaigns', async (req, res) => {
    try {
      const campaigns = await storage.getAllCampaigns();
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
  });

  app.post('/api/campaigns', async (req, res) => {
    try {
      const validatedData = insertCampaignSchema.parse(req.body);
      const campaign = await storage.createCampaign(validatedData);
      res.status(201).json(campaign);
    } catch (error) {
      res.status(400).json({ error: 'Invalid campaign data' });
    }
  });

  app.get('/api/campaigns/:id', async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      
      res.json(campaign);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch campaign' });
    }
  });

  // Lead routes
  app.get('/api/leads', async (req, res) => {
    try {
      const status = req.query.status as string;
      const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      
      const leads = await storage.getLeads({ status, campaignId, limit });
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch leads' });
    }
  });

  app.post('/api/leads', async (req, res) => {
    try {
      const validatedData = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(validatedData);
      
      // Broadcast real-time update
      const stats = await getRealtimeStats();
      broadcastDashboardUpdate(stats);
      
      res.status(201).json(lead);
    } catch (error) {
      res.status(400).json({ error: 'Invalid lead data' });
    }
  });

  app.get('/api/leads/:id', async (req, res) => {
    try {
      const leadId = parseInt(req.params.id);
      const lead = await storage.getLead(leadId);
      
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      
      res.json(lead);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch lead' });
    }
  });

  app.patch('/api/leads/:id', async (req, res) => {
    try {
      const leadId = parseInt(req.params.id);
      const updates = req.body;
      
      const lead = await storage.updateLead(leadId, updates);
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      
      // Broadcast real-time update
      const stats = await getRealtimeStats();
      broadcastDashboardUpdate(stats);
      
      res.json(lead);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update lead' });
    }
  });

  // Lead notes routes
  app.get('/api/leads/:leadId/notes', async (req, res) => {
    try {
      const leadId = parseInt(req.params.leadId);
      const notes = await storage.getLeadNotes(leadId);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch lead notes' });
    }
  });

  app.post('/api/leads/:leadId/notes', async (req, res) => {
    try {
      const leadId = parseInt(req.params.leadId);
      const validatedData = insertLeadNoteSchema.parse({
        ...req.body,
        leadId
      });
      
      const note = await storage.createLeadNote(validatedData);
      res.status(201).json(note);
    } catch (error) {
      res.status(400).json({ error: 'Invalid note data' });
    }
  });

  // Daily stats routes
  app.get('/api/stats/daily', async (req, res) => {
    try {
      const date = req.query.date as string;
      const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined;
      
      const stats = await storage.getDailyStats(date, campaignId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch daily stats' });
    }
  });

  app.post('/api/stats/daily', async (req, res) => {
    try {
      const validatedData = insertDailyStatsSchema.parse(req.body);
      const stats = await storage.createDailyStats(validatedData);
      
      // Broadcast real-time update
      const realtimeStats = await getRealtimeStats();
      broadcastDashboardUpdate(realtimeStats);
      
      res.status(201).json(stats);
    } catch (error) {
      res.status(400).json({ error: 'Invalid stats data' });
    }
  });

  // Webhook endpoint for Make.com integration
  app.post('/api/webhook/lead', async (req, res) => {
    try {
      console.log('Webhook received:', req.body);
      
      // Validate required fields
      const requiredFields = ['email', 'firstName', 'lastName'];
      const missing = requiredFields.filter(field => !req.body[field]);
      
      if (missing.length > 0) {
        return res.status(400).json({ 
          error: 'Missing required fields', 
          missing 
        });
      }
      
      // Create lead from webhook data
      const leadData = {
        metaLeadId: req.body.metaLeadId || `WEBHOOK_${Date.now()}`,
        campaignId: req.body.campaignId || 1, // Default campaign
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        phone: req.body.phone,
        age: req.body.age ? parseInt(req.body.age) : undefined,
        city: req.body.city,
        interest: req.body.interest,
        budget: req.body.budget,
        adName: req.body.adName,
        adsetName: req.body.adsetName,
        campaignName: req.body.campaignName,
        cost: req.body.cost,
        leadDate: req.body.leadDate ? new Date(req.body.leadDate) : new Date()
      };
      
      const lead = await storage.createLead(leadData);
      
      // Broadcast real-time update
      const stats = await getRealtimeStats();
      broadcastDashboardUpdate(stats);
      
      res.status(201).json({ 
        success: true, 
        leadId: lead.id,
        message: 'Lead created successfully'
      });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'Failed to process webhook' });
    }
  });

  return httpServer;
}
