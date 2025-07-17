import axios from 'axios';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

export class FunctionalTester {
  private baseUrl: string;
  private results: TestResult[] = [];

  constructor(baseUrl: string = 'http://localhost:5000') {
    this.baseUrl = baseUrl;
  }

  async runAllTests(): Promise<TestResult[]> {
    this.results = [];
    
    console.log('🔍 Iniciando pruebas funcionales...\n');

    // Test 1: Verificar que la API de datos diarios funcione
    await this.testDatosDiariosAPI();
    
    // Test 2: Verificar actualización de CPL
    await this.testCPLUpdate();
    
    // Test 3: Verificar persistencia de CPL
    await this.testCPLPersistence();
    
    // Test 4: Verificar actualización de venta por campaña
    await this.testVentaUpdate();
    
    // Test 5: Verificar cálculos financieros
    await this.testFinancialCalculations();

    this.printResults();
    return this.results;
  }

  private async testDatosDiariosAPI(): Promise<void> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/dashboard/datos-diarios`);
      
      if (response.status === 200 && Array.isArray(response.data) && response.data.length > 0) {
        this.addResult('API Datos Diarios', true, `${response.data.length} registros obtenidos`);
      } else {
        this.addResult('API Datos Diarios', false, 'No se obtuvieron datos válidos');
      }
    } catch (error) {
      this.addResult('API Datos Diarios', false, error.message);
    }
  }

  private async testCPLUpdate(): Promise<void> {
    try {
      const testCPL = Math.floor(Math.random() * 1000) + 500; // Random CPL between 500-1500
      const testIndex = 0;
      
      const response = await axios.post(`${this.baseUrl}/api/dashboard/update-cpl`, {
        clienteIndex: testIndex,
        cpl: testCPL
      });
      
      if (response.status === 200 && response.data.success) {
        this.addResult('Actualización CPL', true, `CPL ${testCPL} guardado para cliente ${testIndex}`);
      } else {
        this.addResult('Actualización CPL', false, 'La respuesta no indica éxito');
      }
    } catch (error) {
      this.addResult('Actualización CPL', false, error.message);
    }
  }

  private async testCPLPersistence(): Promise<void> {
    try {
      // Primero guardamos un CPL específico
      const testCPL = 999;
      const testIndex = 1;
      
      await axios.post(`${this.baseUrl}/api/dashboard/update-cpl`, {
        clienteIndex: testIndex,
        cpl: testCPL
      });
      
      // Luego verificamos que se mantenga en los datos
      const response = await axios.get(`${this.baseUrl}/api/dashboard/datos-diarios`);
      
      if (response.data[testIndex] && response.data[testIndex].cpl === testCPL) {
        this.addResult('Persistencia CPL', true, `CPL ${testCPL} persistido correctamente`);
      } else {
        this.addResult('Persistencia CPL', false, `CPL no persistido. Esperado: ${testCPL}, Obtenido: ${response.data[testIndex]?.cpl || 'undefined'}`);
      }
    } catch (error) {
      this.addResult('Persistencia CPL', false, error.message);
    }
  }

  private async testVentaUpdate(): Promise<void> {
    try {
      const testVenta = Math.floor(Math.random() * 50000) + 10000; // Random venta between 10k-60k
      const testIndex = 2;
      
      const response = await axios.post(`${this.baseUrl}/api/dashboard/update-venta`, {
        clienteIndex: testIndex,
        venta: testVenta
      });
      
      if (response.status === 200 && response.data.success) {
        this.addResult('Actualización Venta', true, `Venta ${testVenta} guardada para cliente ${testIndex}`);
      } else {
        this.addResult('Actualización Venta', false, 'La respuesta no indica éxito');
      }
    } catch (error) {
      this.addResult('Actualización Venta', false, error.message);
    }
  }

  private async testFinancialCalculations(): Promise<void> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/dashboard/finanzas-data`);
      
      if (response.status === 200 && Array.isArray(response.data)) {
        // Verificar que los cálculos tengan las propiedades esperadas
        const firstRecord = response.data[0];
        if (firstRecord && 
            typeof firstRecord.totalInversion === 'number' &&
            typeof firstRecord.profit === 'number' &&
            typeof firstRecord.roi === 'number') {
          this.addResult('Cálculos Financieros', true, 'Cálculos financieros funcionando correctamente');
        } else {
          this.addResult('Cálculos Financieros', false, 'Estructura de datos financieros incorrecta');
        }
      } else {
        this.addResult('Cálculos Financieros', false, 'No se obtuvieron datos de finanzas');
      }
    } catch (error) {
      this.addResult('Cálculos Financieros', false, error.message);
    }
  }

  private addResult(name: string, passed: boolean, details?: string): void {
    this.results.push({
      name,
      passed,
      details
    });
  }

  private printResults(): void {
    console.log('\n📊 RESULTADOS DE PRUEBAS FUNCIONALES\n');
    console.log('=====================================');
    
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    
    this.results.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.name}`);
      if (result.details) {
        console.log(`   → ${result.details}`);
      }
    });
    
    console.log('\n=====================================');
    console.log(`📈 RESUMEN: ${passed}/${total} pruebas pasaron`);
    
    if (passed === total) {
      console.log('🎉 ¡Todas las pruebas pasaron exitosamente!');
    } else {
      console.log('⚠️  Algunas pruebas fallaron. Revisar implementación.');
    }
    console.log('=====================================\n');
  }

  async testSpecificFeature(featureName: string, testFunction: () => Promise<void>): Promise<boolean> {
    try {
      await testFunction();
      this.addResult(featureName, true);
      return true;
    } catch (error) {
      this.addResult(featureName, false, error.message);
      return false;
    }
  }
}

// Función para ejecutar pruebas desde la línea de comandos
export async function runTests() {
  const tester = new FunctionalTester();
  const results = await tester.runAllTests();
  
  const allPassed = results.every(r => r.passed);
  process.exit(allPassed ? 0 : 1);
}

// Si se ejecuta directamente
// Auto-run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}