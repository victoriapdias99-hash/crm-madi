/**
 * Sistema avanzado de matching de nombres de clientes para sincronización
 * Extrae la lógica desde routes.ts para mantener la funcionalidad existente
 */

export interface ClientMatchingRule {
  clienteNombre: string[];
  googleSheetsNames: string[];
  matchType: 'exact' | 'contains' | 'startsWith' | 'endsWith' | 'includes' | 'custom';
  customMatcher?: (clienteName: string, dataName: string) => boolean;
}

/**
 * Servicio de dominio para matching de clientes
 * Mantiene la lógica de negocio para asociar leads con clientes específicos
 */
export class ClientMatcher {
  private rules: ClientMatchingRule[] = [
    // ITALY AUTOS
    {
      clienteNombre: ['italy autos'],
      googleSheetsNames: ['chevrolet - italy'],
      matchType: 'exact'
    },
    // NOVO GROUP (buscar en datos de Fiat)
    {
      clienteNombre: ['novo group'],
      googleSheetsNames: ['fiat autos del sol', 'novo', 'pamela'],
      matchType: 'contains'
    },
    // RENAULT (múltiples variaciones)
    {
      clienteNombre: ['renault', 'renault - javier cagiao'],
      googleSheetsNames: ['renault'],
      matchType: 'exact'
    },
    // PEUGEOT ALBENS
    {
      clienteNombre: ['peugeot albens'],
      googleSheetsNames: ['peugeot albens', 'albens'],
      matchType: 'contains'
    },
    // GRUPO QUIJADA (incluyendo AVEC)
    {
      clienteNombre: ['grupo quijada', 'avec - grupo quijada'],
      googleSheetsNames: ['grupo quijada - peugeot', 'grupo quijada - citroen', 'avec - grupo quijada'],
      matchType: 'contains'
    },
    // Regla genérica para nombres similares
    {
      clienteNombre: ['*'],
      googleSheetsNames: ['*'],
      matchType: 'custom',
      customMatcher: (clienteName: string, dataName: string) => {
        // Extrae palabras clave principales
        const clienteWords = clienteName.split(/[-\s]+/).filter(word => word.length > 2);
        const dataWords = dataName.split(/[-\s]+/).filter(word => word.length > 2);
        
        // Busca coincidencia de al menos 2 palabras
        const matches = clienteWords.filter(word => 
          dataWords.some(dWord => dWord.includes(word) || word.includes(dWord))
        );
        
        return matches.length >= Math.min(2, clienteWords.length);
      }
    }
  ];

  /**
   * Determina si un nombre de cliente coincide con datos de Google Sheets
   */
  isMatch(clienteName: string, dataName: string): boolean {
    const clienteNameLower = clienteName.toLowerCase().trim();
    const dataNameLower = dataName.toLowerCase().trim();

    // Verificar reglas específicas primero
    for (const rule of this.rules) {
      if (rule.clienteNombre.includes('*')) continue; // Saltar regla genérica
      
      const matchesClientName = rule.clienteNombre.some(name => 
        name === clienteNameLower || clienteNameLower.includes(name)
      );
      
      if (!matchesClientName) continue;

      // Verificar si coincide con algún nombre en Google Sheets
      for (const sheetName of rule.googleSheetsNames) {
        let isRuleMatch = false;
        
        switch (rule.matchType) {
          case 'exact':
            isRuleMatch = dataNameLower === sheetName;
            break;
          case 'contains':
            isRuleMatch = dataNameLower.includes(sheetName) || sheetName.includes(dataNameLower);
            break;
          case 'startsWith':
            isRuleMatch = dataNameLower.startsWith(sheetName);
            break;
          case 'endsWith':
            isRuleMatch = dataNameLower.endsWith(sheetName);
            break;
          case 'includes':
            isRuleMatch = dataNameLower.includes(sheetName);
            break;
        }
        
        if (isRuleMatch) return true;
      }
    }

    // Aplicar regla genérica como último recurso
    const genericRule = this.rules.find(rule => rule.clienteNombre.includes('*'));
    if (genericRule && genericRule.customMatcher) {
      return genericRule.customMatcher(clienteNameLower, dataNameLower);
    }

    return false;
  }

  /**
   * Encuentra el mejor match para un nombre de cliente
   */
  findBestMatch(clienteName: string, candidateNames: string[]): string | null {
    const matches = candidateNames.filter(name => this.isMatch(clienteName, name));
    
    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];
    
    // Si hay múltiples matches, priorizar por tipo de regla
    return this.selectBestMatch(clienteName, matches);
  }

  /**
   * Obtiene estadísticas de matching para múltiples clientes
   */
  getMatchingStats(clienteNames: string[], dataNames: string[]): {
    totalMatches: number;
    unmatchedClientes: string[];
    matchDetails: Array<{
      cliente: string;
      matches: string[];
    }>;
  } {
    const matchDetails: Array<{ cliente: string; matches: string[] }> = [];
    const unmatchedClientes: string[] = [];
    let totalMatches = 0;

    for (const clienteName of clienteNames) {
      const matches = dataNames.filter(dataName => this.isMatch(clienteName, dataName));
      
      if (matches.length > 0) {
        matchDetails.push({
          cliente: clienteName,
          matches
        });
        totalMatches += matches.length;
      } else {
        unmatchedClientes.push(clienteName);
      }
    }

    return {
      totalMatches,
      unmatchedClientes,
      matchDetails
    };
  }

  /**
   * Agrega una nueva regla de matching
   */
  addRule(rule: ClientMatchingRule): void {
    // Insertar antes de la regla genérica
    const genericRuleIndex = this.rules.findIndex(r => r.clienteNombre.includes('*'));
    if (genericRuleIndex !== -1) {
      this.rules.splice(genericRuleIndex, 0, rule);
    } else {
      this.rules.push(rule);
    }
  }

  /**
   * Obtiene todas las reglas actuales
   */
  getRules(): ClientMatchingRule[] {
    return [...this.rules]; // Copia para evitar mutaciones externas
  }

  // ========== MÉTODOS PRIVADOS ==========

  private selectBestMatch(clienteName: string, matches: string[]): string {
    // Priorizar matches exactos
    const exactMatch = matches.find(match => 
      match.toLowerCase() === clienteName.toLowerCase()
    );
    if (exactMatch) return exactMatch;
    
    // Priorizar matches que contienen más palabras del cliente
    const clientWords = clienteName.toLowerCase().split(/[-\s]+/);
    
    const scored = matches.map(match => {
      const matchWords = match.toLowerCase().split(/[-\s]+/);
      const commonWords = clientWords.filter(word => 
        matchWords.some(mWord => mWord.includes(word) || word.includes(mWord))
      );
      
      return {
        match,
        score: commonWords.length
      };
    });
    
    // Ordenar por score descendente y devolver el mejor
    scored.sort((a, b) => b.score - a.score);
    return scored[0].match;
  }
}