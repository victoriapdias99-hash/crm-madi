/**
 * Lista campañas pendientes con leads enviados
 */

async function listCampaignsWithSent() {
  try {
    const response = await fetch('http://localhost:5000/api/pending-campaigns');
    const data = await response.json();

    if (!data.success) {
      console.log('❌ Error obteniendo campañas');
      return;
    }

    const campaigns = data.campaigns || [];

    console.log('\n🔍 Campañas Pendientes con Enviados > 0:\n');
    console.log('─'.repeat(100));
    console.log(` ID  | Cliente                        | Marca        | Zona      | Enviados `);
    console.log('─'.repeat(100));

    const withSent = campaigns.filter((c: any) => {
      const enviados = typeof c.enviados === 'string' ? parseInt(c.enviados) : (c.enviados || 0);
      return enviados > 0;
    });

    if (withSent.length === 0) {
      console.log('⚠️  No hay campañas con leads enviados');
    } else {
      withSent.forEach((c: any) => {
        const enviados = typeof c.enviados === 'string' ? c.enviados : (c.enviados || 0);
        console.log(
          ` ${c.id.toString().padStart(3)} | ` +
          `${(c.clientName || c.clienteNombre || 'N/A').padEnd(30)} | ` +
          `${(c.marca || 'N/A').padEnd(12)} | ` +
          `${(c.zona || 'N/A').padEnd(9)} | ` +
          `${enviados.toString().padStart(8)}`
        );
      });
    }

    console.log('─'.repeat(100));
    console.log(`\nTotal: ${withSent.length} campañas con leads enviados`);
    console.log('');

  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
  }

  process.exit(0);
}

listCampaignsWithSent();
