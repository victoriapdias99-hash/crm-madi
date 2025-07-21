// Sistema de sincronización en tiempo real para invalidación de cache
export class RealtimeSync {
  private static instance: RealtimeSync;
  private clients: Set<any> = new Set();

  static getInstance(): RealtimeSync {
    if (!RealtimeSync.instance) {
      RealtimeSync.instance = new RealtimeSync();
    }
    return RealtimeSync.instance;
  }

  addClient(ws: any) {
    this.clients.add(ws);
  }

  removeClient(ws: any) {
    this.clients.delete(ws);
  }

  // Notificar a todos los clientes conectados sobre cambios en campañas
  broadcastCampaignUpdate(action: 'created' | 'updated' | 'deleted', campaignId: number) {
    const message = {
      type: 'campaign_update',
      action,
      campaignId,
      timestamp: new Date().toISOString()
    };

    this.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket OPEN state
        try {
          client.send(JSON.stringify(message));
        } catch (error) {
          console.error('Error sending WebSocket message:', error);
          this.clients.delete(client);
        }
      } else {
        this.clients.delete(client);
      }
    });

    console.log(`🔄 Broadcasting ${action} campaign ${campaignId} to ${this.clients.size} clients`);
  }

  // Forzar actualización inmediata de datos diarios
  broadcastDashboardRefresh() {
    const message = {
      type: 'dashboard_refresh',
      timestamp: new Date().toISOString()
    };

    this.clients.forEach(client => {
      if (client.readyState === 1) {
        try {
          client.send(JSON.stringify(message));
        } catch (error) {
          console.error('Error sending dashboard refresh:', error);
          this.clients.delete(client);
        }
      } else {
        this.clients.delete(client);
      }
    });

    console.log(`⚡ Broadcasting dashboard refresh to ${this.clients.size} clients`);
  }
}

export const realtimeSync = RealtimeSync.getInstance();