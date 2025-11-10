import { db } from './db';
import { campanasComerciales, clientes } from '../shared/schema';
import { eq, inArray } from 'drizzle-orm';

async function checkRemainingCampaigns() {
  console.log('🔍 VERIFICANDO CAMPAÑAS RESTANTES CON LEADS ASIGNADOS\n');

  const remainingIds = [69, 88];

  const campaigns = await db
    .select({
      id: campanasComerciales.id,
      numeroCampana: campanasComerciales.numeroCampana,
      clienteNombre: clientes.nombreCliente,
      clienteComercial: clientes.nombreComercial,
      marca: campanasComerciales.marca,
      zona: campanasComerciales.zona,
      fechaCampana: campanasComerciales.fechaCampana,
      fechaFin: campanasComerciales.fechaFin,
    })
    .from(campanasComerciales)
    .leftJoin(clientes, eq(campanasComerciales.clienteId, clientes.id))
    .where(inArray(campanasComerciales.id, remainingIds));

  campaigns.forEach(c => {
    console.log(`📋 Campaña ${c.id}: ${c.clienteComercial} #${c.numeroCampana}`);
    console.log(`   Marca: ${c.marca}`);
    console.log(`   Zona: ${c.zona}`);
    console.log(`   Fecha inicio: ${c.fechaCampana}`);
    console.log(`   Fecha fin: ${c.fechaFin || '❌ SIN FECHA FIN (En proceso)'}\n`);
  });

  process.exit(0);
}

checkRemainingCampaigns();
