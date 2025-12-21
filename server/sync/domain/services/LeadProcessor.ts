import {
  RawSheetLead,
  SyncLead,
  ProcessedSyncLead,
} from "../entities/SyncLead";
import { nanoid } from "nanoid";
import { normalizeClientName } from "../../../../shared/utils/client-normalization";

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

    // Conversión RAW a SyncLead completada

    return {
      metaLeadId,
      nombre: this.sanitizeName(rawLead.name),
      telefono: this.sanitizePhone(rawLead.phone || ""),
      email: this.sanitizeEmail(rawLead.email || ""),
      ciudad: this.sanitizeCity(rawLead.city || ""),
      modelo: rawLead.modelo || null,
      comentarioHorario: rawLead.comentarioHorario || null,
      marca: this.extractBrand(rawLead.campaign),
      origen: rawLead.origen || null,
      localizacion: rawLead.localizacion || null,
      cliente: rawLead.cliente || null,
      googleSheetsRowNumber: rawLead.googleSheetsRowNumber,
      fechaCreacion: this.parseTimestamp(rawLead.timestamp),
      source: "google_sheets",
      campaign: rawLead.campaign,
    };
  }

  /**
   * Procesa y valida un SyncLead
   */
  processLead(syncLead: SyncLead): ProcessedSyncLead {
    const validationErrors: string[] = [];

    // Inicio del procesamiento del lead

    // Normalizar datos
    const normalizedPhone = this.normalizePhone(syncLead.telefono);
    const normalizedEmail = this.normalizeEmail(syncLead.email);
    const normalizedClient = normalizeClientName(syncLead.cliente);

    // Normalizar nombre: usar 'S/D' si está vacío
    const normalizedName = syncLead.nombre?.trim() || "S/D";

    // Aceptar TODOS los leads sin validaciones de rechazo
    const isValid = true;

    return {
      ...syncLead,
      nombre: normalizedName,
      normalizedPhone,
      normalizedEmail,
      normalizedClient,
      isValid,
      validationErrors,
      isDuplicate: false, // Se determinará en DuplicateDetector
    };
  }

  /**
   * Procesa múltiples leads en lote
   */
  processLeadsBatch(syncLeads: SyncLead[]): ProcessedSyncLead[] {
    return syncLeads.map((lead) => this.processLead(lead));
  }

  // ========== MÉTODOS PRIVADOS DE PROCESAMIENTO ==========

  private generateMetaLeadId(rawLead: RawSheetLead): string {
    // Generar ID único garantizado con nanoid + timestamp
    const timestamp = Date.now();
    const uniqueId = nanoid(12); // 12 caracteres únicos
    const cliente = normalizeClientName(rawLead.cliente || "").substring(0, 10);
    const campaign = this.sanitizeCampaignName(rawLead.campaign).substring(
      0,
      15,
    );

    // Formato: SHEET_[timestamp]_[nanoid]_[cliente]_[campaign]
    return `SHEET_${timestamp}_${uniqueId}_${cliente}_${campaign}`;
  }

  private sanitizeName(name: string): string {
    const cleaned = (name || "").trim().replace(/\s+/g, " ");
    return cleaned || "S/D";
  }

  private sanitizePhone(phone: string): string {
    const cleaned = (phone || "").replace(/[^\d+]/g, "");
    return cleaned || "S/D";
  }

  private sanitizeEmail(email: string): string {
    const cleaned = (email || "").trim().toLowerCase();
    return cleaned || "S/D";
  }

  private sanitizeCity(city: string): string | null {
    const cleaned = (city || "").trim();
    return cleaned || null;
  }

  private sanitizeCampaignName(campaign: string): string {
    return (campaign || "").replace(/[^a-zA-Z0-9\s]/g, "").trim();
  }

  private extractBrand(campaign: string): string {
    const campaignLower = campaign.toLowerCase();
    const brands = [
      "toyota",
      "vw",
      "ford",
      "citroen",
      "chevrolet",
      "renault",
      "fiat",
      "peugeot",
      "jeep",
    ];

    for (const brand of brands) {
      if (campaignLower.includes(brand)) {
        return brand.toUpperCase();
      }
    }

    return campaign.split(" ")[0].toUpperCase();
  }

  /**
   * MÉTODO OPTIMIZADO: Parsea fechas ISO (con Timezone -03:00) y formatos latinos
   */
  private parseTimestamp(timestamp: string): string {
    // 1. Validaciones básicas de nulidad
    if (
      !timestamp ||
      typeof timestamp !== "string" ||
      timestamp.trim() === ""
    ) {
      console.warn(
        `⚠️ LeadProcessor: Timestamp vacío/nulo, usando fecha actual`,
      );
      return new Date().toISOString();
    }

    const cleanTimestamp = timestamp.trim();

    try {
      // 2. INTENTO DIRECTO (Prioritario para tu Excel)
      // Javascript entiende perfectamente "2025-12-17T17:06:00-03:00" de forma nativa
      const directDate = new Date(cleanTimestamp);

      // Verificamos que sea válida y que el año sea coherente (ej: mayor a 2000)
      if (!isNaN(directDate.getTime()) && directDate.getFullYear() > 2000) {
        return directDate.toISOString();
      }

      // 3. Formato Latino Completo (dd/mm/yyyy o dd-mm-yyyy) con hora opcional
      const latamMatch = cleanTimestamp.match(
        /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
      );

      if (latamMatch) {
        const [, day, month, yearStr, hour, min, sec] = latamMatch;
        let year = parseInt(yearStr);
        // Corrección de años cortos (ej: 24 -> 2024)
        if (year < 100) year += 2000;

        const date = new Date(
          year,
          parseInt(month) - 1, // Meses en JS son 0-11
          parseInt(day),
          parseInt(hour || "0"),
          parseInt(min || "0"),
          parseInt(sec || "0"),
        );

        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }

      // 4. Si todo falla, advertencia y fecha actual
      console.warn(
        `⚠️ LeadProcessor: Formato desconocido "${cleanTimestamp}", usando fecha actual`,
      );
      return new Date().toISOString();
    } catch (error) {
      console.error(`❌ Error parseando timestamp "${cleanTimestamp}":`, error);
      return new Date().toISOString();
    }
  }

  private normalizePhone(phone: string): string {
    // Remover caracteres no numéricos excepto +
    let normalized = phone.replace(/[^\d+]/g, "");

    // Si empieza con + mantenerlo, sino agregar código de país por defecto
    if (!normalized.startsWith("+")) {
      // Asumir Argentina si no hay código de país
      if (normalized.length === 10) {
        // Números de 10 dígitos: agregar +54
        normalized = "+54" + normalized;
      } else if (normalized.length === 13 && normalized.startsWith("549")) {
        // Números de 13 dígitos que empiecen con 549: ya incluyen código de Argentina
        normalized = "+" + normalized;
      } else if (normalized.length === 11 && normalized.startsWith("549")) {
        // Números de 11 dígitos que empiecen con 549: agregar + al inicio
        normalized = "+" + normalized;
      }
    }

    return normalized;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private isValidPhone(phone: string): boolean {
    const digitsOnly = phone.replace(/[^\d]/g, "");
    return digitsOnly.length >= 10;
  }

  private isValidEmail(email: string): boolean {
    if (!email) return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
