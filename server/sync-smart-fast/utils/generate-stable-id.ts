/**
 * Genera un metaLeadId ESTABLE basado en teléfono + fecha + marca
 * Soporta duplicados reales mediante sufijo secuencial
 *
 * Formato Base: {MARCA}_{YYYYMMDD}_{TELEFONO_8DIGITOS}
 * Con duplicados: {MARCA}_{YYYYMMDD}_{TELEFONO_8DIGITOS}-{N}
 *
 * Ejemplos:
 *   Primer registro: "FIAT_20250718_54911234_5678"
 *   Duplicado 1:     "FIAT_20250718_54911234_5678-1"
 *   Duplicado 2:     "FIAT_20250718_54911234_5678-2"
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
  duplicateIndex: number = 0
): string {
  // Normalizar teléfono: solo dígitos
  const normalizedPhone = telefono.replace(/[^\d]/g, '');

  if (normalizedPhone.length < 4) {
    throw new Error(`Teléfono inválido para generar ID: "${telefono}"`);
  }

  // Formato fecha compacto: YYYYMMDD
  const year = fechaCreacion.getFullYear();
  const month = String(fechaCreacion.getMonth() + 1).padStart(2, '0');
  const day = String(fechaCreacion.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  // Extraer primeros y últimos 4 dígitos del teléfono
  const phonePrefix = normalizedPhone.slice(0, 4);
  const phoneSuffix = normalizedPhone.slice(-4);
  const phoneDigits = phonePrefix + phoneSuffix;

  // ID base estable
  const baseId = `${marca.toUpperCase()}_${dateStr}_${phoneDigits}`;

  // Agregar sufijo solo si es duplicado
  return duplicateIndex > 0 ? `${baseId}-${duplicateIndex}` : baseId;
}

/**
 * Extrae el ID base de un metaLeadId (sin sufijo de duplicado)
 *
 * Ejemplo: "FIAT_20250718_54911234_5678-2" → "FIAT_20250718_54911234_5678"
 */
export function getBaseMetaLeadId(metaLeadId: string): string {
  return metaLeadId.split('-')[0];
}

/**
 * Parsea una fecha de Google Sheets a objeto Date
 * Soporta múltiples formatos y normaliza a medianoche UTC
 */
export function parseSheetDate(dateStr: string): Date {
  if (!dateStr || dateStr.trim() === '') {
    console.warn('⚠️ Fecha vacía, usando fecha actual');
    return new Date();
  }

  const cleanDate = dateStr.trim();

  try {
    // 1. Formato ISO: 2025-01-04T14:30:00-03:00
    let date = new Date(cleanDate);
    if (!isNaN(date.getTime())) {
      // Normalizar a medianoche UTC para comparaciones consistentes
      date.setUTCHours(0, 0, 0, 0);
      return date;
    }

    // 2. Formato dd/mm/yyyy o dd-mm-yyyy
    const slashMatch = cleanDate.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (slashMatch) {
      const [, day, month, year] = slashMatch;
      date = new Date(Date.UTC(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day)
      ));

      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // 3. Formato dd-mm-yy hh:mm
    const shortMatch = cleanDate.match(/^(\d{2})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/);
    if (shortMatch) {
      const [, day, month, year, hour, minute] = shortMatch;
      const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);
      date = new Date(Date.UTC(
        fullYear,
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute)
      ));

      if (!isNaN(date.getTime())) {
        date.setUTCHours(0, 0, 0, 0); // Normalizar a medianoche
        return date;
      }
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
  return phone.replace(/[^\d]/g, '');
}
