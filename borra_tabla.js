import pg from "pg";
const { Client } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está definida en el entorno");
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function limpiar() {
  try {
    await client.connect();
    console.log("🔌 Conectado. Borrando op_leads_rep...");

    // 1. Intentamos borrarla si es una VISTA (View)
    await client.query("DROP VIEW IF EXISTS op_leads_rep CASCADE;");

    // 2. Intentamos borrarla si es una TABLA (por si acaso)
    await client.query("DROP TABLE IF EXISTS op_leads_rep CASCADE;");

    console.log("✅ ¡Listo! Se ha eliminado correctamente.");
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    await client.end();
  }
}

limpiar();
