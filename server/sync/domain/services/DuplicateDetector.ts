import { ProcessedSyncLead, SyncLead } from '../entities/SyncLead';

/**
 * Servicio de dominio para detección de duplicados
 * Contiene la lógica de negocio para identificar leads duplicados
 */
export class DuplicateDetector {
  
  /**
   * Detecta duplicados en un lote de leads procesados
   */
  detectDuplicatesInBatch(leads: ProcessedSyncLead[]): ProcessedSyncLead[] {
    const phoneMap = new Map<string, ProcessedSyncLead>();
    const metaIdMap = new Map<string, ProcessedSyncLead>();
    const rowNumberMap = new Map<string, ProcessedSyncLead>(); // marca + rowNumber
    
    const processedLeads: ProcessedSyncLead[] = [];
    
    for (const lead of leads) {
      const duplicate = this.findDuplicateInBatch(lead, phoneMap, metaIdMap, rowNumberMap);
      
      if (duplicate) {
        // Marcar como duplicado
        processedLeads.push({
          ...lead,
          isDuplicate: true,
          duplicateOf: duplicate.metaLeadId
        });
      } else {
        // Agregar al mapa para futuras comparaciones
        phoneMap.set(lead.normalizedPhone, lead);
        metaIdMap.set(lead.metaLeadId, lead);
        
        // Agregar al mapa de números de fila si existe
        if (lead.googleSheetsRowNumber && lead.marca) {
          const rowKey = `${lead.marca.toUpperCase()}_${lead.googleSheetsRowNumber}`;
          rowNumberMap.set(rowKey, lead);
        }
        
        processedLeads.push({
          ...lead,
          isDuplicate: false
        });
      }
    }
    
    return processedLeads;
  }

  /**
   * Detecta si un lead es duplicado comparándolo con leads existentes
   */
  detectDuplicatesAgainstExisting(
    newLeads: ProcessedSyncLead[], 
    existingLeads: SyncLead[]
  ): ProcessedSyncLead[] {
    
    console.log(`🔍 MIGRACIÓN COMPLETA: Verificando ${newLeads.length} leads nuevos contra ${existingLeads.length} existentes`);
    console.log(`🎯 NUEVA LÓGICA: Solo usando googleSheetsRowNumber como criterio de duplicado`);
    
    // Crear mapa de filas existentes para búsqueda rápida (solo necesitamos esto)
    const existingRowNumbers = new Set(
      existingLeads
        .filter(l => l.googleSheetsRowNumber && l.marca)
        .map(l => `${l.marca.toUpperCase()}_${l.googleSheetsRowNumber}`)
    );
    
    let duplicatesFound = 0;
    let duplicatesByRow = 0;
    
    const result = newLeads.map((lead, index) => {
      // 🎯 NUEVA LÓGICA: Solo considerar duplicado por número de fila de Google Sheets
      // Esto permite migrar TODOS los datos, incluso con teléfonos repetidos
      let isDuplicateByRowNumber = false;
      let rowKey = null;
      if (lead.googleSheetsRowNumber && lead.marca) {
        rowKey = `${lead.marca.toUpperCase()}_${lead.googleSheetsRowNumber}`;
        isDuplicateByRowNumber = existingRowNumbers.has(rowKey);
      }
      
      // ✅ SOLO usar fila como criterio de duplicado para migración completa
      const isDuplicate = isDuplicateByRowNumber;
      
      if (isDuplicate) {
        duplicatesFound++;
        if (isDuplicateByRowNumber) duplicatesByRow++;
        
        // Encontrar el lead original para referencia (solo por fila)
        const originalLead = existingLeads.find(l => 
          rowKey && l.googleSheetsRowNumber && l.marca && 
          `${l.marca.toUpperCase()}_${l.googleSheetsRowNumber}` === rowKey
        );
        
        // 🚨 LOG DETALLADO DE DUPLICADOS
        console.log(`🚨 DUPLICADO POR FILA [${index + 1}/${newLeads.length}]:`);
        console.log(`   Nuevo lead: ${lead.nombre} | Tel: ${lead.normalizedPhone} | Fila: ${lead.googleSheetsRowNumber}`);
        console.log(`   Razón: Row=${isDuplicateByRowNumber} (ya existe esta fila)`);
        if (originalLead) {
          console.log(`   Lead existente: ${originalLead.nombre} | Fila: ${originalLead.googleSheetsRowNumber} | ID: ${originalLead.id}`);
        }
        console.log(`   RowKey: ${rowKey}`);
        
        return {
          ...lead,
          isDuplicate: true,
          duplicateOf: originalLead?.metaLeadId
        };
      } else {
        // 📝 LOG DE LEADS NUEVOS (solo primeros 5 para no saturar logs)
        if (index < 5) {
          console.log(`✅ LEAD NUEVO [${index + 1}]: ${lead.nombre} | Tel: ${lead.normalizedPhone} | Fila: ${lead.googleSheetsRowNumber}`);
        }
      }
      
      return {
        ...lead,
        isDuplicate: false
      };
    });
    
    console.log(`🎯 MIGRACIÓN COMPLETA - RESUMEN:`);
    console.log(`   📊 Total evaluados: ${newLeads.length}`);
    console.log(`   🚫 Duplicados por fila existente: ${duplicatesByRow}`);
    console.log(`   ✅ Leads nuevos para migrar: ${newLeads.length - duplicatesFound}`);
    console.log(`   📈 Tasa de migración: ${((newLeads.length - duplicatesFound) / newLeads.length * 100).toFixed(1)}%`);
    
    return result;
  }

