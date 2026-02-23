/**
 * Utilidad centralizada para normalización de nombres de cliente
 *
 * Esta función unifica la lógica de normalización de nombres de cliente
 * para garantizar consistencia entre sincronización, conteo y todas las
 * operaciones que manejan nombres de cliente.
 *
 * @param clientName - Nombre del cliente a normalizar (cualquier tipo)
 * @returns Nombre normalizado como string
 */
export function normalizeClientName(clientName: any): string {
  // Convertir a string y manejar valores null/undefined con fallback
  const stringValue = String(clientName || 'S/D');

  // Lógica especial para formato "MARCA # #cliente" (usado en Campaign Closure)
  // Ejemplo: "TOYOTA # #Mariano Pichetti" → "mariano_pichetti"
  const parts = stringValue.split(' ');
  if (parts.length > 2 && parts[1] === '#' && parts[2] === '#') {
    return parts.slice(3).join('_').toLowerCase();
  }

  // Normalización estándar:
  // 1. Convertir a minúsculas
  // 2. Remover espacios al inicio y final
  // 3. Remover caracteres especiales (guiones, puntos, etc.)
  // 4. Reemplazar espacios múltiples con un solo underscore
  return stringValue
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remover caracteres especiales
    .replace(/\s+/g, '_');   // Espacios → underscores
}

export function snakeCaseToDisplayName(snakeName: string): string {
  if (!snakeName || snakeName === 's_d') return snakeName || '';
  return snakeName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function buildClientDisplayMap(clientNames: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const name of clientNames) {
    const normalized = normalizeClientName(name);
    map[normalized] = name;
  }
  return map;
}

export function getClientDisplayName(
  snakeName: string,
  displayMap: Record<string, string>
): string {
  if (!snakeName) return '';
  return displayMap[snakeName] || snakeCaseToDisplayName(snakeName);
}