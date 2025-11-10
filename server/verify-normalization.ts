import { normalizeClientName } from '../shared/utils/client-normalization';

console.log('🔍 VERIFICACIÓN DE NORMALIZACIÓN\n');

const tests = [
  'Red Finance',
  'red finance',
  'RED FINANCE',
  'Red - Finance',
  'red_finance',
  'TOYOTA # #Mariano Pichetti',
  null,
  ''
];

console.log('Probando función normalizeClientName:\n');

tests.forEach(test => {
  const result = normalizeClientName(test);
  console.log(`   Input: "${test}" → Output: "${result}"`);
});

console.log('\n✅ Resultado esperado para "Red Finance": "red_finance"');
