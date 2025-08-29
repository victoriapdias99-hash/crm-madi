import { RawSheetLead, SyncLead, ProcessedSyncLead } from '../entities/SyncLead';
import { nanoid } from 'nanoid';

/**
 * Servicio de dominio para procesamiento de leads
 * Contiene lógica de negocio pura sin dependencias externas
 */
export class LeadProcessor {
  
  /**
   * Convierte un lead raw de Google Sheets a SyncLead
   */
  convertRawToSyncLead(rawLead: RawSheetLead): SyncLead {
    const metaLeadId = this.generateMetaLeadId(rawLead);
    
    return {
      metaLeadId,
      nombre: this.sanitizeName(rawLead.name),
      telefono: this.sanitizePhone(rawLead.phone),
      email: this.sanitizeEmail(rawLead.email),
      ciudad: this.sanitizeCity(rawLead.city),
      marca: this.extractBrand(rawLead.campaign),
      origen: rawLead.origen || '',
      localizacion: rawLead.localizacion || '',
      cliente: rawLead.cliente || '',
      fechaCreacion: this.parseTimestamp(rawLead.timestamp),
      source: 'google_sheets',
      campaign: rawLead.campaign
    };
  }

  /**
   * Procesa y valida un SyncLead
   */
  processLead(syncLead: SyncLead): ProcessedSyncLead {
    const validationErrors: string[] = [];
    
    // Normalizar datos
    const normalizedPhone = this.normalizePhone(syncLead.telefono);
    const normalizedEmail = this.normalizeEmail(syncLead.email);
    const normalizedClient = this.normalizeClientName(syncLead.cliente);
    
    // Validaciones de negocio
    if (!this.isValidPhone(normalizedPhone)) {
      validationErrors.push('Teléfono inválido');
    }
    
    if (syncLead.email && !this.isValidEmail(normalizedEmail)) {
      validationErrors.push('Email inválido');
    }
    
    if (!syncLead.nombre?.trim()) {
      validationErrors.push('Nombre requerido');
    }
    
    const isValid = validationErrors.length === 0;
    
    return {
      ...syncLead,
      normalizedPhone,
      normalizedEmail,
      normalizedClient,
      isValid,
      validationErrors,
      isDuplicate: false // Se determinará en DuplicateDetector
    };
  }

  /**
   * Procesa múltiples leads en lote
   */
  processLeadsBatch(syncLeads: SyncLead[]): ProcessedSyncLead[] {
    return syncLeads.map(lead => this.processLead(lead));
  }

  // ========== MÉTODOS PRIVADOS DE PROCESAMIENTO ==========

  private generateMetaLeadId(rawLead: RawSheetLead): string {
    // Generar ID único garantizado con nanoid + timestamp
    const timestamp = Date.now();
    const uniqueId = nanoid(12); // 12 caracteres únicos
    const cliente = this.normalizeClientName(rawLead.cliente || '').substring(0, 10);
    const campaign = this.sanitizeCampaignName(rawLead.campaign).substring(0, 15);
    
    // Formato: SHEET_[timestamp]_[nanoid]_[cliente]_[campaign]
    return `SHEET_${timestamp}_${uniqueId}_${cliente}_${campaign}`;
  }

  private sanitizeName(name: string): string {
    return (name || '').trim().replace(/\s+/g, ' ');
  }

  private sanitizePhone(phone: string): string {
    return (phone || '').replace(/[^\d+]/g, '');
  }

  private sanitizeEmail(email: string): string {
    return (email || '').trim().toLowerCase();
  }

  private sanitizeCity(city: string): string {
    return (city || '').trim();
  }

  private sanitizeCampaignName(campaign: string): string {
    return (campaign || '').replace(/[^a-zA-Z0-9\s]/g, '').trim();
  }

  private extractBrand(campaign: string): string {
    const campaignLower = campaign.toLowerCase();
    const brands = ['toyota', 'vw', 'ford', 'citroen', 'chevrolet', 'renault', 'fiat', 'peugeot', 'jeep'];
    
    for (const brand of brands) {
      if (campaignLower.includes(brand)) {
        return brand.toUpperCase();
      }
    }
    
    return campaign.split(' ')[0].toUpperCase();
  }

  private parseTimestamp(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      return date.toISOString();
    } catch (error) {
      return new Date().toISOString();
    }
  }

  private normalizePhone(phone: string): string {
    // Remover caracteres no numéricos excepto +
    let normalized = phone.replace(/[^\d+]/g, '');
    
    // Si empieza con + mantenerlo, sino agregar código de país por defecto
    if (!normalized.startsWith('+')) {
      // Asumir Argentina si no hay código de país
      if (normalized.length === 10) {
        normalized = '+54' + normalized;
      }
    }
    
    return normalized;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeClientName(clientName: string): string {
    return clientName
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Remover caracteres especiales
      .replace(/\s+/g, '_'); // Reemplazar espacios con _
  }

  private isValidPhone(phone: string): boolean {
    // Validar formato de teléfono (mínimo 10 dígitos)
    const digitsOnly = phone.replace(/[^\d]/g, '');
    return digitsOnly.length >= 10;
  }

  private isValidEmail(email: string): boolean {
    if (!email) return true; // Email es opcional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}