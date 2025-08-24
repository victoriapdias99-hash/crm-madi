import axios from 'axios';

interface MetaAdsConfig {
  accessToken: string;
  accountId: string;
  appSecret?: string;
}

interface CampaignSpendData {
  campaignId: string;
  campaignName: string;
  spend: number;
  accountCurrency: string;
  impressions: number;
  clicks: number;
  cpc: number;
  cpm: number;
  frequency: number;
  dateStart: string;
  dateStop: string;
  lastUpdated: Date;
  costPerResult?: number; // Coste por conversación/resultado desde Meta Ads
  actions?: any; // Acciones/conversiones disponibles
  costPerActionType?: any; // Coste por tipo de acción
}

interface AdsetSpendData {
  adsetId: string;
  adsetName: string;
  campaignId: string;
  campaignName: string;
  spend: number;
  accountCurrency: string;
  impressions: number;
  clicks: number;
  cpc: number;
  cpm: number;
  dateStart: string;
  dateStop: string;
  lastUpdated: Date;
  costPerResult?: number; // Coste por conversación/resultado desde Meta Ads
  actions?: any;
  costPerActionType?: any;
}

interface BudgetData {
  campaignId: string;
  dailyBudget?: number;
  lifetimeBudget?: number;
  budgetRemaining?: number;
  spend: number;
  budgetUtilization: number;
}

class MetaAdsService {
  private config: MetaAdsConfig;
  private baseUrl: string = 'https://graph.facebook.com/v21.0';
  private lastSyncTime: Date | null = null;
  private campaignCache: Map<string, CampaignSpendData> = new Map();

  constructor(config: MetaAdsConfig) {
    this.config = config;
  }

