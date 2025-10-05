import { nanoid } from 'nanoid';

/**
 * Genera un metaLeadId ESTABLE basado en teléfono + fecha + marca
 * Este ID permanece constante aunque la fila cambie de posición en Google Sheets
 *
 * Formato: {MARCA}_{YYYYMMDD}_{TEL_INICIO_4}{TEL_FIN_4}_{NANOID_6}
 * Ejemplo: "FIAT_20250104_12347890_a8B9cD"
 *
 * @param telefono - Teléfono del lead (puede tener formato, se normaliza)
 * @param fechaCreacion - Fecha de creación del lead
 * @param marca - Marca/campaña
 * @returns ID único y estable
 */
export function generateStableMetaLeadId(
  telefono: string,
  fechaCreacion: Date,
  marca: string
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

  // NanoID para garantizar unicidad (colisiones muy improbables)
  const uniqueId = nanoid(6);

  // Formato final: MARCA_FECHA_TELEFONO_NANO
  return `${marca.toUpperCase()}_${dateStr}_${phoneDigits}_${uniqueId}`;
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
