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
    
    const processedLeads: ProcessedSyncLead[] = [];
    
    for (const lead of leads) {
      const duplicate = this.findDuplicateInBatch(lead, phoneMap, metaIdMap);
      
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
    
    // Crear mapas de leads existentes para búsqueda rápida
    const existingPhones = new Set(existingLeads.map(l => this.normalizePhone(l.telefono)));
    const existingMetaIds = new Set(existingLeads.map(l => l.metaLeadId));
    
    return newLeads.map(lead => {
      const isDuplicateByPhone = existingPhones.has(lead.normalizedPhone);
      const isDuplicateByMetaId = existingMetaIds.has(lead.metaLeadId);
      
      const isDuplicate = isDuplicateByPhone || isDuplicateByMetaId;
      
      if (isDuplicate) {
        // Encontrar el lead original para referencia
        const originalLead = existingLeads.find(l => 
          this.normalizePhone(l.telefono) === lead.normalizedPhone || 
          l.metaLeadId === lead.metaLeadId
        );
        
        return {
          ...lead,
          isDuplicate: true,
          duplicateOf: originalLead?.metaLeadId
        };
      }
      
      return {
        ...lead,
        isDuplicate: false
      };
    });
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
    metaIdMap: Map<string, ProcessedSyncLead>
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