  /**
   * Obtiene datos de gasto de todas las campañas activas
   */
  async getCampaignSpendData(timeRange?: { since: string; until: string }): Promise<CampaignSpendData[]> {
    try {
      const defaultTimeRange = timeRange || {
        since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Últimos 30 días
        until: new Date().toISOString().split('T')[0]
      };

      const fields = [
        'campaign_id',
        'campaign_name',
        'spend',
        'account_currency',
        'impressions',
        'clicks',
        'cpc',
        'cpm',
        'frequency',
        'date_start',
        'date_stop',
        'actions',
        'cost_per_action_type',
        'cost_per_result'
      ].join(',');

      const params = {
        access_token: this.config.accessToken,
        fields: fields,
        level: 'campaign',
        time_range: JSON.stringify(defaultTimeRange),
        limit: 100
      };

      const response = await axios.get(`${this.baseUrl}/${this.config.accountId}/insights`, { params });
      
      if (response.data?.data) {
        const campaigns = response.data.data.map((campaign: any) => {
          // Extraer coste por resultado de Meta Ads
          let costPerResult = 0;
          
          
          // Intentar obtener cost_per_result directamente (nueva estructura de Meta Ads)
          if (campaign.cost_per_result && Array.isArray(campaign.cost_per_result)) {
            // Nueva estructura: array de objetos con indicator y values
            const conversationAction = campaign.cost_per_result.find((item: any) =>
              item.indicator?.includes('messaging_conversation') ||
              item.indicator?.includes('total_messaging_connection') ||
              item.indicator?.includes('lead')
            );
            
            if (conversationAction && conversationAction.values && conversationAction.values[0]) {
              const valueObj = conversationAction.values[0];
              const value = valueObj.value || valueObj;
              costPerResult = parseFloat(value);
            }
          }
          // Fallback a estructura antigua si no es array
          else if (campaign.cost_per_result && typeof campaign.cost_per_result === 'string' && campaign.cost_per_result !== "0") {
            costPerResult = parseFloat(campaign.cost_per_result || '0');
          }
          // Si no, intentar obtener de cost_per_action_type (conversaciones, leads, etc.)
          else if (campaign.cost_per_action_type && Array.isArray(campaign.cost_per_action_type)) {
            console.log(`🔍 DEBUG: Buscando cost_per_action_type para campaña ${campaign.campaign_name}`);
            console.log('Available action types:', campaign.cost_per_action_type.map((a: any) => a.action_type));
            
            // Buscar cost_per_lead, cost_per_conversion, cost_per_messaging_conversation, etc.
            const leadCost = campaign.cost_per_action_type.find((action: any) => 
              action.action_type === 'lead' || 
              action.action_type === 'onsite_conversion.lead_grouping' ||
              action.action_type === 'messaging_conversation_started_7d' ||
              action.action_type === 'onsite_conversion.total_messaging_connection' ||
              action.action_type === 'messaging_conversation' ||
              action.action_type === 'conversion'
            );
            if (leadCost && leadCost.value) {
              costPerResult = parseFloat(leadCost.value);
              console.log(`✅ Found cost per result: ${costPerResult} (type: ${leadCost.action_type})`);
            } else {
              console.log('⚠️ No matching cost_per_action_type found');
            }
          }
          
          return {
            campaignId: campaign.campaign_id,
            campaignName: campaign.campaign_name,
            spend: parseFloat(campaign.spend || '0'),
            accountCurrency: campaign.account_currency || 'USD',
            impressions: parseInt(campaign.impressions || '0'),
            clicks: parseInt(campaign.clicks || '0'),
            cpc: parseFloat(campaign.cpc || '0'),
            cpm: parseFloat(campaign.cpm || '0'),
            frequency: parseFloat(campaign.frequency || '0'),
            dateStart: campaign.date_start,
            dateStop: campaign.date_stop,
            lastUpdated: new Date(),
            costPerResult: costPerResult,
            actions: campaign.actions || [],
            costPerActionType: campaign.cost_per_action_type || []
          };
        });

        // Actualizar cache
        campaigns.forEach((campaign: CampaignSpendData) => {
          this.campaignCache.set(campaign.campaignId, campaign);
        });

        this.lastSyncTime = new Date();
        return campaigns;
      }

      return [];
    } catch (error) {
      console.error('Error fetching Meta Ads campaign data:', error);
      throw new Error(`Meta Ads API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Obtiene datos de gasto de adsets filtrados por fecha y campaña para calcular CPA
   */
  async getAdsetSpendData(filters: {
    campaignName?: string;
    dateRange?: { since: string; until: string };
  }): Promise<AdsetSpendData[]> {
    try {
      const defaultTimeRange = filters.dateRange || {
        since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        until: new Date().toISOString().split('T')[0]
      };

      const fields = [
        'adset_id',
        'adset_name', 
        'campaign_id',
        'campaign_name',
        'spend',
        'account_currency',
        'impressions',
        'clicks',
        'cpc',
        'cpm',
        'date_start',
        'date_stop',
        'actions',
        'cost_per_action_type',
        'cost_per_result'
      ].join(',');

      const params: any = {
        access_token: this.config.accessToken,
        fields: fields,
        level: 'adset',
        time_range: JSON.stringify(defaultTimeRange),
        limit: 100
      };

      // Si se especifica campaña, filtrar por nombre de campaña
      if (filters.campaignName) {
        params.filtering = JSON.stringify([{
          field: 'campaign.name',
          operator: 'CONTAIN',
          value: filters.campaignName
        }]);
      }

      const response = await axios.get(`${this.baseUrl}/${this.config.accountId}/insights`, { params });
      
      if (response.data?.data) {
        const adsets = response.data.data.map((adset: any) => {
          // Extraer coste por resultado de Meta Ads para adsets
          let costPerResult = 0;
          
          // Intentar obtener cost_per_result directamente (nueva estructura de Meta Ads)
          if (adset.cost_per_result && Array.isArray(adset.cost_per_result)) {
            // Nueva estructura: array de objetos con indicator y values
            const conversationAction = adset.cost_per_result.find((item: any) =>
              item.indicator?.includes('messaging_conversation') ||
              item.indicator?.includes('total_messaging_connection') ||
              item.indicator?.includes('lead')
            );
            
            if (conversationAction && conversationAction.values && conversationAction.values[0]) {
              const value = conversationAction.values[0].value || conversationAction.values[0];
              costPerResult = parseFloat(value);
            }
          }
          // Fallback a estructura antigua si no es array
          else if (adset.cost_per_result && typeof adset.cost_per_result === 'string' && adset.cost_per_result !== "0") {
            costPerResult = parseFloat(adset.cost_per_result || '0');
          }
          // Si no, intentar obtener de cost_per_action_type
          else if (adset.cost_per_action_type && Array.isArray(adset.cost_per_action_type)) {
            const leadCost = adset.cost_per_action_type.find((action: any) => 
              action.action_type === 'lead' || 
              action.action_type === 'onsite_conversion.lead_grouping' ||
              action.action_type === 'messaging_conversation_started_7d' ||
              action.action_type === 'onsite_conversion.total_messaging_connection' ||
              action.action_type === 'messaging_conversation' ||
              action.action_type === 'conversion'
            );
            if (leadCost && leadCost.value) {
              costPerResult = parseFloat(leadCost.value);
            }
          }
          
          return {
            adsetId: adset.adset_id,
            adsetName: adset.adset_name,
            campaignId: adset.campaign_id,
            campaignName: adset.campaign_name,
            spend: parseFloat(adset.spend || '0'),
            accountCurrency: adset.account_currency || 'ARS',
            impressions: parseInt(adset.impressions || '0'),
            clicks: parseInt(adset.clicks || '0'),
            cpc: parseFloat(adset.cpc || '0'),
            cpm: parseFloat(adset.cpm || '0'),
            dateStart: adset.date_start,
            dateStop: adset.date_stop,
            lastUpdated: new Date(),
            costPerResult: costPerResult,
            actions: adset.actions || [],
            costPerActionType: adset.cost_per_action_type || []
          };
        });

        return adsets;
      }

      return [];
    } catch (error) {
      console.error('Error fetching Meta Ads adset data:', error);
      throw new Error(`Meta Ads Adset API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calcula CPA (Cost Per Acquisition) por campaña y fecha
   */
  async calculateCPA(campaignName: string, dateRange: { since: string; until: string }, leadCount: number): Promise<number> {
    try {
      const adsetData = await this.getAdsetSpendData({
        campaignName,
        dateRange
      });

      // Sumar el gasto total de todos los adsets de la campaña en el rango de fechas
      const totalSpend = adsetData.reduce((sum, adset) => sum + adset.spend, 0);

      // Calcular CPA: Gasto total / Cantidad de leads
      const cpa = leadCount > 0 ? totalSpend / leadCount : 0;

      console.log(`🔍 CPA CALCULADO: ${campaignName} | Gasto: $${totalSpend} | Leads: ${leadCount} | CPA: $${cpa.toFixed(2)}`);

      return cpa;
    } catch (error) {
      console.error(`Error calculating CPA for ${campaignName}:`, error);
      return 0;
    }
  }

  /**
   * Obtiene datos de presupuesto y utilización
   */
  async getCampaignBudgets(campaignIds?: string[]): Promise<BudgetData[]> {
    try {
      const fields = [
        'id',
        'name',
        'daily_budget',
        'lifetime_budget',
        'budget_remaining',
        'spend_cap',
        'status'
      ].join(',');

      const params = {
        access_token: this.config.accessToken,
        fields: fields
      };

      let campaigns: any[] = [];

      if (campaignIds && campaignIds.length > 0) {
        // Obtener campañas específicas
        for (const campaignId of campaignIds) {
          const response = await axios.get(`${this.baseUrl}/${campaignId}`, { params });
          if (response.data) {
            campaigns.push(response.data);
          }
        }
      } else {
        // Obtener todas las campañas de la cuenta
        const response = await axios.get(`${this.baseUrl}/${this.config.accountId}/campaigns`, { params });
        campaigns = response.data?.data || [];
      }

      const budgetData: BudgetData[] = [];

      for (const campaign of campaigns) {
        // Obtener spend actual de insights
        const spendData = this.campaignCache.get(campaign.id);
        const currentSpend = spendData?.spend || 0;

        const dailyBudget = campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : undefined;
        const lifetimeBudget = campaign.lifetime_budget ? parseFloat(campaign.lifetime_budget) / 100 : undefined;

        const budget = dailyBudget || lifetimeBudget || 0;
        const budgetUtilization = budget > 0 ? (currentSpend / budget) * 100 : 0;

        budgetData.push({
          campaignId: campaign.id,
          dailyBudget,
          lifetimeBudget,
          budgetRemaining: campaign.budget_remaining ? parseFloat(campaign.budget_remaining) / 100 : undefined,
          spend: currentSpend,
          budgetUtilization
        });
      }

      return budgetData;
    } catch (error) {
      console.error('Error fetching campaign budgets:', error);
      throw new Error(`Budget API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Obtiene métricas en tiempo real (últimas 24 horas)
   */
  async getRealTimeMetrics(): Promise<CampaignSpendData[]> {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    return this.getCampaignSpendData({
      since: yesterday,
      until: today
    });
  }

  /**
   * Verifica la validez del token de acceso
   */
  async validateToken(): Promise<boolean> {
    try {
      const params = {
        access_token: this.config.accessToken,
        fields: 'id,name'
      };

      const response = await axios.get(`${this.baseUrl}/${this.config.accountId}`, { params });
      return !!response.data?.id;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  /**
   * Obtiene resumen de gasto total de la cuenta
   */
  async getAccountSpendSummary(timeRange?: { since: string; until: string }): Promise<{
    totalSpend: number;
    currency: string;
    campaignCount: number;
    lastUpdated: Date;
  }> {
    const campaigns = await this.getCampaignSpendData(timeRange);
    
    const totalSpend = campaigns.reduce((sum, campaign) => sum + campaign.spend, 0);
    const currency = campaigns[0]?.accountCurrency || 'USD';
    
    return {
      totalSpend,
      currency,
      campaignCount: campaigns.length,
      lastUpdated: new Date()
    };
  }

  /**
   * Configura sincronización automática cada 30 minutos
   */
  startAutoSync(callback?: (data: CampaignSpendData[]) => void): NodeJS.Timeout {
    const syncInterval = 30 * 60 * 1000; // 30 minutos

    return setInterval(async () => {
      try {
        console.log('Syncing Meta Ads data...');
        const data = await this.getRealTimeMetrics();
        console.log(`Synced ${data.length} campaigns from Meta Ads`);
        
        if (callback) {
          callback(data);
        }
      } catch (error) {
        console.error('Auto sync failed:', error);
      }
    }, syncInterval);
  }

  /**
   * Obtiene estadísticas de cache
   */
  getCacheStats(): {
    cachedCampaigns: number;
    lastSyncTime: Date | null;
    cacheAge: number | null;
  } {
    return {
      cachedCampaigns: this.campaignCache.size,
      lastSyncTime: this.lastSyncTime,
      cacheAge: this.lastSyncTime ? Date.now() - this.lastSyncTime.getTime() : null
    };
  }

  /**
   * Genera informe de auditoría con cambios en conjuntos de anuncios y resultados
   */
  async generateAuditReport(params: {
    fechaInicio: string;
    fechaFin: string;
    campanaId: string | null;
  }): Promise<{
    periodo: string;
    cambios: {
      adsets: {
        total: number;
        nuevos: number;
        modificados: number;
        pausados: number;
      };
      anuncios: {
        total: number;
        nuevos: number;
        modificados: number;
        pausados: number;
      };
      detalles: Array<{
        tipo: string;
        nombre: string;
        descripcion: string;
        fecha: string;
      }>;
    };
    costes: {
      gastoTotal: number;
      gastoDiario: number;
      cpcPromedio: number;
      cpmPromedio: number;
      moneda: string;
    };
    resultados: {
      impresiones: number;
      clics: number;
      ctr: number;
      alcance: number;
      frecuencia: number;
    };
    resumen: string;
  }> {
    const { fechaInicio, fechaFin, campanaId } = params;
    
    try {
      // Obtener datos de campañas en el rango de fechas
      let campaignData = await this.getCampaignSpendData({
        since: fechaInicio,
        until: fechaFin
      });

      // Filtrar por campaña específica si se proporciona
      if (campanaId) {
        console.log(`🔍 FILTRO CAMPAÑA: Buscando campaignId=${campanaId} en ${campaignData.length} campañas disponibles`);
        console.log('Campañas disponibles:', campaignData.map(c => ({ id: c.campaignId, name: c.campaignName })));
        
        campaignData = campaignData.filter(campaign => campaign.campaignId === campanaId);
        
        if (campaignData.length === 0) {
          console.log('⚠️ No se encontró la campaña en el rango de fechas. Consultando directamente...');
          
          // Si no se encuentra en el rango, hacer consulta directa de la campaña específica
          try {
            const directResponse = await axios.get(
              `${this.baseUrl}/${campanaId}`,
              {
                params: {
                  access_token: this.config.accessToken,
                  fields: 'id,name,account_id'
                }
              }
            );
            
            if (directResponse.data) {
              // Crear un registro básico para la auditoría
              campaignData = [{
                campaignId: directResponse.data.id,
                campaignName: directResponse.data.name,
                spend: 0,
                accountCurrency: 'ARS',
                impressions: 0,
                clicks: 0,
                cpc: 0,
                cpm: 0,
                frequency: 0,
                dateStart: fechaInicio,
                dateStop: fechaFin,
                lastUpdated: new Date()
              }];
              console.log(`✅ Campaña encontrada directamente: ${directResponse.data.name}`);
            }
          } catch (directError) {
            console.error('Error consultando campaña directamente:', directError);
          }
        }
      }

      // Obtener datos de conjuntos de anuncios para análisis de cambios
      const adsetsData = await this.getAdsetsForAudit(campaignData, { fechaInicio, fechaFin });

      // Calcular métricas agregadas
      const totalSpend = campaignData.reduce((sum, campaign) => sum + campaign.spend, 0);
      const totalImpressions = campaignData.reduce((sum, campaign) => sum + campaign.impressions, 0);
      const totalClicks = campaignData.reduce((sum, campaign) => sum + campaign.clicks, 0);
      const totalReach = campaignData.reduce((sum, campaign) => sum + campaign.impressions, 0); // Usamos impressions como aproximación de reach
      const avgFrequency = campaignData.length > 0 
        ? campaignData.reduce((sum, campaign) => sum + campaign.frequency, 0) / campaignData.length 
        : 0;

      // Calcular días entre fechas
      const startDate = new Date(fechaInicio);
      const endDate = new Date(fechaFin);
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // Calcular promedios
      const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;
      const avgCPM = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const dailySpend = daysDiff > 0 ? totalSpend / daysDiff : 0;

      // Generar resumen ejecutivo
      const resumen = this.generateExecutiveSummary({
        campaignCount: campaignData.length,
        totalSpend,
        dailySpend,
        totalImpressions,
        totalClicks,
        ctr,
        adsetsChanges: adsetsData.cambios,
        dateRange: `${fechaInicio} - ${fechaFin}`
      });

      return {
        periodo: `${startDate.toLocaleDateString('es-ES')} - ${endDate.toLocaleDateString('es-ES')}`,
        cambios: adsetsData.cambios,
        costes: {
          gastoTotal: totalSpend,
          gastoDiario: dailySpend,
          cpcPromedio: avgCPC,
          cpmPromedio: avgCPM,
          moneda: campaignData[0]?.accountCurrency || 'ARS'
        },
        resultados: {
          impresiones: totalImpressions,
          clics: totalClicks,
          ctr: ctr,
          alcance: totalReach,
          frecuencia: avgFrequency
        },
        resumen
      };
    } catch (error) {
      console.error('Error generating audit report:', error);
      throw new Error(`Failed to generate audit report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Obtiene datos de conjuntos de anuncios para auditoría de 2 capas (adsets + anuncios)
   * Implementa cache y rate limiting inteligente para evitar bloqueos de API
   */
  private async getAdsetsForAudit(campaignData: CampaignSpendData[], dateRange: { fechaInicio: string; fechaFin: string }) {
    console.log('🔍 AUDITORÍA 2 CAPAS: Iniciando análisis de adsets y anuncios para', campaignData.length, 'campañas');
    
    const changes = {
      adsets: {
        total: 0,
        nuevos: 0,
        modificados: 0,
        pausados: 0
      },
      anuncios: {
        total: 0,
        nuevos: 0,
        modificados: 0,
        pausados: 0
      },
      detalles: [] as Array<{
        tipo: string;
        nombre: string;
        descripcion: string;
        fecha: string;
      }>
    };

    try {
      const rangeStart = new Date(dateRange.fechaInicio);
      const rangeEnd = new Date(dateRange.fechaFin);
      
      // Validar que tenemos datos de campaigns para procesar
      if (campaignData.length === 0) {
        console.log('⚠️ No hay campañas para auditar en el rango de fechas especificado');
        changes.detalles.push({
          tipo: '📋 Información',
          nombre: 'Sistema de Auditoría',
          descripcion: 'No hay campañas activas en el rango de fechas especificado para la auditoría.',
          fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        });
        return { cambios: changes };
      }
      
      // Para reducir llamadas a la API, usar método conservativo
      for (const campaign of campaignData) {
        console.log(`🔍 Analizando campaña: ${campaign.campaignName} (ID: ${campaign.campaignId})`);
        
        try {
          // CAPA 1: ADSETS (Conjuntos de Anuncios) con rate limiting conservativo
          await new Promise(resolve => setTimeout(resolve, 3000)); // 3 segundos entre llamadas
          
          const adsetsResponse = await axios.get(
            `${this.baseUrl}/${campaign.campaignId}/adsets`,
            {
              params: {
                access_token: this.config.accessToken,
                fields: 'id,name,status,effective_status,created_time,updated_time',
                limit: 25 // Límite conservativo
              },
              timeout: 10000 // 10 segundos timeout
            }
          );

          if (adsetsResponse.data?.data) {
            const adsets = adsetsResponse.data.data;
            changes.adsets.total += adsets.length;
            console.log(`📊 Encontrados ${adsets.length} adsets en campaña ${campaign.campaignName}`);

            for (const adset of adsets) {
              const createdDate = new Date(adset.created_time);
              const updatedDate = new Date(adset.updated_time);

              // Detectar adsets nuevos
              if (createdDate >= rangeStart && createdDate <= rangeEnd) {
                changes.adsets.nuevos++;
                changes.detalles.push({
                  tipo: '🆕 Nuevo Conjunto de Anuncios',
                  nombre: adset.name,
                  descripcion: `Creado en campaña: ${campaign.campaignName}`,
                  fecha: createdDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                });
              }

              // Detectar adsets modificados (con diferencia de más de 5 minutos entre creación y actualización)
              if (updatedDate >= rangeStart && updatedDate <= rangeEnd && 
                  Math.abs(updatedDate.getTime() - createdDate.getTime()) > 5 * 60 * 1000) {
                changes.adsets.modificados++;
                changes.detalles.push({
                  tipo: '✏️ Conjunto Modificado',
                  nombre: adset.name,
                  descripcion: `Estado actual: ${adset.effective_status}. Campaña: ${campaign.campaignName}`,
                  fecha: updatedDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                });
              }

              // Detectar adsets pausados
              if (adset.effective_status === 'PAUSED' || adset.status === 'PAUSED') {
                changes.adsets.pausados++;
              }

              // CAPA 2: ANUNCIOS (Consulta conservativa para evitar rate limits)
              try {
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2 segundos entre adsets
                
                const adsResponse = await axios.get(
                  `${this.baseUrl}/${adset.id}/ads`,
                  {
                    params: {
                      access_token: this.config.accessToken,
                      fields: 'id,name,status,effective_status,created_time,updated_time',
                      limit: 10 // Límite muy conservativo para anuncios
                    },
                    timeout: 8000 // 8 segundos timeout
                  }
                );

                if (adsResponse.data?.data) {
                  const ads = adsResponse.data.data;
                  changes.anuncios.total += ads.length;
                  console.log(`📢 Encontrados ${ads.length} anuncios en adset ${adset.name}`);

                  for (const ad of ads) {
                    const adCreatedDate = new Date(ad.created_time);
                    const adUpdatedDate = new Date(ad.updated_time);

                    // Detectar anuncios nuevos
                    if (adCreatedDate >= rangeStart && adCreatedDate <= rangeEnd) {
                      changes.anuncios.nuevos++;
                      changes.detalles.push({
                        tipo: '🎯 Nuevo Anuncio',
                        nombre: ad.name,
                        descripcion: `Creado en conjunto: ${adset.name}`,
                        fecha: adCreatedDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      });
                    }

                    // Detectar anuncios modificados
                    if (adUpdatedDate >= rangeStart && adUpdatedDate <= rangeEnd && 
                        Math.abs(adUpdatedDate.getTime() - adCreatedDate.getTime()) > 5 * 60 * 1000) {
                      changes.anuncios.modificados++;
                      changes.detalles.push({
                        tipo: '📝 Anuncio Modificado',
                        nombre: ad.name,
                        descripcion: `Estado: ${ad.effective_status}. Conjunto: ${adset.name}`,
                        fecha: adUpdatedDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      });
                    }

                    // Detectar anuncios pausados
                    if (ad.effective_status === 'PAUSED' || ad.status === 'PAUSED') {
                      changes.anuncios.pausados++;
                    }
                  }
                }
              } catch (adsError: any) {
                console.warn(`⚠️ Error al consultar anuncios del adset ${adset.id}. Continuando con siguiente adset...`);
                // No agregar al detalle para evitar spam de errores
              }
            }
          }
        } catch (campaignError: any) {
          console.error(`🚨 Error al consultar adsets de campaña ${campaign.campaignId}:`, campaignError.response?.data || campaignError.message);
          
          // Solo agregar el error principal de la campaña
          changes.detalles.push({
            tipo: '⚠️ Error de Campaña',
            nombre: campaign.campaignName,
            descripcion: `Error al acceder a datos de Meta Ads. ${campaignError.response?.data?.error?.error_user_msg || 'Límite de API alcanzado'}`,
            fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          });
        }
      }

      console.log('✅ AUDITORÍA COMPLETADA:', {
        adsets: changes.adsets,
        anuncios: changes.anuncios,
        detallesEncontrados: changes.detalles.length
      });

    } catch (error: any) {
      console.error('🚨 Error general en auditoría 2 capas:', error);
      
      changes.detalles.push({
        tipo: '🚨 Error Crítico',
        nombre: 'Sistema de Auditoría',
        descripcion: `Error general del sistema: ${error.response?.data?.error?.message || error.message || 'Error desconocido'}`,
        fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      });
    }

    return { cambios: changes };
  }

  /**
   * Genera resumen ejecutivo del informe
   */
  private generateExecutiveSummary(params: {
    campaignCount: number;
    totalSpend: number;
    dailySpend: number;
    totalImpressions: number;
    totalClicks: number;
    ctr: number;
    adsetsChanges: any;
    dateRange: string;
  }): string {
    const { campaignCount, totalSpend, dailySpend, totalImpressions, totalClicks, ctr, adsetsChanges, dateRange } = params;
    
    const formatCurrency = (amount: number) => new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);

    const formatNumber = (num: number) => new Intl.NumberFormat('es-AR').format(num);

    const adsets = adsetsChanges.adsets;
    const anuncios = adsetsChanges.anuncios || { nuevos: 0, modificados: 0, pausados: 0, total: 0 };
    
    return `Durante el período ${dateRange}, se monitorearon ${campaignCount} campañas activas con una inversión total de ${formatCurrency(totalSpend)} ` +
           `(promedio diario: ${formatCurrency(dailySpend)}). Las campañas generaron ${formatNumber(totalImpressions)} impresiones y ${formatNumber(totalClicks)} clics, ` +
           `alcanzando un CTR del ${ctr.toFixed(2)}%. ` +
           `ANÁLISIS DE CONJUNTOS DE ANUNCIOS: Se detectaron ${adsets.nuevos} nuevos conjuntos, ${adsets.modificados} modificaciones y ${adsets.pausados} conjuntos pausados de ${adsets.total} totales. ` +
           `ANÁLISIS DE ANUNCIOS INDIVIDUALES: Se encontraron ${anuncios.nuevos} nuevos anuncios, ${anuncios.modificados} modificaciones y ${anuncios.pausados} anuncios pausados de ${anuncios.total} anuncios activos. ` +
           `El rendimiento general muestra ${ctr > 1 ? 'un CTR saludable' : 'oportunidades de mejora en CTR'} y ` +
           `${totalSpend > 100000 ? 'una inversión significativa' : 'una inversión moderada'} en el período analizado.`;
  }
}

export { MetaAdsService, type CampaignSpendData, type BudgetData, type MetaAdsConfig, type AdsetSpendData };