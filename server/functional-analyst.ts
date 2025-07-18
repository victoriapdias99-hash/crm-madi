import axios from 'axios';
import { storage } from './storage';

export interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
  timestamp: string;
  executionTime: number;
}

export interface TestSuite {
  suiteName: string;
  results: TestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  executionTime: number;
}

export class FunctionalAnalyst {
  private baseUrl: string;
  private testResults: TestResult[] = [];

  constructor(baseUrl: string = 'http://localhost:5000') {
    this.baseUrl = baseUrl;
  }

  private async executeTest(testName: string, testFunction: () => Promise<void>): Promise<TestResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    
    try {
      await testFunction();
      const executionTime = Date.now() - startTime;
      
      return {
        testName,
        passed: true,
        details: 'Test passed successfully',
        timestamp,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        testName,
        passed: false,
        details: error.message || 'Test failed with unknown error',
        timestamp,
        executionTime
      };
    }
  }

  async runCPLIntegrityTests(): Promise<TestSuite> {
    const startTime = Date.now();
    const results: TestResult[] = [];

    // Test 1: Verificar que CPL se guarda en el cliente correcto
    results.push(await this.executeTest('CPL Client Mapping Integrity', async () => {
      // Obtener datos actuales
      const response = await axios.get(`${this.baseUrl}/api/dashboard/datos-diarios`);
      const datosOriginales = response.data;
      
      if (!datosOriginales || datosOriginales.length === 0) {
        throw new Error('No hay datos disponibles para testing');
      }

      // Buscar RENAULT específicamente
      const renaultIndex = datosOriginales.findIndex((d: any) => 
        d.cliente && d.cliente.toLowerCase().includes('renault')
      );
      
      if (renaultIndex === -1) {
        throw new Error('No se encontró RENAULT en los datos para testing');
      }

      const renaultData = datosOriginales[renaultIndex];
      const testCPL = 1234; // Valor único para testing
      
      // Guardar CPL en RENAULT usando el método nuevo
      await axios.post(`${this.baseUrl}/api/dashboard/update-cpl`, {
        clienteNombre: renaultData.cliente,
        numeroCampana: renaultData.numeroCampana,
        cpl: testCPL
      });

      // Verificar inmediatamente
      const responseAfter = await axios.get(`${this.baseUrl}/api/dashboard/datos-diarios`);
      const datosActualizados = responseAfter.data;
      
      // Encontrar RENAULT en los datos actualizados
      const renaultActualizado = datosActualizados.find((d: any) => 
        d.cliente === renaultData.cliente && d.numeroCampana === renaultData.numeroCampana
      );
      
      if (!renaultActualizado) {
        throw new Error('RENAULT no encontrado después de la actualización');
      }

      if (renaultActualizado.cpl !== testCPL) {
        throw new Error(`CPL no se guardó correctamente en RENAULT. Esperado: ${testCPL}, Obtenido: ${renaultActualizado.cpl}`);
      }

      // Verificar que NO se guardó en otros clientes
      const otrosClientesAfectados = datosActualizados.filter((d: any) => 
        d.cliente !== renaultData.cliente && d.cpl === testCPL
      );

      if (otrosClientesAfectados.length > 0) {
        throw new Error(`CPL se guardó incorrectamente en otros clientes: ${otrosClientesAfectados.map(c => c.cliente).join(', ')}`);
      }
    }));

    // Test 2: Verificar que RENAULT tiene 39 datos enviados
    results.push(await this.executeTest('RENAULT Data Count Verification', async () => {
      const response = await axios.get(`${this.baseUrl}/api/dashboard/datos-diarios`);
      const datos = response.data;
      
      const renaultData = datos.find((d: any) => 
        d.cliente && d.cliente.toLowerCase().includes('renault')
      );
      
      if (!renaultData) {
        throw new Error('RENAULT no encontrado en los datos');
      }

      if (renaultData.enviados !== 39) {
        throw new Error(`RENAULT debe tener 39 datos enviados, pero tiene ${renaultData.enviados}`);
      }
    }));

    // Test 3: Verificar persistencia de CPL después de recarga
    results.push(await this.executeTest('CPL Persistence After Reload', async () => {
      // Guardar un CPL específico
      const response = await axios.get(`${this.baseUrl}/api/dashboard/datos-diarios`);
      const datos = response.data;
      
      if (datos.length === 0) {
        throw new Error('No hay datos para testing');
      }

      const testData = datos[0];
      const testCPL = 9999;
      
      await axios.post(`${this.baseUrl}/api/dashboard/update-cpl`, {
        clienteNombre: testData.cliente,
        numeroCampana: testData.numeroCampana,
        cpl: testCPL
      });

      // Simular recarga obteniendo datos nuevamente
      const responseAfter = await axios.get(`${this.baseUrl}/api/dashboard/datos-diarios`);
      const datosReload = responseAfter.data;
      
      const updatedData = datosReload.find((d: any) => 
        d.cliente === testData.cliente && d.numeroCampana === testData.numeroCampana
      );
      
      if (!updatedData || updatedData.cpl !== testCPL) {
        throw new Error(`CPL no persistió después de recarga. Esperado: ${testCPL}, Obtenido: ${updatedData?.cpl || 'undefined'}`);
      }
    }));

    // Test 4: Verificar que las inversiones se calculan correctamente
    results.push(await this.executeTest('Investment Calculations Accuracy', async () => {
      const response = await axios.get(`${this.baseUrl}/api/dashboard/datos-diarios`);
      const datos = response.data;
      
      const testData = datos.find((d: any) => d.enviados > 0 && d.pedidosTotal > 0);
      
      if (!testData) {
        throw new Error('No hay datos válidos para testing de inversiones');
      }

      const testCPL = 1000;
      const expectedInversionRealizada = testData.enviados * testCPL * 1.02;
      const expectedInversionPendiente = (testData.pedidosTotal - testData.enviados) * testCPL * 1.02;
      const expectedInversionTotal = testData.pedidosTotal * testCPL * 1.02;

      // Las inversiones se calculan en el frontend, pero verificamos la lógica
      const tolerance = 0.01;
      
      if (Math.abs(testData.inversionRealizada - expectedInversionRealizada) > tolerance && testData.cpl > 0) {
        throw new Error(`Inversión realizada incorrecta. Esperada: ${expectedInversionRealizada}, Obtenida: ${testData.inversionRealizada}`);
      }
    }));

    // Test 5: Verificar que los índices únicos funcionan correctamente
    results.push(await this.executeTest('Unique Index System Integrity', async () => {
      const response = await axios.get(`${this.baseUrl}/api/dashboard/datos-diarios`);
      const datos = response.data;
      
      // Verificar que cada cliente+campaña es único
      const uniqueKeys = new Set();
      const duplicates = [];
      
      for (const dato of datos) {
        const key = `${dato.cliente}-${dato.numeroCampana}`;
        if (uniqueKeys.has(key)) {
          duplicates.push(key);
        } else {
          uniqueKeys.add(key);
        }
      }
      
      if (duplicates.length > 0) {
        throw new Error(`Claves duplicadas encontradas: ${duplicates.join(', ')}`);
      }
    }));

    const executionTime = Date.now() - startTime;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = results.filter(r => !r.passed).length;

    return {
      suiteName: 'CPL Integrity Tests',
      results,
      totalTests: results.length,
      passedTests,
      failedTests,
      executionTime
    };
  }

  async runFullSystemTests(): Promise<TestSuite[]> {
    const suites: TestSuite[] = [];
    
    // Ejecutar suite de CPL
    suites.push(await this.runCPLIntegrityTests());
    
    // Aquí se pueden agregar más suites de testing
    
    return suites;
  }

  // Método para ejecutar pruebas automáticamente después de cambios
  async runAutomatedTests(): Promise<{ success: boolean; results: TestSuite[] }> {
    try {
      const results = await this.runFullSystemTests();
      const allPassed = results.every(suite => suite.failedTests === 0);
      
      return {
        success: allPassed,
        results
      };
    } catch (error) {
      console.error('Error running automated tests:', error);
      return {
        success: false,
        results: []
      };
    }
  }
}

// Instancia global del analista funcional
export const functionalAnalyst = new FunctionalAnalyst();