import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const sheets = google.sheets('v4');
const auth = new google.auth.GoogleAuth({
  apiKey: process.env.GOOGLE_SHEETS_API_KEY,
});

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

const response = await sheets.spreadsheets.values.get({
  auth,
  spreadsheetId: SPREADSHEET_ID,
  range: 'Fiat!A2:Z',
});

const rows = response.data.values || [];

// Buscar el duplicado específico: 5491133927052
const matching = rows.filter(row => {
  const tel = row[2]?.toString().trim();
  return tel && tel.includes('5491133927052');
});

console.log('Buscando teléfono 5491133927052 en Fiat:');
console.log(`Encontrados: ${matching.length} registros\n`);

matching.forEach((row, idx) => {
  console.log(`Registro ${idx + 1}:`);
  console.log(`  Fila: ${rows.indexOf(row) + 2}`);
  console.log(`  Fecha: ${row[0]}`);
  console.log(`  Nombre: ${row[1]}`);
  console.log(`  Teléfono: ${row[2]}`);
  console.log('');
});

// Buscar otro: 5491135145315
const matching2 = rows.filter(row => {
  const tel = row[2]?.toString().trim();
  return tel && tel.includes('5491135145315');
});

console.log('Buscando teléfono 5491135145315 en Fiat:');
console.log(`Encontrados: ${matching2.length} registros\n`);

matching2.forEach((row, idx) => {
  console.log(`Registro ${idx + 1}:`);
  console.log(`  Fila: ${rows.indexOf(row) + 2}`);
  console.log(`  Fecha: ${row[0]}`);
  console.log(`  Nombre: ${row[1]}`);
  console.log(`  Teléfono: ${row[2]}`);
  console.log('');
});
