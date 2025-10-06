import 'dotenv/config';
import { migrateSmartFast } from './server/sync-smart-fast/migrate-smart-fast.js';

async function main() {
  try {
    const stats = await migrateSmartFast();

    console.log('\n' + '='.repeat(70));
    console.log('🎉 MIGRACIÓN SMART-FAST COMPLETADA');
    console.log('='.repeat(70));
    console.log(`📊 Total procesado:     ${stats.totalProcessed}`);
    console.log(`✅ Nuevos insertados:   ${stats.inserted}`);
    console.log(`🔄 Actualizados:        ${stats.updated}`);
    console.log(`⏭️  Omitidos (sin tel): ${stats.skipped}`);
    console.log(`❌ Errores:             ${stats.errors}`);
    console.log('='.repeat(70));

    if (stats.details.length > 0) {
      console.log('\n📋 DETALLE POR MARCA:');
      console.log('-'.repeat(70));
      stats.details.forEach(detail => {
        const moved = detail.rowMoved > 0 ? ` (${detail.rowMoved} movidos)` : '';
        console.log(
          `   ${detail.marca.padEnd(20)} → ` +
          `${detail.inserted} nuevos, ${detail.updated} actualizados${moved}`
        );
      });
      console.log('-'.repeat(70));
    }

    console.log('\n✅ Migración exitosa - IDs únicos con timestamp\n');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ ERROR FATAL:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
