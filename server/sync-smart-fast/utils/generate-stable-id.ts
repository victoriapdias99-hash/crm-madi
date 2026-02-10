/**
 * Genera un metaLeadId ESTABLE basado en teléfono + fecha + marca
 * Soporta duplicados reales mediante sufijo secuencial
 *
 * Formato Base: {MARCA}_{YYYYMMDD}_{TELEFONO_8DIGITOS}
 * Con duplicados: {MARCA}_{YYYYMMDD}_{TELEFONO_8DIGITOS}-{N}
 *
 * Ejemplos:
 * Primer registro: "FIAT_20250718_54911234_5678"
 * Duplicado 1:     "FIAT_20250718_54911234_5678-1"
 *
 * @param telefono - Teléfono del lead (puede tener formato, se normaliza)
 * @param fechaCreacion - Fecha de creación del lead
 * @param marca - Marca/campaña
 * @param duplicateIndex - Índice de duplicado (0 = primero, 1 = segundo, etc.)
 * @returns ID estable (mismo para mismos datos)
 */
export function generateStableMetaLeadId(
  telefono: string,
  fechaCreacion: Date,
  marca: string,
  duplicateIndex: number = 0,
): string {
  // Normalizar teléfono: solo dígitos
  const normalizedPhone = telefono.replace(/[^\d]/g, "");

  if (normalizedPhone.length < 4) {
    // Si no hay suficiente teléfono, usamos un placeholder para no romper
    // (Aunque idealmente estos se filtran antes)
    return `INVALID_${marca}_${Date.now()}`;
  }

  // Formato fecha compacto: YYYYMMDD
  const year = fechaCreacion.getFullYear();
  const month = String(fechaCreacion.getMonth() + 1).padStart(2, "0");
  const day = String(fechaCreacion.getDate()).padStart(2, "0");
  const dateStr = `${year}${month}${day}`;

  // Extraer primeros y últimos 4 dígitos del teléfono para la huella
  // Si es corto, usamos lo que tenga
  const phonePrefix = normalizedPhone.slice(0, 4);
  const phoneSuffix = normalizedPhone.slice(-4);
  const phoneDigits =
    normalizedPhone.length > 8 ? phonePrefix + phoneSuffix : normalizedPhone;

  // ID base estable
  const baseId = `${marca.toUpperCase()}_${dateStr}_${phoneDigits}`;

  // Agregar sufijo solo si es duplicado
  return duplicateIndex > 0 ? `${baseId}-${duplicateIndex}` : baseId;
}

/**
 * Extrae el ID base de un metaLeadId (sin sufijo de duplicado)
 */
export function getBaseMetaLeadId(metaLeadId: string): string {
  return metaLeadId.split("-")[0];
}

/**
 * Parsea una fecha de Google Sheets a objeto Date
 * Soporta múltiples formatos:
 *   - ISO 8601: 2026-02-04T10:26:51-03:00
 *   - DD/MM/YYYY o DD-MM-YYYY (con o sin hora)
 *   - Número serial de Google Sheets (ej: 45678.5)
 *   - Formato genérico reconocible por Date()
 *
 * NUNCA usa new Date() como fallback para evitar asignar
 * la fecha de sincronización como fecha de creación.
 * Si no se puede parsear, devuelve null.
 */
export function parseSheetDate(dateStr: string | number | undefined | null): Date | null {
  if (dateStr === undefined || dateStr === null) {
    console.warn("⚠️ parseSheetDate: fecha vacía o undefined, retornando null");
    return null;
  }

  const raw = typeof dateStr === "number" ? dateStr : dateStr;

  if (typeof raw === "number" || (typeof raw === "string" && /^\d+([.,]\d+)?$/.test(raw.trim()))) {
    const normalized = typeof raw === "number" ? raw : raw.trim().replace(",", ".");
    const serialNum = typeof normalized === "number" ? normalized : parseFloat(normalized);
    if (serialNum > 1 && serialNum < 200000) {
      const GOOGLE_EPOCH = new Date(Date.UTC(1899, 11, 30));
      const wholeDays = Math.floor(serialNum);
      const fractionalDay = serialNum - wholeDays;
      const ms = GOOGLE_EPOCH.getTime() + (wholeDays * 86400000) + Math.round(fractionalDay * 86400000);
      const date = new Date(ms);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  if (typeof raw !== "string" || raw.trim() === "") {
    console.warn(`⚠️ parseSheetDate: valor no reconocido: "${raw}", retornando null`);
    return null;
  }

  const cleanDate = raw.trim();

  try {
    if (cleanDate.includes("T")) {
      const isoDate = new Date(cleanDate);
      if (!isNaN(isoDate.getTime())) {
        return isoDate;
      }
    }

    const flexibleMatch = cleanDate.match(
      /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?.*$/,
    );

    if (flexibleMatch) {
      const [, dayStr, monthStr, yearStr, hourStr, minStr, secStr] = flexibleMatch;
      let year = parseInt(yearStr);

      if (year < 100) {
        year += 2000;
      }

      const hour = hourStr ? parseInt(hourStr) : 0;
      const min = minStr ? parseInt(minStr) : 0;
      const sec = secStr ? parseInt(secStr) : 0;

      const date = new Date(Date.UTC(year, parseInt(monthStr) - 1, parseInt(dayStr), hour, min, sec));

      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    const genericDate = new Date(cleanDate);
    if (!isNaN(genericDate.getTime())) {
      genericDate.setUTCHours(0, 0, 0, 0);
      return genericDate;
    }

    console.warn(
      `⚠️ parseSheetDate: no se pudo parsear "${cleanDate}", retornando null`,
    );
    return null;
  } catch (error) {
    console.error(`❌ parseSheetDate: error con "${cleanDate}":`, error);
    return null;
  }
}

/**
 * Normaliza un teléfono removiendo caracteres no numéricos
 */
export function normalizePhone(phone: string): string {
  if (!phone) return "";
  return phone.replace(/[^\d]/g, "");
}
