import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Client } = pg;

async function showDuplicates() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  console.log("EJEMPLOS DE DUPLICADOS REALES con sufijo -N");

  const duplicates = await client.query(`
    SELECT meta_lead_id, telefono, marca, nombre
    FROM op_lead
    WHERE meta_lead_id LIKE '%-%'
    ORDER BY meta_lead_id
    LIMIT 10
  `);

  console.log(`Total: ${duplicates.rowCount}`);

  duplicates.rows.forEach((row, i) => {
    console.log(`${i + 1}. ${row.meta_lead_id} | ${row.telefono} | ${row.nombre}`);
  });

  await client.end();
}

showDuplicates().catch(console.error);
