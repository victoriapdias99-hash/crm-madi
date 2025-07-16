import { 
  users, campaigns, leads, dailyStats, leadNotes,
  type User, type InsertUser,
  type Campaign, type InsertCampaign,
  type Lead, type InsertLead,
  type DailyStats, type InsertDailyStats,
  type LeadNote, type InsertLeadNote
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Campaign operations
  getCampaign(id: number): Promise<Campaign | undefined>;
  getAllCampaigns(): Promise<Campaign[]>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: number, updates: Partial<Campaign>): Promise<Campaign | undefined>;

  // Lead operations
  getLead(id: number): Promise<Lead | undefined>;
  getLeads(filters?: { status?: string; campaignId?: number; limit?: number }): Promise<Lead[]>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: number, updates: Partial<Lead>): Promise<Lead | undefined>;

  // Daily stats operations
  getDailyStats(date?: string, campaignId?: number): Promise<DailyStats[]>;
  createDailyStats(stats: InsertDailyStats): Promise<DailyStats>;

  // Lead notes operations
  getLeadNotes(leadId: number): Promise<LeadNote[]>;
  createLeadNote(note: InsertLeadNote): Promise<LeadNote>;

  // Dashboard analytics
  getLeadsCount(timeframe?: string): Promise<number>;
  getTotalSpend(timeframe?: string): Promise<number>;
  getConversionRate(timeframe?: string): Promise<number>;
  getCostPerLead(timeframe?: string): Promise<number>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private campaigns: Map<number, Campaign>;
  private leads: Map<number, Lead>;
  private dailyStats: Map<number, DailyStats>;
  private leadNotes: Map<number, LeadNote>;
  
  private currentUserId: number;
  private currentCampaignId: number;
  private currentLeadId: number;
  private currentDailyStatsId: number;
  private currentLeadNoteId: number;

  constructor() {
    this.users = new Map();
    this.campaigns = new Map();
    this.leads = new Map();
    this.dailyStats = new Map();
    this.leadNotes = new Map();
    
    this.currentUserId = 1;
    this.currentCampaignId = 1;
    this.currentLeadId = 1;
    this.currentDailyStatsId = 1;
    this.currentLeadNoteId = 1;

    // Crear datos de ejemplo
    this.seedData();
  }

  private seedData() {
    // Usuario admin por defecto
    const adminUser: User = {
      id: 1,
      username: "admin",
      password: "admin123",
      email: "admin@dashboard.com",
      role: "admin",
      createdAt: new Date()
    };
    this.users.set(1, adminUser);
    this.currentUserId = 2;

    // Campañas de ejemplo
    const campaign1: Campaign = {
      id: 1,
      name: "Campaña Meta Leads Q1",
      metaCampaignId: "META_001",
      status: "active",
      budget: "5000.00",
      startDate: "2024-01-01",
      endDate: "2024-03-31",
      createdAt: new Date()
    };
    this.campaigns.set(1, campaign1);

    const campaign2: Campaign = {
      id: 2,
      name: "Promoción Verano",
      metaCampaignId: "META_002",
      status: "active",
      budget: "3000.00",
      startDate: "2024-02-01",
      endDate: "2024-04-30",
      createdAt: new Date()
    };
    this.campaigns.set(2, campaign2);
    this.currentCampaignId = 3;

    // Leads de ejemplo
    const leads = [
      {
        id: 1,
        metaLeadId: "LEAD_001",
        campaignId: 1,
        firstName: "Juan",
        lastName: "Pérez",
        email: "juan.perez@email.com",
        phone: "+54911234567",
        age: 32,
        city: "Buenos Aires",
        interest: "Marketing Digital",
        budget: "$1000-$5000",
        adName: "Ad Principal",
        adsetName: "Adset Buenos Aires",
        campaignName: "Campaña Meta Leads Q1",
        status: "new",
        source: "meta_ads",
        cost: "25.50",
        leadDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 2,
        metaLeadId: "LEAD_002",
        campaignId: 1,
        firstName: "María",
        lastName: "González",
        email: "maria.gonzalez@email.com",
        phone: "+54911234568",
        age: 28,
        city: "Córdoba",
        interest: "Consultoría",
        budget: "$500-$2000",
        adName: "Ad Secundario",
        adsetName: "Adset Córdoba",
        campaignName: "Campaña Meta Leads Q1",
        status: "contacted",
        source: "meta_ads",
        cost: "18.75",
        leadDate: new Date(Date.now() - 86400000),
        createdAt: new Date(Date.now() - 86400000),
        updatedAt: new Date()
      }
    ];

    leads.forEach(lead => this.leads.set(lead.id, lead));
    this.currentLeadId = 3;

    // Estadísticas diarias de ejemplo
    const stats = [
      {
        id: 1,
        date: "2024-01-15",
        campaignId: 1,
        impressions: 15420,
        clicks: 387,
        leads: 12,
        spend: "245.80",
        ctr: "0.0251",
        cpl: "20.48",
        createdAt: new Date()
      },
      {
        id: 2,
        date: "2024-01-16",
        campaignId: 1,
        impressions: 18650,
        clicks: 445,
        leads: 15,
        spend: "289.50",
        ctr: "0.0239",
        cpl: "19.30",
        createdAt: new Date()
      }
    ];

    stats.forEach(stat => this.dailyStats.set(stat.id, stat));
    this.currentDailyStatsId = 3;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { 
      id,
      username: insertUser.username,
      password: insertUser.password,
      email: insertUser.email || null,
      role: insertUser.role || "user",
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  // Campaign operations
  async getCampaign(id: number): Promise<Campaign | undefined> {
    return this.campaigns.get(id);
  }

  async getAllCampaigns(): Promise<Campaign[]> {
    return Array.from(this.campaigns.values());
  }

  async createCampaign(insertCampaign: InsertCampaign): Promise<Campaign> {
    const id = this.currentCampaignId++;
    const campaign: Campaign = {
      id,
      name: insertCampaign.name,
      metaCampaignId: insertCampaign.metaCampaignId || null,
      status: insertCampaign.status || "active",
      budget: insertCampaign.budget || null,
      startDate: insertCampaign.startDate || null,
      endDate: insertCampaign.endDate || null,
      createdAt: new Date()
    };
    this.campaigns.set(id, campaign);
    return campaign;
  }

  async updateCampaign(id: number, updates: Partial<Campaign>): Promise<Campaign | undefined> {
    const campaign = this.campaigns.get(id);
    if (!campaign) return undefined;
    
    const updatedCampaign = { ...campaign, ...updates };
    this.campaigns.set(id, updatedCampaign);
    return updatedCampaign;
  }

  // Lead operations
  async getLead(id: number): Promise<Lead | undefined> {
    return this.leads.get(id);
  }

  async getLeads(filters?: { status?: string; campaignId?: number; limit?: number }): Promise<Lead[]> {
    let leads = Array.from(this.leads.values());
    
    if (filters?.status) {
      leads = leads.filter(lead => lead.status === filters.status);
    }
    
    if (filters?.campaignId) {
      leads = leads.filter(lead => lead.campaignId === filters.campaignId);
    }
    
    // Ordenar por fecha más reciente
    leads.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    
    if (filters?.limit) {
      leads = leads.slice(0, filters.limit);
    }
    
    return leads;
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const id = this.currentLeadId++;
    const lead: Lead = {
      id,
      metaLeadId: insertLead.metaLeadId || null,
      campaignId: insertLead.campaignId || null,
      firstName: insertLead.firstName || null,
      lastName: insertLead.lastName || null,
      email: insertLead.email || null,
      phone: insertLead.phone || null,
      age: insertLead.age || null,
      city: insertLead.city || null,
      interest: insertLead.interest || null,
      budget: insertLead.budget || null,
      adName: insertLead.adName || null,
      adsetName: insertLead.adsetName || null,
      campaignName: insertLead.campaignName || null,
      status: insertLead.status || "new",
      source: insertLead.source || "meta_ads",
      cost: insertLead.cost || null,
      leadDate: insertLead.leadDate || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.leads.set(id, lead);
    return lead;
  }

  async updateLead(id: number, updates: Partial<Lead>): Promise<Lead | undefined> {
    const lead = this.leads.get(id);
    if (!lead) return undefined;
    
    const updatedLead = { 
      ...lead, 
      ...updates,
      updatedAt: new Date()
    };
    this.leads.set(id, updatedLead);
    return updatedLead;
  }

  // Daily stats operations
  async getDailyStats(date?: string, campaignId?: number): Promise<DailyStats[]> {
    let stats = Array.from(this.dailyStats.values());
    
    if (date) {
      stats = stats.filter(stat => stat.date === date);
    }
    
    if (campaignId) {
      stats = stats.filter(stat => stat.campaignId === campaignId);
    }
    
    return stats.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  }

  async createDailyStats(insertStats: InsertDailyStats): Promise<DailyStats> {
    const id = this.currentDailyStatsId++;
    const stats: DailyStats = {
      id,
      date: insertStats.date,
      campaignId: insertStats.campaignId || null,
      impressions: insertStats.impressions || 0,
      clicks: insertStats.clicks || 0,
      leads: insertStats.leads || 0,
      spend: insertStats.spend || "0",
      ctr: insertStats.ctr || null,
      cpl: insertStats.cpl || null,
      createdAt: new Date()
    };
    this.dailyStats.set(id, stats);
    return stats;
  }

  // Lead notes operations
  async getLeadNotes(leadId: number): Promise<LeadNote[]> {
    return Array.from(this.leadNotes.values())
      .filter(note => note.leadId === leadId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async createLeadNote(insertNote: InsertLeadNote): Promise<LeadNote> {
    const id = this.currentLeadNoteId++;
    const note: LeadNote = {
      id,
      leadId: insertNote.leadId,
      userId: insertNote.userId,
      note: insertNote.note,
      type: insertNote.type || "general",
      createdAt: new Date()
    };
    this.leadNotes.set(id, note);
    return note;
  }

  // Dashboard analytics
  async getLeadsCount(timeframe?: string): Promise<number> {
    const leads = Array.from(this.leads.values());
    if (!timeframe) return leads.length;
    
    const now = new Date();
    const cutoff = new Date();
    
    switch (timeframe) {
      case 'today':
        cutoff.setHours(0, 0, 0, 0);
        break;
      case 'week':
        cutoff.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoff.setMonth(now.getMonth() - 1);
        break;
      default:
        return leads.length;
    }
    
    return leads.filter(lead => 
      lead.createdAt && lead.createdAt >= cutoff
    ).length;
  }

  async getTotalSpend(timeframe?: string): Promise<number> {
    const stats = Array.from(this.dailyStats.values());
    
    if (!timeframe) {
      return stats.reduce((total, stat) => total + parseFloat(stat.spend || "0"), 0);
    }
    
    const now = new Date();
    const cutoff = new Date();
    
    switch (timeframe) {
      case 'today':
        cutoff.setHours(0, 0, 0, 0);
        break;
      case 'week':
        cutoff.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoff.setMonth(now.getMonth() - 1);
        break;
    }
    
    return stats
      .filter(stat => stat.createdAt && stat.createdAt >= cutoff)
      .reduce((total, stat) => total + parseFloat(stat.spend || "0"), 0);
  }

  async getConversionRate(timeframe?: string): Promise<number> {
    const leads = await this.getLeadsCount(timeframe);
    const convertedLeads = Array.from(this.leads.values())
      .filter(lead => lead.status === 'converted').length;
    
    return leads > 0 ? (convertedLeads / leads) * 100 : 0;
  }

  async getCostPerLead(timeframe?: string): Promise<number> {
    const totalSpend = await this.getTotalSpend(timeframe);
    const leadsCount = await this.getLeadsCount(timeframe);
    
    return leadsCount > 0 ? totalSpend / leadsCount : 0;
  }
}

export const storage = new MemStorage();
