import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { campanasComerciales, clientes } from './shared/schema';
import { isNotNull, eq } from 'drizzle-orm';

const DATABASE_URL = "postgresql://neondb_owner:npg_7CIqXbUK8eYG@ep-winter-unit-a2bsmtg9.eu-central-1.aws.neon.tech/neondb?sslmode=require";

const client = neon(DATABASE_URL);
const db = drizzle(client);

async function reabrirCampanas() {
  console.log('Buscando campanas cerradas...');

  // Obtener campañas cerradas con información del cliente
  const campanasCerradas = await db
    .select({
      id: campanasComerciales.id,
      numeroCampana: campanasComerciales.numeroCampana,
      marca: campanasComerciales.marca,
      fechaFin: campanasComerciales.fechaFin,
      cantidadDatosSolicitados: campanasComerciales.cantidadDatosSolicitados,
      clienteNombre: clientes.nombreComercial
    })
    .from(campanasComerciales)
    .leftJoin(clientes, eq(campanasComerciales.clienteId, clientes.id))
    .where(isNotNull(campanasComerciales.fechaFin));

  console.log(`Campanas cerradas encontradas: ${campanasCerradas.length}`);

  if (campanasCerradas.length === 0) {
    console.log('No hay campanas cerradas para reabrir');
    return;
  }

  console.log('\nDetalle de campanas a reabrir:');
  campanasCerradas.forEach((c, i) => {
    console.log(`  ${i + 1}. ID: ${c.id} | Cliente: ${c.clienteNombre} | Campana: ${c.numeroCampana} | Marca: ${c.marca} | Meta: ${c.cantidadDatosSolicitados} | Fecha Fin: ${c.fechaFin}`);
  });

  console.log('\nReabriendo campanas (eliminando fecha_fin)...');

  // Reabrir todas las campañas cerradas
  const result = await db
    .update(campanasComerciales)
    .set({
      fechaFin: null,
      updatedAt: new Date()
    })
    .where(isNotNull(campanasComerciales.fechaFin));

  console.log(`${campanasCerradas.length} campanas reabiertas exitosamente`);
  console.log('\nTodas las campanas ahora tienen estado "En proceso"');
}

reabrirCampanas().catch(console.error);