  /**
   * Calcula el score de similitud entre dos leads
   */
  calculateSimilarityScore(lead1: ProcessedSyncLead, lead2: ProcessedSyncLead): number {
    let score = 0;
    let maxScore = 0;
    
    // Comparar teléfono (peso alto)
    maxScore += 40;
    if (lead1.normalizedPhone === lead2.normalizedPhone) {
      score += 40;
    }
    
    // Comparar email (peso medio)
    maxScore += 20;
    if (lead1.normalizedEmail && lead2.normalizedEmail && 
        lead1.normalizedEmail === lead2.normalizedEmail) {
      score += 20;
    }
    
    // Comparar nombre (peso medio)
    maxScore += 20;
    const nameSimilarity = this.calculateNameSimilarity(lead1.nombre, lead2.nombre);
    score += nameSimilarity * 20;
    
    // Comparar ciudad (peso bajo)
    maxScore += 10;
    if (lead1.ciudad.toLowerCase() === lead2.ciudad.toLowerCase()) {
      score += 10;
    }
    
    // Comparar cliente (peso medio)
    maxScore += 10;
    if (lead1.normalizedClient === lead2.normalizedClient) {
      score += 10;
    }
    
    return maxScore > 0 ? (score / maxScore) * 100 : 0;
  }

  /**
   * Encuentra leads potencialmente duplicados basado en similitud
   */
  findSimilarLeads(
    targetLead: ProcessedSyncLead, 
    candidateLeads: ProcessedSyncLead[], 
    threshold: number = 80
  ): Array<{ lead: ProcessedSyncLead; similarity: number }> {
    
    const similarLeads = candidateLeads
      .map(candidate => ({
        lead: candidate,
        similarity: this.calculateSimilarityScore(targetLead, candidate)
      }))
      .filter(result => result.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity);
    
    return similarLeads;
  }

  // ========== MÉTODOS PRIVADOS ==========

  private findDuplicateInBatch(
    lead: ProcessedSyncLead, 
    phoneMap: Map<string, ProcessedSyncLead>,
    metaIdMap: Map<string, ProcessedSyncLead>,
    rowNumberMap: Map<string, ProcessedSyncLead>
  ): ProcessedSyncLead | null {
    
    // Buscar por teléfono normalizado
    const phoneMatch = phoneMap.get(lead.normalizedPhone);
    if (phoneMatch) {
      return phoneMatch;
    }
    
    // Buscar por metaLeadId
    const metaIdMatch = metaIdMap.get(lead.metaLeadId);
    if (metaIdMatch) {
      return metaIdMatch;
    }
    
    // Buscar por número de fila de Google Sheets (marca + rowNumber)
    if (lead.googleSheetsRowNumber && lead.marca) {
      const rowKey = `${lead.marca.toUpperCase()}_${lead.googleSheetsRowNumber}`;
      const rowMatch = rowNumberMap.get(rowKey);
      if (rowMatch) {
        return rowMatch;
      }
    }
    
    return null;
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/[^\d+]/g, '');
  }

  private calculateNameSimilarity(name1: string, name2: string): number {
    if (!name1 || !name2) return 0;
    
    const n1 = name1.toLowerCase().trim();
    const n2 = name2.toLowerCase().trim();
    
    if (n1 === n2) return 1;
    
    // Algoritmo simple de similitud por palabras
    const words1 = n1.split(/\s+/);
    const words2 = n2.split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = Math.max(words1.length, words2.length);
    
    return totalWords > 0 ? commonWords.length / totalWords : 0;
  }
}