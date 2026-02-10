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
    console.warn("⚠️ Fecha vacía o inválida, usando fecha actual");
    return new Date();
  }

  const cleanDate = dateStr.trim();

  try {
    // ========================================
    // 1. FORMATO ISO 8601 (Make.com / Manychat)
    // ========================================
    // Detecta: 2026-02-04T10:26:51-03:00
    //          2026-02-04T10:26:51Z
    //          2026-02-04T10:26:51.000Z
    if (cleanDate.includes("T")) {
      const isoDate = new Date(cleanDate);
      if (!isNaN(isoDate.getTime())) {
        console.log(
          `✅ Fecha ISO parseada: ${cleanDate} → ${isoDate.toISOString()}`,
        );
        return isoDate;
      }
    }

    // ========================================
    // 2. FORMATO DD/MM/YYYY o DD-MM-YYYY
    // ========================================
    // Detecta: 04/02/2026, 4/2/2026, 04-02-2026
    const flexibleMatch = cleanDate.match(
      /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:.*)?$/,
    );

    if (flexibleMatch) {
      const [, day, month, yearStr] = flexibleMatch;
      let year = parseInt(yearStr);

      // Corrección de año de 2 dígitos (ej: "24" -> 2024)
      if (year < 100) {
        year += 2000;
      }

      // Crear fecha en UTC puro para evitar problemas de zona horaria
      const date = new Date(Date.UTC(year, parseInt(month) - 1, parseInt(day)));

      if (!isNaN(date.getTime())) {
        console.log(
          `✅ Fecha DD/MM/YYYY parseada: ${cleanDate} → ${date.toISOString()}`,
        );
        return date;
      }
    }

    // ========================================
    // 3. INTENTO DIRECTO (cualquier formato ISO)
    // ========================================
    const isoDate = new Date(cleanDate);
    if (!isNaN(isoDate.getTime())) {
      // Normalizar a medianoche UTC
      isoDate.setUTCHours(0, 0, 0, 0);
      console.log(
        `✅ Fecha ISO parseada (genérico): ${cleanDate} → ${isoDate.toISOString()}`,
      );
      return isoDate;
    }

    // ========================================
    // 4. FALLBACK: No se pudo parsear
    // ========================================
    console.warn(
      `⚠️ No se pudo parsear fecha: "${cleanDate}", usando fecha actual`,
    );
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
