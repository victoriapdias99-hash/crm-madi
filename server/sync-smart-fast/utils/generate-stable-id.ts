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
 * Soporta múltiples formatos y normaliza a medianoche UTC
 * * MEJORADO: Ahora soporta fechas con hora (dd/mm/yyyy hh:mm:ss)
 */
export function parseSheetDate(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== "string" || dateStr.trim() === "") {
    return new Date();
  }

  const cleanDate = dateStr.trim();

  try {
    // 1. ISO 8601 con timezone: 2026-01-15T15:59:00-03:00
    const isoWithTzMatch = cleanDate.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})([+-]\d{2}:\d{2}|Z)?$/
    );
    if (isoWithTzMatch) {
      const [, year, month, day] = isoWithTzMatch;
      const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // 2. ISO 8601 simple: 2026-01-15 o 2026-01-15T15:59:00
    const isoSimpleMatch = cleanDate.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/
    );
    if (isoSimpleMatch) {
      const [, year, month, day] = isoSimpleMatch;
      const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // 3. DD/MM/YYYY o DD-MM-YYYY (con hora opcional)
    const flexibleMatch = cleanDate.match(
      /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:.*)?$/
    );
    if (flexibleMatch) {
      const [, day, month, yearStr] = flexibleMatch;
      let year = parseInt(yearStr);
      if (year < 100) {
        year += 2000;
      }
      const date = new Date(Date.UTC(year, parseInt(month) - 1, parseInt(day)));
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // 4. Fallback: intento directo con Date constructor
    const isoDate = new Date(cleanDate);
    if (!isNaN(isoDate.getTime())) {
      isoDate.setUTCHours(0, 0, 0, 0);
      return isoDate;
    }

    console.warn(`⚠️ No se pudo parsear fecha: "${cleanDate}", usando fecha actual`);
    return new Date();
  } catch (error) {
    console.error(`❌ Error parseando fecha: "${cleanDate}":`, error);
    return new Date();
  }
}

/**
 * Normaliza un teléfono removiendo caracteres no numéricos
 */
export function normalizePhone(phone: string): string {
  if (!phone) return "";
  return phone.replace(/[^\d]/g, "");
}
