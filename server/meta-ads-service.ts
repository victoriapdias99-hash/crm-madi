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
        'date_stop'
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
        const campaigns = response.data.data.map((campaign: any) => ({
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
          lastUpdated: new Date()
        }));

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
        'date_stop'
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
        const adsets = response.data.data.map((adset: any) => ({
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
          lastUpdated: new Date()
        }));

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
}

export { MetaAdsService, type CampaignSpendData, type BudgetData, type MetaAdsConfig, type AdsetSpendData };