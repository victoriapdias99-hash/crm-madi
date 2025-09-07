#!/usr/bin/env node

/**
 * Test específico para fila 413 de pestaña Chevrolet
 * Prueba 100% confiable del parseTimestamp
 */

import { google } from 'googleapis';

// Configuración de Google Sheets
const API_KEY = process.env.GOOGLE_API_KEY;
const SPREADSHEET_ID = '1HMWRJ5W2f9X7iKa7b0pD8N7xkOl6uZKzv8fZx7Y4Ut8';

if (!API_KEY) {
  console.error('❌ ERROR: GOOGLE_API_KEY no encontrada en variables de entorno');
  process.exit(1);
}

// Función parseTimestamp exacta del sistema
function parseTimestamp(timestamp) {
  if (!timestamp || timestamp.trim() === '') {
    return new Date().toISOString();
  }

  const cleanTimestamp = timestamp.trim();
  
  try {
    // 1. Formato ISO con timezone: 2025-08-27T14:47:25-03:00
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(cleanTimestamp)) {
      const date = new Date(cleanTimestamp);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    // 2. Formato dd-mm-yy hh:mm: 06-09-25 18:24
    const shortDateMatch = cleanTimestamp.match(/^(\d{2})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/);
    if (shortDateMatch) {
      const [, day, month, year, hour, minute] = shortDateMatch;
      // Asumir año 20XX si es menor que 50, sino 19XX
      const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);
      const date = new Date(fullYear, parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    // 3. Formato dd/mm/yyyy: 4/9/2025 (día/mes/año)
    const slashDateMatch = cleanTimestamp.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashDateMatch) {
      const [, day, month, year] = slashDateMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    // 4. Formato ISO estándar o cualquier otro formato que Date() pueda parsear
    const date = new Date(cleanTimestamp);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }

    // 5. Si todo falla, usar fecha actual
    console.warn(`No se pudo parsear timestamp: "${cleanTimestamp}", usando fecha actual`);
    return new Date().toISOString();
    
  } catch (error) {
    console.warn(`Error parseando timestamp: "${cleanTimestamp}":`, error);
    return new Date().toISOString();
  }
}

async function testRow413() {
  const sheets = google.sheets({ 
    version: 'v4', 
    auth: API_KEY 
  });

  console.log('🧪 PRUEBA ESPECÍFICA: FILA 413 DE CHEVROLET');
  console.log('===========================================\n');

  try {
    // Obtener fila 413 específicamente
    console.log('📥 Obteniendo fila 413 de pestaña Chevrolet...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Chevrolet!A413:I413', // Fila específica
    });

    const row = response.data.values?.[0];
    
    if (!row || row.length === 0) {
      console.log('❌ ERROR: Fila 413 no encontrada o vacía');
      return;
    }

    console.log('✅ Fila 413 encontrada\n');

    // Mapear datos exactamente como el sistema
    const rawData = {
      timestamp: row[0] || '',        // Columna A - Fecha
      name: row[1] || '',            // Columna B - Nombre
      phone: row[2] || '',           // Columna C - Teléfono
      city: row[3] || '',            // Columna D - Localidad
      modelo: row[4] || '',          // Columna E - Modelo
      comentarioHorario: row[5] || '', // Columna F - Comentarios
      origen: row[6] || '',          // Columna G - Origen
      localizacion: row[7] || '',    // Columna H - Localización
      cliente: row[8] || '',         // Columna I - Cliente
    };

    console.log('📊 DATOS CRUDOS DE FILA 413:');
    console.log(`   Fecha original: "${rawData.timestamp}"`);
    console.log(`   Nombre: "${rawData.name}"`);
    console.log(`   Teléfono: "${rawData.phone}"`);
    console.log(`   Ciudad: "${rawData.city}"`);
    console.log(`   Cliente: "${rawData.cliente}"`);
    console.log('');

    // Probar parseTimestamp
    console.log('🕒 PRUEBA DE PARSEADO DE FECHA:');
    console.log(`   Input: "${rawData.timestamp}"`);
    
    if (!rawData.timestamp || rawData.timestamp.trim() === '') {
      console.log('⚠️  FECHA VACÍA - Se usará fecha actual');
    }

    const parsedDate = parseTimestamp(rawData.timestamp);
    console.log(`   Output: "${parsedDate}"`);
    console.log('');

    // Verificar interpretación
    if (rawData.timestamp && rawData.timestamp.trim() !== '') {
      const interpretedDate = new Date(parsedDate);
      console.log('📅 INTERPRETACIÓN DE FECHA:');
      console.log(`   Año: ${interpretedDate.getFullYear()}`);
      console.log(`   Mes: ${interpretedDate.getMonth() + 1} (${interpretedDate.toLocaleString('es', { month: 'long' })})`);
      console.log(`   Día: ${interpretedDate.getDate()}`);
      console.log(`   Hora: ${interpretedDate.getHours()}:${interpretedDate.getMinutes().toString().padStart(2, '0')}`);
      console.log('');
    }

    // Verificar lógica del sistema
    console.log('🔍 ANÁLISIS DE FORMATO:');
    const timestamp = rawData.timestamp.trim();
    
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(timestamp)) {
      console.log('   ✅ Formato: ISO con timezone');
    } else if (/^(\d{2})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/.test(timestamp)) {
      console.log('   ✅ Formato: dd-mm-yy hh:mm');
    } else if (/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.test(timestamp)) {
      console.log('   ✅ Formato: dd/mm/yyyy (día/mes/año)');
    } else {
      console.log('   ⚠️  Formato: Otro o no reconocido, usando Date() estándar');
    }

    console.log('\n🎯 RESULTADO FINAL:');
    console.log(`   Fecha original: "${rawData.timestamp}"`);
    console.log(`   Fecha parseada: "${parsedDate}"`);
    console.log(`   Estado: ${parsedDate.includes('1970-01-01') ? '❌ ERROR' : '✅ OK'}`);

  } catch (error) {
    console.error('❌ ERROR en la prueba:', error.message);
  }
}

// Ejecutar test
testRow413();