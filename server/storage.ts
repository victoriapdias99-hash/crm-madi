import { 
  users, campaigns, leads, dailyStats, leadNotes, clientes, campanasComerciales, dashboardManualValues,
  type User, type InsertUser,
  type Campaign, type InsertCampaign,
  type Lead, type InsertLead,
  type DailyStats, type InsertDailyStats,
  type LeadNote, type InsertLeadNote,
  type Cliente, type InsertCliente,
  type CampanaComercial, type InsertCampanaComercial
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

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

  // CPL and manual values storage
  updateCpl(clienteIndex: number, cpl: number): Promise<void>;
  getCpl(clienteIndex: number): Promise<number>;
  updateCplByClienteAndCampana(clienteNombre: string, numeroCampana: string, cpl: number): Promise<void>;
  getCplByClienteAndCampana(clienteNombre: string, numeroCampana: string): Promise<number>;
  updateVentaPorCampana(clienteIndex: number, venta: number): Promise<void>;
  getVentaPorCampana(clienteIndex: number): Promise<number>;
  getVentaPorCampanaByClienteAndCampana(clienteNombre: string, numeroCampana: string): Promise<number>;
  updatePedidosPorDia(clienteIndex: number, pedidos: number): Promise<void>;
  getPedidosPorDia(clienteIndex: number): Promise<number>;
  getPedidosPorDiaByClienteAndCampana(clienteNombre: string, numeroCampana: string): Promise<number>;

  // Cliente operations
  getCliente(id: number): Promise<Cliente | undefined>;
  getAllClientes(): Promise<Cliente[]>;
  createCliente(cliente: InsertCliente): Promise<Cliente>;
  updateCliente(id: number, updates: Partial<Cliente>): Promise<Cliente | undefined>;
  deleteCliente(id: number): Promise<boolean>;

  // Campaña comercial operations
  getCampanaComercial(id: number): Promise<CampanaComercial | undefined>;
  getAllCampanasComerciales(): Promise<CampanaComercial[]>;
  getCampanasPorCliente(clienteId: number): Promise<CampanaComercial[]>;
  createCampanaComercial(campana: InsertCampanaComercial): Promise<CampanaComercial>;
  updateCampanaComercial(id: number, updates: Partial<CampanaComercial>): Promise<CampanaComercial | undefined>;
  deleteCampanaComercial(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private campaigns: Map<number, Campaign>;
  private leads: Map<number, Lead>;
  private dailyStats: Map<number, DailyStats>;
  private leadNotes: Map<number, LeadNote>;
  private clientes: Map<number, Cliente>;
  private campanasComerciales: Map<number, CampanaComercial>;
  
  // Storage for manual values
  private cplValues: Map<number, number>;
  private cplValuesByClienteCampana: Map<string, number>;
  private ventaPorCampanaValues: Map<number, number>;
  private ventaValuesByClienteCampana: Map<string, number>;
  private pedidosPorDiaValues: Map<number, number>;
  private pedidosValuesByClienteCampana: Map<string, number>;
  
  private currentUserId: number;
  private currentCampaignId: number;
  private currentLeadId: number;
  private currentDailyStatsId: number;
  private currentLeadNoteId: number;
  private currentClienteId: number;
  private currentCampanaComercialId: number;

  constructor() {
    this.users = new Map();
    this.campaigns = new Map();
    this.leads = new Map();
    this.dailyStats = new Map();
    this.leadNotes = new Map();
    this.clientes = new Map();
    this.campanasComerciales = new Map();
    
    // Initialize manual values storage
    this.cplValues = new Map();
    this.cplValuesByClienteCampana = new Map();
    this.ventaPorCampanaValues = new Map();
    this.ventaValuesByClienteCampana = new Map();
    this.pedidosPorDiaValues = new Map();
    this.pedidosValuesByClienteCampana = new Map();
    
    this.currentUserId = 1;
    this.currentCampaignId = 1;
    this.currentLeadId = 1;
    this.currentDailyStatsId = 1;
    this.currentLeadNoteId = 1;
    this.currentClienteId = 1;
    this.currentCampanaComercialId = 1;

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

    // Clientes de ejemplo con nuevos campos
    const clientes = [
      {
        id: 1,
        nombreCliente: "NOVO GROUP - FIAT",
        nombreComercial: "Novo Automotores", 
        telefono: "+54 11 4444-5555",
        email: "contacto@novo.com",
        fechaAlta: new Date("2024-01-15"),
        cuitCliente: "20-34567890-1",
        tipoFacturacion: "A",
        marcasSolicitadas: ["Fiat", "VW"],
        zonas: ["AMBA", "NACIONAL"],
        provinciaBuenosAires: "La Plata",
        zonasExcluyentes: "Villa Carlos Paz, Córdoba Capital",
        exclusionesGeograficas: [
          { id: "1", name: "Villa Carlos Paz", type: "city" },
          { id: "2", name: "Córdoba Capital", type: "city" }
        ],
        integracion: "Pilot",
        tipoCliente: "AGENCIA",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 2,
        nombreCliente: "AUTO PREMIUM MERCEDES",
        nombreComercial: "Premium Motors",
        telefono: "+54 11 5555-6666",
        email: "ventas@premium.com",
        fechaAlta: new Date("2024-02-10"),
        cuitCliente: "30-45678901-2",
        tipoFacturacion: "C",
        marcasSolicitadas: ["Mercedes", "Ford", "Jeep"],
        zonas: ["AMBA"],
        provinciaBuenosAires: "San Isidro",
        zonasExcluyentes: "Radio 100km de Mendoza",
        exclusionesGeograficas: [
          { id: "3", name: "Radio 100km de Mendoza", type: "radius" }
        ],
        integracion: "Tecnom",
        tipoCliente: "COMERCIALIZADORA",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        nombreCliente: "GRUPO TOYOTA CHINA",
        nombreComercial: "Toyota China Motors",
        telefono: "+54 11 7777-8888",
        email: "info@toyotachina.com",
        fechaAlta: new Date("2024-03-05"),
        cuitCliente: "27-56789012-3",
        tipoFacturacion: "A",
        marcasSolicitadas: ["Toyota", "China", "Otra"],
        zonas: ["LOCALIZADO"],
        provinciaBuenosAires: "Quilmes",
        zonasExcluyentes: "",
        exclusionesGeograficas: [],
        integracion: "Asofix",
        tipoCliente: "GRUPO COMERCIAL",
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    clientes.forEach(cliente => this.clientes.set(cliente.id, cliente));
    this.currentClienteId = 4;
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

  // Cliente operations
  async getCliente(id: number): Promise<Cliente | undefined> {
    return this.clientes.get(id);
  }

  async getAllClientes(): Promise<Cliente[]> {
    return Array.from(this.clientes.values()).sort((a, b) => a.nombreCliente.localeCompare(b.nombreCliente));
  }

  async createCliente(insertCliente: InsertCliente): Promise<Cliente> {
    const id = this.currentClienteId++;
    const cliente: Cliente = {
      id,
      nombreCliente: insertCliente.nombreCliente,
      nombreComercial: insertCliente.nombreComercial,
      telefono: insertCliente.telefono || null,
      email: insertCliente.email || null,
      fechaAlta: new Date(),
      cuitCliente: insertCliente.cuitCliente || null,
      tipoFacturacion: insertCliente.tipoFacturacion,
      marcasSolicitadas: insertCliente.marcasSolicitadas || [],
      zonas: insertCliente.zonas || [],
      zonasExcluyentes: insertCliente.zonasExcluyentes || null,
      provinciaBuenosAires: insertCliente.provinciaBuenosAires || null,
      exclusionesGeograficas: insertCliente.exclusionesGeograficas || null,
      integracion: insertCliente.integracion || null,
      tipoCliente: insertCliente.tipoCliente || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.clientes.set(id, cliente);
    return cliente;
  }

  async updateCliente(id: number, updates: Partial<Cliente>): Promise<Cliente | undefined> {
    const cliente = this.clientes.get(id);
    if (!cliente) return undefined;
    
    const updatedCliente = { 
      ...cliente, 
      ...updates,
      updatedAt: new Date()
    };
    this.clientes.set(id, updatedCliente);
    return updatedCliente;
  }

  async deleteCliente(id: number): Promise<boolean> {
    return this.clientes.delete(id);
  }

  // CPL and manual values operations
  async updateCpl(clienteIndex: number, cpl: number): Promise<void> {
    this.cplValues.set(clienteIndex, cpl);
    console.log(`CPL updated for client ${clienteIndex}: ${cpl}`);
  }

  async getCpl(clienteIndex: number): Promise<number> {
    return this.cplValues.get(clienteIndex) || 0;
  }

  async updateCplByClienteAndCampana(clienteNombre: string, numeroCampana: string, cpl: number): Promise<void> {
    // Crear una clave única basada en cliente y número de campaña
    const uniqueKey = `${clienteNombre}-${numeroCampana}`;
    
    // Usar un mapa específico para claves de cliente-campaña
    if (!this.cplValuesByClienteCampana) {
      this.cplValuesByClienteCampana = new Map();
    }
    
    this.cplValuesByClienteCampana.set(uniqueKey, cpl);
    console.log(`CPL updated for client ${clienteNombre} campaign ${numeroCampana}: ${cpl}`);
  }

  async getCplByClienteAndCampana(clienteNombre: string, numeroCampana: string): Promise<number> {
    if (!this.cplValuesByClienteCampana) {
      this.cplValuesByClienteCampana = new Map();
    }
    
    const uniqueKey = `${clienteNombre}-${numeroCampana}`;
    return this.cplValuesByClienteCampana.get(uniqueKey) || 0;
  }

  async getVentaPorCampanaByClienteAndCampana(clienteNombre: string, numeroCampana: string): Promise<number> {
    if (!this.ventaValuesByClienteCampana) {
      this.ventaValuesByClienteCampana = new Map();
    }
    
    const uniqueKey = `${clienteNombre}-${numeroCampana}`;
    return this.ventaValuesByClienteCampana.get(uniqueKey) || 0;
  }

  async getPedidosPorDiaByClienteAndCampana(clienteNombre: string, numeroCampana: string): Promise<number> {
    if (!this.pedidosValuesByClienteCampana) {
      this.pedidosValuesByClienteCampana = new Map();
    }
    
    const uniqueKey = `${clienteNombre}-${numeroCampana}`;
    return this.pedidosValuesByClienteCampana.get(uniqueKey) || 0;
  }



  async updateVentaPorCampana(clienteIndex: number, venta: number): Promise<void> {
    this.ventaPorCampanaValues.set(clienteIndex, venta);
    console.log(`Venta por campaña updated for client ${clienteIndex}: ${venta}`);
  }

  async getVentaPorCampana(clienteIndex: number): Promise<number> {
    return this.ventaPorCampanaValues.get(clienteIndex) || 0;
  }

  async updatePedidosPorDia(clienteIndex: number, pedidos: number): Promise<void> {
    this.pedidosPorDiaValues.set(clienteIndex, pedidos);
    console.log(`Pedidos por día updated for client ${clienteIndex}: ${pedidos}`);
  }

  async getPedidosPorDia(clienteIndex: number): Promise<number> {
    return this.pedidosPorDiaValues.get(clienteIndex) || 0;
  }

  // Campaña comercial operations
  async getCampanaComercial(id: number): Promise<CampanaComercial | undefined> {
    return this.campanasComerciales.get(id);
  }

  async getAllCampanasComerciales(): Promise<CampanaComercial[]> {
    return Array.from(this.campanasComerciales.values()).sort((a, b) => 
      (b.fechaCreacion?.getTime() || 0) - (a.fechaCreacion?.getTime() || 0)
    );
  }

  async getCampanasPorCliente(clienteId: number): Promise<CampanaComercial[]> {
    return Array.from(this.campanasComerciales.values())
      .filter(campana => campana.clienteId === clienteId)
      .sort((a, b) => (b.fechaCreacion?.getTime() || 0) - (a.fechaCreacion?.getTime() || 0));
  }

  async createCampanaComercial(insertCampana: InsertCampanaComercial): Promise<CampanaComercial> {
    const id = this.currentCampanaComercialId++;
    const campana: CampanaComercial = {
      id,
      clienteId: insertCampana.clienteId,
      numeroCampana: insertCampana.numeroCampana,
      cantidadDatosSolicitados: insertCampana.cantidadDatosSolicitados,
      marca: insertCampana.marca,
      zona: insertCampana.zona,
      fechaCreacion: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.campanasComerciales.set(id, campana);
    return campana;
  }

  async updateCampanaComercial(id: number, updates: Partial<CampanaComercial>): Promise<CampanaComercial | undefined> {
    const campana = this.campanasComerciales.get(id);
    if (!campana) return undefined;
    
    const updatedCampana = { 
      ...campana, 
      ...updates,
      updatedAt: new Date()
    };
    this.campanasComerciales.set(id, updatedCampana);
    return updatedCampana;
  }

  async deleteCampanaComercial(id: number): Promise<boolean> {
    return this.campanasComerciales.delete(id);
  }
}

// DatabaseStorage implementation
export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Campaign operations
  async getCampaign(id: number): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return campaign || undefined;
  }

  async getAllCampaigns(): Promise<Campaign[]> {
    return await db.select().from(campaigns);
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const [newCampaign] = await db
      .insert(campaigns)
      .values(campaign)
      .returning();
    return newCampaign;
  }

  async updateCampaign(id: number, updates: Partial<Campaign>): Promise<Campaign | undefined> {
    const [updated] = await db
      .update(campaigns)
      .set(updates)
      .where(eq(campaigns.id, id))
      .returning();
    return updated || undefined;
  }

  // Lead operations
  async getLead(id: number): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead || undefined;
  }

  async getLeads(filters?: { status?: string; campaignId?: number; limit?: number }): Promise<Lead[]> {
    let query = db.select().from(leads);
    
    if (filters?.status) {
      query = query.where(eq(leads.status, filters.status)) as any;
    }
    if (filters?.campaignId) {
      query = query.where(eq(leads.campaignId, filters.campaignId)) as any;
    }
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    
    return await query;
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const [newLead] = await db
      .insert(leads)
      .values(lead)
      .returning();
    return newLead;
  }

  async updateLead(id: number, updates: Partial<Lead>): Promise<Lead | undefined> {
    const [updated] = await db
      .update(leads)
      .set(updates)
      .where(eq(leads.id, id))
      .returning();
    return updated || undefined;
  }

  // Daily stats operations
  async getDailyStats(date?: string, campaignId?: number): Promise<DailyStats[]> {
    let query = db.select().from(dailyStats);
    
    if (date) {
      query = query.where(eq(dailyStats.date, date)) as any;
    }
    if (campaignId) {
      query = query.where(eq(dailyStats.campaignId, campaignId)) as any;
    }
    
    return await query;
  }

  async createDailyStats(stats: InsertDailyStats): Promise<DailyStats> {
    const [newStats] = await db
      .insert(dailyStats)
      .values(stats)
      .returning();
    return newStats;
  }

  // Lead notes operations
  async getLeadNotes(leadId: number): Promise<LeadNote[]> {
    return await db.select().from(leadNotes).where(eq(leadNotes.leadId, leadId));
  }

  async createLeadNote(note: InsertLeadNote): Promise<LeadNote> {
    const [newNote] = await db
      .insert(leadNotes)
      .values(note)
      .returning();
    return newNote;
  }

  // Dashboard analytics - simplified implementations for database
  async getLeadsCount(timeframe?: string): Promise<number> {
    const result = await db.select().from(leads);
    return result.length;
  }

  async getTotalSpend(timeframe?: string): Promise<number> {
    const result = await db.select().from(dailyStats);
    return result.reduce((total, stat) => total + parseFloat(stat.spend || "0"), 0);
  }

  async getConversionRate(timeframe?: string): Promise<number> {
    const totalLeads = await this.getLeadsCount();
    const convertedLeads = await db.select().from(leads).where(eq(leads.status, "converted"));
    return totalLeads > 0 ? (convertedLeads.length / totalLeads) * 100 : 0;
  }

  async getCostPerLead(timeframe?: string): Promise<number> {
    const totalSpend = await this.getTotalSpend();
    const totalLeads = await this.getLeadsCount();
    return totalLeads > 0 ? totalSpend / totalLeads : 0;
  }

  // CPL and manual values storage - usando tabla dashboardManualValues
  async updateCpl(clienteIndex: number, cpl: number): Promise<void> {
    try {
      // Primero verificar si existe un registro para este clienteIndex
      const [existing] = await db.select().from(dashboardManualValues).where(eq(dashboardManualValues.clienteIndex, clienteIndex));
      
      if (existing) {
        // Actualizar registro existente
        await db
          .update(dashboardManualValues)
          .set({ cpl: cpl.toString(), updatedAt: new Date() })
          .where(eq(dashboardManualValues.clienteIndex, clienteIndex));
      } else {
        // Crear nuevo registro
        await db
          .insert(dashboardManualValues)
          .values({ 
            clienteIndex, 
            cpl: cpl.toString(),
            ventaPorCampana: "0",
            pedidosPorDia: 0
          });
      }
      console.log(`CPL updated in database for client ${clienteIndex}: ${cpl}`);
    } catch (error) {
      console.error('Error updating CPL in database:', error);
      throw error;
    }
  }

  async getCpl(clienteIndex: number): Promise<number> {
    try {
      const [record] = await db.select().from(dashboardManualValues).where(eq(dashboardManualValues.clienteIndex, clienteIndex));
      return record ? parseFloat(record.cpl || "0") : 0;
    } catch (error) {
      console.error('Error getting CPL from database:', error);
      return 0;
    }
  }

  async updateVentaPorCampana(clienteIndex: number, venta: number): Promise<void> {
    try {
      const [existing] = await db.select().from(dashboardManualValues).where(eq(dashboardManualValues.clienteIndex, clienteIndex));
      
      if (existing) {
        await db
          .update(dashboardManualValues)
          .set({ ventaPorCampana: venta.toString(), updatedAt: new Date() })
          .where(eq(dashboardManualValues.clienteIndex, clienteIndex));
      } else {
        await db
          .insert(dashboardManualValues)
          .values({ 
            clienteIndex, 
            cpl: "0",
            ventaPorCampana: venta.toString(),
            pedidosPorDia: 0
          });
      }
      console.log(`Venta por campaña updated in database for client ${clienteIndex}: ${venta}`);
    } catch (error) {
      console.error('Error updating venta por campaña in database:', error);
      throw error;
    }
  }

  async getVentaPorCampana(clienteIndex: number): Promise<number> {
    try {
      const [record] = await db.select().from(dashboardManualValues).where(eq(dashboardManualValues.clienteIndex, clienteIndex));
      return record ? parseFloat(record.ventaPorCampana || "0") : 0;
    } catch (error) {
      console.error('Error getting venta por campaña from database:', error);
      return 0;
    }
  }

  async updatePedidosPorDia(clienteIndex: number, pedidos: number): Promise<void> {
    try {
      const [existing] = await db.select().from(dashboardManualValues).where(eq(dashboardManualValues.clienteIndex, clienteIndex));
      
      if (existing) {
        await db
          .update(dashboardManualValues)
          .set({ pedidosPorDia: pedidos, updatedAt: new Date() })
          .where(eq(dashboardManualValues.clienteIndex, clienteIndex));
      } else {
        await db
          .insert(dashboardManualValues)
          .values({ 
            clienteIndex, 
            cpl: "0",
            ventaPorCampana: "0",
            pedidosPorDia: pedidos
          });
      }
      console.log(`Pedidos por día updated in database for client ${clienteIndex}: ${pedidos}`);
    } catch (error) {
      console.error('Error updating pedidos por día in database:', error);
      throw error;
    }
  }

  async getPedidosPorDia(clienteIndex: number): Promise<number> {
    try {
      const [record] = await db.select().from(dashboardManualValues).where(eq(dashboardManualValues.clienteIndex, clienteIndex));
      return record ? (record.pedidosPorDia || 0) : 0;
    } catch (error) {
      console.error('Error getting pedidos por día from database:', error);
      return 0;
    }
  }

  // Cliente operations
  async getCliente(id: number): Promise<Cliente | undefined> {
    const [cliente] = await db.select().from(clientes).where(eq(clientes.id, id));
    return cliente || undefined;
  }

  async getAllClientes(): Promise<Cliente[]> {
    return await db.select().from(clientes);
  }

  async createCliente(cliente: InsertCliente): Promise<Cliente> {
    const [newCliente] = await db
      .insert(clientes)
      .values(cliente)
      .returning();
    return newCliente;
  }

  async updateCliente(id: number, updates: Partial<Cliente>): Promise<Cliente | undefined> {
    const [updated] = await db
      .update(clientes)
      .set(updates)
      .where(eq(clientes.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCliente(id: number): Promise<boolean> {
    const result = await db.delete(clientes).where(eq(clientes.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Campaña comercial operations
  async getCampanaComercial(id: number): Promise<CampanaComercial | undefined> {
    const [campana] = await db.select().from(campanasComerciales).where(eq(campanasComerciales.id, id));
    return campana || undefined;
  }

  async getAllCampanasComerciales(): Promise<CampanaComercial[]> {
    return await db.select().from(campanasComerciales);
  }

  async getCampanasPorCliente(clienteId: number): Promise<CampanaComercial[]> {
    return await db.select().from(campanasComerciales).where(eq(campanasComerciales.clienteId, clienteId));
  }

  async createCampanaComercial(campana: InsertCampanaComercial): Promise<CampanaComercial> {
    const [newCampana] = await db
      .insert(campanasComerciales)
      .values(campana)
      .returning();
    return newCampana;
  }

  async updateCampanaComercial(id: number, updates: Partial<CampanaComercial>): Promise<CampanaComercial | undefined> {
    const [updated] = await db
      .update(campanasComerciales)
      .set(updates)
      .where(eq(campanasComerciales.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCampanaComercial(id: number): Promise<boolean> {
    const result = await db.delete(campanasComerciales).where(eq(campanasComerciales.id, id));
    return (result.rowCount || 0) > 0;
  }

  // CPL operations for DatabaseStorage
  async updateCpl(clienteIndex: number, cpl: number): Promise<void> {
    // Store in dashboard_manual_values table
    await db.insert(dashboardManualValues).values({
      clienteIndex,
      cpl,
      createdAt: new Date(),
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: dashboardManualValues.clienteIndex,
      set: {
        cpl,
        updatedAt: new Date()
      }
    });
    console.log(`CPL updated in database for client ${clienteIndex}: ${cpl}`);
  }

  async getCpl(clienteIndex: number): Promise<number> {
    const [result] = await db
      .select({ cpl: dashboardManualValues.cpl })
      .from(dashboardManualValues)
      .where(eq(dashboardManualValues.clienteIndex, clienteIndex));
    return result?.cpl || 0;
  }

  async updateCplByClienteAndCampana(clienteNombre: string, numeroCampana: string, cpl: number): Promise<void> {
    // Create a unique key for this combination
    const uniqueKey = `${clienteNombre}-${numeroCampana}`;
    
    // Store in dashboard_manual_values table using the unique key as identifier
    await db.insert(dashboardManualValues).values({
      clienteIndex: this.hashString(uniqueKey),
      cpl,
      clienteNombre,
      numeroCampana,
      createdAt: new Date(),
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: dashboardManualValues.clienteIndex,
      set: {
        cpl,
        clienteNombre,
        numeroCampana,
        updatedAt: new Date()
      }
    });
    
    console.log(`CPL updated in database for client ${clienteNombre} campaign ${numeroCampana}: ${cpl}`);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  async updateVentaPorCampana(clienteIndex: number, venta: number): Promise<void> {
    await db.insert(dashboardManualValues).values({
      clienteIndex,
      ventaPorCampana: venta,
      createdAt: new Date(),
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: dashboardManualValues.clienteIndex,
      set: {
        ventaPorCampana: venta,
        updatedAt: new Date()
      }
    });
    console.log(`Venta por campaña updated in database for client ${clienteIndex}: ${venta}`);
  }

  async getVentaPorCampana(clienteIndex: number): Promise<number> {
    const [result] = await db
      .select({ ventaPorCampana: dashboardManualValues.ventaPorCampana })
      .from(dashboardManualValues)
      .where(eq(dashboardManualValues.clienteIndex, clienteIndex));
    return result?.ventaPorCampana || 0;
  }

  async updatePedidosPorDia(clienteIndex: number, pedidos: number): Promise<void> {
    await db.insert(dashboardManualValues).values({
      clienteIndex,
      pedidosPorDia: pedidos,
      createdAt: new Date(),
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: dashboardManualValues.clienteIndex,
      set: {
        pedidosPorDia: pedidos,
        updatedAt: new Date()
      }
    });
    console.log(`Pedidos por día updated in database for client ${clienteIndex}: ${pedidos}`);
  }

  async getPedidosPorDia(clienteIndex: number): Promise<number> {
    const [result] = await db
      .select({ pedidosPorDia: dashboardManualValues.pedidosPorDia })
      .from(dashboardManualValues)
      .where(eq(dashboardManualValues.clienteIndex, clienteIndex));
    return result?.pedidosPorDia || 0;
  }

  async getCplByClienteAndCampana(clienteNombre: string, numeroCampana: string): Promise<number> {
    const uniqueKey = `${clienteNombre}-${numeroCampana}`;
    const [result] = await db
      .select({ cpl: dashboardManualValues.cpl })
      .from(dashboardManualValues)
      .where(eq(dashboardManualValues.clienteIndex, this.hashString(uniqueKey)));
    return result?.cpl || 0;
  }

  async getVentaPorCampanaByClienteAndCampana(clienteNombre: string, numeroCampana: string): Promise<number> {
    const uniqueKey = `${clienteNombre}-${numeroCampana}`;
    const [result] = await db
      .select({ ventaPorCampana: dashboardManualValues.ventaPorCampana })
      .from(dashboardManualValues)
      .where(eq(dashboardManualValues.clienteIndex, this.hashString(uniqueKey)));
    return result?.ventaPorCampana || 0;
  }

  async getPedidosPorDiaByClienteAndCampana(clienteNombre: string, numeroCampana: string): Promise<number> {
    const uniqueKey = `${clienteNombre}-${numeroCampana}`;
    const [result] = await db
      .select({ pedidosPorDia: dashboardManualValues.pedidosPorDia })
      .from(dashboardManualValues)
      .where(eq(dashboardManualValues.clienteIndex, this.hashString(uniqueKey)));
    return result?.pedidosPorDia || 0;
  }

  // Matching de campañas con datos de Google Sheets
  async getCampanasConMatching(): Promise<any[]> {
    // Obtener todas las campañas con información del cliente
    const campanas = await db
      .select({
        id: campanasComerciales.id,
        numeroCampana: campanasComerciales.numeroCampana,
        clienteId: campanasComerciales.clienteId,
        marca: campanasComerciales.marca,
        zona: campanasComerciales.zona,
        cantidadDatosSolicitados: campanasComerciales.cantidadDatosSolicitados,
        fechaCampana: campanasComerciales.fechaCampana,
        fechaFin: campanasComerciales.fechaFin,
        nombreCliente: clientes.nombreCliente,
        nombreComercial: clientes.nombreComercial,
      })
      .from(campanasComerciales)
      .leftJoin(clientes, eq(campanasComerciales.clienteId, clientes.id));

    return campanas;
  }

  // Obtener datos diarios con matching de campaña
  async getDatosDiariosConMatching(): Promise<any[]> {
    // Obtener datos de Google Sheets
    const datosDiarios = await this.getDashboardCampaigns();
    
    // Obtener todas las campañas para matching
    const campanasMatching = await this.getCampanasConMatching();
    
    // Agregar información de matching a cada registro
    const datosConMatching = datosDiarios.map(dato => {
      // Buscar campaña que coincida por marca, cliente y fechas
      const campanaMatched = campanasMatching.find(campana => {
        // Normalizar nombres para comparación
        const clienteNormalizado = dato.cliente.toLowerCase().replace(/\s+/g, '').replace('-', '');
        const campanaClienteNormalizado = campana.nombreCliente.toLowerCase().replace(/\s+/g, '').replace('-', '');
        
        // Verificar si coincide marca y cliente
        const marcaCoincide = campana.marca.toLowerCase() === dato.cliente.split(' - ')[1]?.toLowerCase();
        const clienteCoincide = clienteNormalizado.includes(campanaClienteNormalizado) || 
                               campanaClienteNormalizado.includes(clienteNormalizado);
        
        return marcaCoincide && clienteCoincide;
      });

      return {
        ...dato,
        campanaMatched: campanaMatched || null,
        hasMatch: !!campanaMatched
      };
    });

    return datosConMatching;
  }
}

// Switch to database storage for persistent data
export const storage = new DatabaseStorage();
