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
    const wsTrackingId = `WS-CAMP-${campaignId}-${Date.now()}`;
    const startTime = Date.now();

    console.log(`📡 [${wsTrackingId}] INICIO - Broadcasting ${action} para campaña ${campaignId}`);
    console.log(`👥 [${wsTrackingId}] Clientes conectados: ${this.clients.size}`);

    const message = {
      type: 'campaign_update',
      action,
      campaignId,
      timestamp: new Date().toISOString()
    };

    let successCount = 0;
    let errorCount = 0;
    let closedConnections = 0;

    this.clients.forEach((client, index) => {
      const clientId = `CLIENT-${index}`;

      if (client.readyState === 1) { // WebSocket OPEN state
        try {
          console.log(`📤 [${wsTrackingId}] Enviando a ${clientId}...`);
          client.send(JSON.stringify(message));
          successCount++;
          console.log(`✅ [${wsTrackingId}] ${clientId} - Mensaje enviado exitosamente`);
        } catch (error: any) {
          errorCount++;
          console.error(`❌ [${wsTrackingId}] ${clientId} - Error enviando mensaje:`, {
            error: error.message,
            errorType: error.constructor?.name,
            clientReadyState: client.readyState
          });
          console.log(`🧹 [${wsTrackingId}] Removiendo ${clientId} por error`);
          this.clients.delete(client);
        }
      } else {
        closedConnections++;
        console.log(`🔌 [${wsTrackingId}] ${clientId} - Conexión cerrada (readyState: ${client.readyState})`);
        this.clients.delete(client);
      }
    });

    const duration = Date.now() - startTime;
    console.log(`🎉 [${wsTrackingId}] COMPLETADO en ${duration}ms`);
    console.log(`📊 [${wsTrackingId}] Resultado: ${successCount} éxitos, ${errorCount} errores, ${closedConnections} conexiones cerradas`);
    console.log(`🔄 [${wsTrackingId}] Broadcasting ${action} campaign ${campaignId} - Final: ${this.clients.size} clientes activos`);
  }

  // Forzar actualización inmediata de datos diarios
  broadcastDashboardRefresh() {
    const wsTrackingId = `WS-DASH-${Date.now()}`;
    const startTime = Date.now();

    console.log(`⚡ [${wsTrackingId}] INICIO - Broadcasting dashboard refresh`);
    console.log(`👥 [${wsTrackingId}] Clientes conectados: ${this.clients.size}`);

    const message = {
      type: 'dashboard_refresh',
      timestamp: new Date().toISOString()
    };

    let successCount = 0;
    let errorCount = 0;
    let closedConnections = 0;

    this.clients.forEach((client, index) => {
      const clientId = `CLIENT-${index}`;

      if (client.readyState === 1) {
        try {
          console.log(`📤 [${wsTrackingId}] Enviando dashboard refresh a ${clientId}...`);
          client.send(JSON.stringify(message));
          successCount++;
          console.log(`✅ [${wsTrackingId}] ${clientId} - Dashboard refresh enviado exitosamente`);
        } catch (error: any) {
          errorCount++;
          console.error(`❌ [${wsTrackingId}] ${clientId} - Error enviando dashboard refresh:`, {
            error: error.message,
            errorType: error.constructor?.name,
            clientReadyState: client.readyState
          });
          console.log(`🧹 [${wsTrackingId}] Removiendo ${clientId} por error`);
          this.clients.delete(client);
        }
      } else {
        closedConnections++;
        console.log(`🔌 [${wsTrackingId}] ${clientId} - Conexión cerrada (readyState: ${client.readyState})`);
        this.clients.delete(client);
      }
    });

    const duration = Date.now() - startTime;
    console.log(`🎉 [${wsTrackingId}] COMPLETADO en ${duration}ms`);
    console.log(`📊 [${wsTrackingId}] Resultado: ${successCount} éxitos, ${errorCount} errores, ${closedConnections} conexiones cerradas`);
    console.log(`⚡ [${wsTrackingId}] Dashboard refresh completado - Final: ${this.clients.size} clientes activos`);
  }
}

export const realtimeSync = RealtimeSync.getInstance();