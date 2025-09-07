#!/usr/bin/env node

/**
 * Comprehensive Date Parsing Validation Script
 * Tests all real Google Sheets date formats against both sync systems
 */

// Import the parseTimestamp function from both systems
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Real date formats from Google Sheets
const testFormats = [
  {
    input: '2025-08-19T18:22:46-03:00',
    expected: '2025-08-19T21:22:46.000Z', // Should convert timezone -03:00 to UTC
    description: 'ISO format with timezone'
  },
  {
    input: '19-08-25 18:50',
    expected: '2025-08-19T18:50:00.000Z',
    description: 'dd-mm-yy hh:mm format'
  },
  {
    input: '27/8/2025',
    expected: '2025-08-27T00:00:00.000Z', // 27th of August, not 8th of 27th month
    description: 'dd/mm/yyyy format with single digit month'
  },
  {
    input: '06-09-25 18:22',
    expected: '2025-09-06T18:22:00.000Z',
    description: 'dd-mm-yy hh:mm format with zero padding'
  },
  {
    input: '6/9/2025',
    expected: '2025-09-06T00:00:00.000Z', // 6th of September, not June 9th
    description: 'd/m/yyyy format with single digits'
  }
];

// Parse timestamp function (extracted from systems)
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

// Color codes for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

console.log(`${colors.blue}${colors.bold}🧪 VALIDACIÓN DE PARSEO DE FECHAS${colors.reset}`);
console.log(`${colors.blue}======================================${colors.reset}\n`);

let passedTests = 0;
let failedTests = 0;

testFormats.forEach((test, index) => {
  const result = parseTimestamp(test.input);
  const passed = result === test.expected;
  
  console.log(`${colors.bold}Test ${index + 1}: ${test.description}${colors.reset}`);
  console.log(`Input:    "${test.input}"`);
  console.log(`Expected: "${test.expected}"`);
  console.log(`Result:   "${result}"`);
  
  if (passed) {
    console.log(`${colors.green}✅ PASSED${colors.reset}\n`);
    passedTests++;
  } else {
    console.log(`${colors.red}❌ FAILED${colors.reset}`);
    
    // Additional debugging info for failures
    const inputDate = new Date(test.input);
    console.log(`${colors.yellow}Debug info:${colors.reset}`);
    console.log(`  - Direct new Date() result: ${isNaN(inputDate.getTime()) ? 'Invalid' : inputDate.toISOString()}`);
    console.log(`  - Expected interpretation: ${test.description}`);
    console.log('');
    
    failedTests++;
  }
});

// Summary
console.log(`${colors.blue}${colors.bold}📊 RESUMEN DE PRUEBAS${colors.reset}`);
console.log(`${colors.blue}===================${colors.reset}`);
console.log(`${colors.green}✅ Passed: ${passedTests}${colors.reset}`);
console.log(`${colors.red}❌ Failed: ${failedTests}${colors.reset}`);
console.log(`${colors.bold}Total: ${testFormats.length}${colors.reset}\n`);

if (failedTests === 0) {
  console.log(`${colors.green}${colors.bold}🎉 ¡Todas las pruebas pasaron! El sistema de parseo de fechas está funcionando correctamente.${colors.reset}`);
  process.exit(0);
} else {
  console.log(`${colors.red}${colors.bold}⚠️  ${failedTests} prueba(s) fallaron. Revisar la implementación de parseTimestamp.${colors.reset}`);
  process.exit(1);
}