/**
 * Debug: Por qué clientName es null para campaña 84
 */

import { db } from './server/db';
import { campanasComerciales, clientes } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function debugClientName() {
  console.log('🔍 DEBUG: Investigando por qué clientName es null para campaña 84\n');

  try {
    // PASO 1: Ver datos de la campaña
    console.log('📋 PASO 1: Datos de la campaña 84');
    const campaign = await db
      .select()
      .from(campanasComerciales)
      .where(eq(campanasComerciales.id, 84))
      .limit(1);

    if (campaign.length === 0) {
      console.log('❌ Campaña 84 no existe');
      return;
    }

    console.log('Campaña 84:');
    console.log(`  ID: ${campaign[0].id}`);
    console.log(`  Cliente ID: ${campaign[0].clienteId}`);
    console.log(`  Número Campaña: ${campaign[0].numeroCampana}`);
    console.log(`  Marca: ${campaign[0].marca}`);
    console.log(`  Zona: ${campaign[0].zona}`);
    console.log('');

    // PASO 2: Buscar el cliente por ID
    console.log(`📋 PASO 2: Buscando cliente con ID ${campaign[0].clienteId}`);

    const cliente = await db
      .select()
      .from(clientes)
      .where(eq(clientes.id, campaign[0].clienteId))
      .limit(1);

    if (cliente.length === 0) {
      console.log(`❌ No se encontró cliente con ID ${campaign[0].clienteId}`);
      console.log('');
    } else {
      console.log('✅ Cliente encontrado:');
      console.log(`  ID: ${cliente[0].id}`);
      console.log(`  nombreCliente: ${cliente[0].nombreCliente}`);
      console.log(`  nombreComercial: ${cliente[0].nombreComercial}`);
      console.log('');
    }

    // PASO 3: Ver todos los clientes disponibles
    console.log('📋 PASO 3: Listando todos los clientes en la tabla');
    const allClientes = await db
      .select({
        id: clientes.id,
        nombreCliente: clientes.nombreCliente,
        nombreComercial: clientes.nombreComercial
      })
      .from(clientes)
      .orderBy(clientes.id);

    console.log(`Total de clientes: ${allClientes.length}`);
    console.log('');
    allClientes.forEach(c => {
      console.log(`  ID ${c.id}: ${c.nombreCliente} (${c.nombreComercial})`);
    });
    console.log('');

    // PASO 4: Verificar query del endpoint
    console.log('📋 PASO 4: Simulando query del endpoint');
    console.log('Query del repositorio:');
    console.log(`  SELECT nombreCliente FROM clientes WHERE id = ${campaign[0].clienteId}`);
    console.log('');

    const testQuery = await db
      .select({ nombreCliente: clientes.nombreCliente })
      .from(clientes)
      .where(eq(clientes.id, campaign[0].clienteId))
      .limit(1);

    console.log(`Resultado: ${testQuery.length > 0 ? testQuery[0].nombreCliente : 'NULL'}`);
    console.log('');

    // PASO 5: Verificar si clienteId es válido
    console.log('📋 PASO 5: Verificación de clienteId');
    console.log(`  clienteId de campaña: ${campaign[0].clienteId} (tipo: ${typeof campaign[0].clienteId})`);
    console.log(`  ¿Es un número válido?: ${!isNaN(campaign[0].clienteId) && campaign[0].clienteId > 0}`);
    console.log('');

    // CONCLUSIÓN
    console.log('🎯 CONCLUSIÓN:');
    if (cliente.length === 0) {
      console.log(`❌ PROBLEMA ENCONTRADO: No existe un cliente con ID ${campaign[0].clienteId}`);
      console.log('');
      console.log('💡 POSIBLES SOLUCIONES:');
      console.log('   1. El clienteId de la campaña está incorrecto');
      console.log('   2. El cliente fue eliminado de la base de datos');
      console.log('   3. Necesitas crear el cliente con ese ID');
      console.log('');
      console.log('🔧 ACCIÓN RECOMENDADA:');
      console.log('   - Verificar qué cliente debería tener esta campaña');
      console.log('   - Actualizar el clienteId de la campaña 84 a un cliente válido');
    } else {
      console.log('✅ El cliente existe, el endpoint debería funcionar correctamente');
    }

  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
    console.error(error);
  }

  process.exit(0);
}

debugClientName();
