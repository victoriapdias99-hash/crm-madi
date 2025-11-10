# Frontend Components - Campaign Closure

## 📱 Descripción General

Este documento describe los componentes React y hooks personalizados disponibles para integrar el sistema de cierre de campañas en el frontend.

## 🏗️ Arquitectura Frontend

```
client/src/
├── components/ui/
│   └── campaign-closure-progress.tsx    # Componente de progreso visual
└── hooks/
    └── use-campaign-closure-progress.tsx # Hook para WebSocket tracking
```

---

## 📦 Componentes

### CampaignClosureProgress

Componente React que muestra el progreso de cierre de una campaña en tiempo real con conexión WebSocket.

**Ubicación**: `client/src/components/ui/campaign-closure-progress.tsx`

#### Props

```typescript
interface CampaignClosureProgressProps {
  campaignKey?: string;        // Key única de la campaña (ej: "red_finance-1")
  onComplete?: () => void;     // Callback cuando se completa el cierre
  onError?: (error: string) => void;  // Callback cuando hay error
  className?: string;          // Clases CSS adicionales
}
```

#### Comportamiento

- **Muestra solo cuando está procesando**: Si no hay `campaignKey` o no está procesando, retorna `null`
- **Posición fija**: Bottom-right de la pantalla (fixed position)
- **Auto-oculta**: Se oculta después de completar o error
- **Invalidación de cache**: Automáticamente invalida queries de React Query al completar

#### Estados Visuales

1. **Procesando** (progress < 100):
   - Icono: Loader animado (spinning)
   - Color: Azul
   - Barra de progreso animada
   - Indicadores de fase (5 barras)

2. **Completado** (progress = 100):
   - Icono: CheckCircle
   - Color: Verde
   - Mensaje de éxito

3. **Error** (hasError = true):
   - Icono: XCircle
   - Color: Rojo
   - Mensaje de error en recuadro rojo

#### Ejemplo de Uso

```typescript
import { CampaignClosureProgress } from '@/components/ui/campaign-closure-progress';

function CampaignDashboard() {
  const [campaignKey, setCampaignKey] = useState<string | undefined>();

  const handleCloseCampaign = async (campaignId: number) => {
    // Generar key única
    const key = `campaign-${campaignId}-${Date.now()}`;
    setCampaignKey(key);

    // Ejecutar cierre con la key
    await fetch('/api/campaign-closure/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignNumber: campaignId,
        campaignKey: key
      })
    });
  };

  const handleComplete = () => {
    console.log('Campaña cerrada exitosamente!');
    setCampaignKey(undefined);
    // Refrescar datos
  };

  const handleError = (error: string) => {
    console.error('Error al cerrar campaña:', error);
    setCampaignKey(undefined);
  };

  return (
    <div>
      <button onClick={() => handleCloseCampaign(38)}>
        Cerrar Campaña
      </button>

      {/* Componente de progreso */}
      <CampaignClosureProgress
        campaignKey={campaignKey}
        onComplete={handleComplete}
        onError={handleError}
      />
    </div>
  );
}
```

#### Estructura Visual

```
┌─────────────────────────────────────────────────────┐
│  [Icon] Cerrando campaña...                         │
│         red_finance-1                               │
│                                                     │
│  ████████████████████░░░░░░░  75%                   │
│  Asignando leads: 75/100                           │
│                                                     │
│  ██████  ██████  ██████  ██████  ░░░░░░            │
│  (Indicadores de fase)                             │
└─────────────────────────────────────────────────────┘
```

#### Fases Visuales

Los 5 indicadores de fase representan:

| Fase | Progress | Color | Descripción |
|------|----------|-------|-------------|
| 1 | 0-20% | Azul | Iniciando |
| 2 | 20-40% | Azul | Obteniendo leads |
| 3 | 40-60% | Azul | Asignando (parte 1) |
| 4 | 60-80% | Azul | Asignando (parte 2) |
| 5 | 80-100% | Verde | Finalizando |

#### Código del Componente

```typescript
// client/src/components/ui/campaign-closure-progress.tsx (líneas 17-112)
export function CampaignClosureProgress({
  campaignKey,
  onComplete,
  onError,
  className = ""
}: CampaignClosureProgressProps) {
  const { progress, message, isProcessing, hasError, error } = useCampaignClosureProgress(
    campaignKey,
    {
      onComplete,
      onError,
      showToast: true
    }
  );

  // No mostrar nada si no hay campaignKey
  if (!campaignKey) {
    return null;
  }

  // No mostrar nada si no está procesando y no hay error
  if (!isProcessing && !hasError) {
    return null;
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      <Card className="w-96 shadow-lg border-2">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            {/* Icono según estado */}
            <div className="flex-shrink-0 mt-1">
              {hasError ? (
                <XCircle className="h-6 w-6 text-red-500" />
              ) : progress === 100 ? (
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              ) : (
                <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
              )}
            </div>

            {/* Contenido */}
            <div className="flex-1 space-y-3">
              {/* Título */}
              <div>
                <h3 className="font-semibold text-sm">
                  {hasError ? "Error al cerrar campaña" :
                   progress === 100 ? "Campaña cerrada exitosamente" :
                   "Cerrando campaña..."}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {campaignKey}
                </p>
              </div>

              {/* Mensaje de progreso o error */}
              {hasError ? (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              ) : (
                <>
                  {/* Barra de progreso */}
                  <div className="space-y-2">
                    <Progress value={progress} className="h-2" />
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">{message}</p>
                      <span className="text-xs font-medium text-muted-foreground">
                        {progress}%
                      </span>
                    </div>
                  </div>

                  {/* Indicadores de fase */}
                  {progress < 100 && (
                    <div className="grid grid-cols-5 gap-1">
                      <div className={`h-1 rounded ${progress >= 20 ? 'bg-blue-500' : 'bg-gray-200'}`} />
                      <div className={`h-1 rounded ${progress >= 40 ? 'bg-blue-500' : 'bg-gray-200'}`} />
                      <div className={`h-1 rounded ${progress >= 60 ? 'bg-blue-500' : 'bg-gray-200'}`} />
                      <div className={`h-1 rounded ${progress >= 80 ? 'bg-blue-500' : 'bg-gray-200'}`} />
                      <div className={`h-1 rounded ${progress >= 100 ? 'bg-green-500' : 'bg-gray-200'}`} />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 🪝 Hooks

### useCampaignClosureProgress

Hook personalizado que se conecta al WebSocket para recibir actualizaciones de progreso en tiempo real.

**Ubicación**: `client/src/hooks/use-campaign-closure-progress.tsx`

#### Signature

```typescript
function useCampaignClosureProgress(
  campaignKey?: string,
  options?: {
    onComplete?: () => void;
    onError?: (error: string) => void;
    showToast?: boolean;
  }
): CampaignClosureProgress
```

#### Parámetros

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `campaignKey` | `string \| undefined` | Key única de la campaña para tracking |
| `options.onComplete` | `() => void` | Callback cuando el progreso llega a 100% |
| `options.onError` | `(error: string) => void` | Callback cuando hay error |
| `options.showToast` | `boolean` | Mostrar toasts de éxito/error (default: true) |

#### Return Value

```typescript
interface CampaignClosureProgress {
  progress: number;          // 0-100
  message: string;           // Mensaje descriptivo
  isProcessing: boolean;     // true si está en proceso
  hasError: boolean;         // true si hubo error
  error: string | null;      // Mensaje de error
}
```

#### Comportamiento

1. **Conexión automática**: Se conecta al WebSocket cuando hay `campaignKey`
2. **Reconexión automática**: Reintenta conexión si falla (delay de 2 segundos)
3. **Invalidación de cache**: Invalida queries de React Query al completar:
   - `/api/campanas-comerciales`
   - `/api/dashboard/datos-diarios-db`
   - `/api/dashboard/datos-diarios`
   - `/api/dashboard`
4. **Limpieza**: Cierra conexión al desmontar componente
5. **Toast notifications**: Muestra toasts de shadcn/ui para éxito/error

#### Eventos WebSocket Manejados

**Progreso**:
```typescript
{
  type: 'campaign-progress',
  campaignKey: 'red_finance-1',
  progress: 75,
  message: 'Asignando leads: 75/100',
  timestamp: '2025-01-15T12:00:00.000Z'
}
```

**Error**:
```typescript
{
  type: 'campaign-error',
  campaignKey: 'red_finance-1',
  error: 'Timeout: Asignación tardó más de 30 segundos',
  timestamp: '2025-01-15T12:00:00.000Z'
}
```

#### Ejemplo de Uso

```typescript
import { useCampaignClosureProgress } from '@/hooks/use-campaign-closure-progress';

function CustomProgressDisplay({ campaignKey }: { campaignKey?: string }) {
  const { progress, message, isProcessing, hasError, error } = useCampaignClosureProgress(
    campaignKey,
    {
      onComplete: () => {
        console.log('✅ Campaña cerrada!');
        // Refrescar datos, mostrar modal, etc.
      },
      onError: (err) => {
        console.error('❌ Error:', err);
        // Mostrar modal de error, etc.
      },
      showToast: true  // Mostrar toasts automáticos
    }
  );

  if (!isProcessing && !hasError) {
    return null;
  }

  return (
    <div className="progress-container">
      {hasError ? (
        <div className="error">
          <p>Error: {error}</p>
        </div>
      ) : (
        <div className="processing">
          <p>{message}</p>
          <progress value={progress} max={100} />
          <span>{progress}%</span>
        </div>
      )}
    </div>
  );
}
```

#### Código del Hook

```typescript
// client/src/hooks/use-campaign-closure-progress.tsx (líneas 32-206)
export function useCampaignClosureProgress(
  campaignKey?: string,
  options: {
    onComplete?: () => void;
    onError?: (error: string) => void;
    showToast?: boolean;
  } = {}
): CampaignClosureProgress {
  const { onComplete, onError, showToast = true } = options;

  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const connect = useCallback(() => {
    if (!campaignKey) return;

    // Limpiar conexión previa si existe
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      console.log(`📡 Conectando WebSocket para monitorear campaña: ${campaignKey}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`✅ WebSocket conectado para campaña: ${campaignKey}`);

        // Registrarse para recibir eventos de progreso de esta campaña
        ws.send(JSON.stringify({
          type: 'register_campaign_progress',
          campaignKey: campaignKey
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Evento de progreso
          if (data.type === 'campaign-progress' && data.campaignKey === campaignKey) {
            console.log(`📊 Progreso ${campaignKey}: ${data.progress}% - ${data.message}`);

            setProgress(data.progress);
            setMessage(data.message);
            setIsProcessing(data.progress < 100);
            setHasError(false);
            setError(null);

            // Cuando llegue al 100%, es que completó exitosamente
            if (data.progress === 100) {
              console.log(`✅ Campaña ${campaignKey} completada exitosamente`);

              if (showToast) {
                toast({
                  title: "✅ Campaña cerrada exitosamente",
                  description: data.message,
                  variant: "default",
                });
              }

              // Invalidar queries después de un momento para que el backend termine
              setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['/api/campanas-comerciales'] });
                queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios-db'] });
                queryClient.invalidateQueries({ queryKey: ['/api/dashboard/datos-diarios'] });
                queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
              }, 1000);

              // Llamar callback de completado
              if (onComplete) {
                onComplete();
              }

              // Desconectar después de completar
              setTimeout(() => {
                ws.close();
              }, 2000);
            }
          }

          // Evento de error
          if (data.type === 'campaign-error' && data.campaignKey === campaignKey) {
            console.error(`❌ Error en campaña ${campaignKey}: ${data.error}`);

            setProgress(0);
            setMessage('');
            setIsProcessing(false);
            setHasError(true);
            setError(data.error);

            if (showToast) {
              toast({
                title: "❌ Error al cerrar campaña",
                description: data.error,
                variant: "destructive",
              });
            }

            // Llamar callback de error
            if (onError) {
              onError(data.error);
            }

            // Desconectar después de error
            setTimeout(() => {
              ws.close();
            }, 2000);
          }

        } catch (error) {
          console.error('❌ Error parseando mensaje WebSocket:', error);
        }
      };

      ws.onclose = (event) => {
        console.log(`🔌 WebSocket desconectado para campaña ${campaignKey}`);

        // Si no fue un cierre intencional y aún está procesando, reintentar
        if (event.code !== 1000 && isProcessing) {
          console.log('🔄 Reintentando conexión en 2 segundos...');
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 2000);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ Error en WebSocket:', error);
      };

    } catch (error) {
      console.error('❌ Error creando WebSocket:', error);
    }
  }, [campaignKey, isProcessing, onComplete, onError, showToast, toast, queryClient]);

  // Conectar cuando hay un campaignKey
  useEffect(() => {
    if (campaignKey) {
      connect();
      setIsProcessing(true);
    }

    // Cleanup al desmontar o cuando cambia campaignKey
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Componente desmontado');
      }
    };
  }, [campaignKey, connect]);

  return {
    progress,
    message,
    isProcessing,
    hasError,
    error
  };
}
```

---

## 🔗 Integración con Backend

### Flujo Completo

```
1. Usuario hace clic en "Cerrar Campaña"
   ↓
2. Frontend genera campaignKey única
   ↓
3. Frontend ejecuta POST /api/campaign-closure/execute
   con campaignKey en body
   ↓
4. Frontend monta componente CampaignClosureProgress
   ↓
5. Hook useCampaignClosureProgress se conecta al WebSocket
   ↓
6. Backend emite eventos de progreso vía WebSocket
   ↓
7. Hook recibe eventos y actualiza estado
   ↓
8. Componente renderiza progreso visual
   ↓
9. Al llegar a 100%, hook invalida cache y ejecuta callback
   ↓
10. Componente muestra éxito y se oculta después de 2 segundos
```

### Ejemplo de Integración Completa

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CampaignClosureProgress } from '@/components/ui/campaign-closure-progress';
import { useToast } from '@/hooks/use-toast';

interface Campaign {
  id: number;
  clientName: string;
  campaignNumber: string;
  targetLeads: number;
  currentLeads: number;
}

function CampaignRow({ campaign }: { campaign: Campaign }) {
  const [campaignKey, setCampaignKey] = useState<string | undefined>();
  const [isClosing, setIsClosing] = useState(false);
  const { toast } = useToast();

  const handleCloseCampaign = async () => {
    try {
      setIsClosing(true);

      // Generar key única para tracking
      const key = `${campaign.clientName.toLowerCase().replace(/\s+/g, '_')}-${campaign.campaignNumber}-${Date.now()}`;
      setCampaignKey(key);

      // Ejecutar cierre
      const response = await fetch('/api/campaign-closure/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientName: campaign.clientName,
          campaignNumber: campaign.campaignNumber,
          campaignKey: key
        })
      });

      if (!response.ok) {
        throw new Error('Error al iniciar cierre de campaña');
      }

      console.log('Cierre iniciado, esperando progreso vía WebSocket...');

    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error al cerrar campaña",
        description: error.message,
        variant: "destructive"
      });
      setIsClosing(false);
      setCampaignKey(undefined);
    }
  };

  const handleComplete = () => {
    console.log('✅ Campaña cerrada exitosamente');
    setIsClosing(false);
    setCampaignKey(undefined);
    // Refrescar datos del dashboard
  };

  const handleError = (error: string) => {
    console.error('❌ Error:', error);
    setIsClosing(false);
    setCampaignKey(undefined);
  };

  const canClose = campaign.currentLeads >= campaign.targetLeads;

  return (
    <>
      <tr>
        <td>{campaign.clientName}</td>
        <td>{campaign.campaignNumber}</td>
        <td>{campaign.currentLeads} / {campaign.targetLeads}</td>
        <td>
          <Button
            onClick={handleCloseCampaign}
            disabled={isClosing || !canClose}
          >
            {isClosing ? 'Cerrando...' : 'Cerrar Campaña'}
          </Button>
        </td>
      </tr>

      {/* Componente de progreso global (bottom-right) */}
      <CampaignClosureProgress
        campaignKey={campaignKey}
        onComplete={handleComplete}
        onError={handleError}
      />
    </>
  );
}

export default CampaignRow;
```

---

## 🎨 Estilos y Personalización

### Clases CSS

El componente `CampaignClosureProgress` usa Tailwind CSS con las siguientes clases principales:

```css
.fixed           /* Posición fija */
.bottom-4        /* 16px desde abajo */
.right-4         /* 16px desde derecha */
.z-50            /* Z-index alto */
.w-96            /* Ancho de 384px */
.shadow-lg       /* Sombra grande */
```

### Personalizar Posición

```typescript
// Cambiar a top-left
<CampaignClosureProgress
  campaignKey={key}
  className="!top-4 !left-4 !bottom-auto !right-auto"
/>

// Cambiar a center
<CampaignClosureProgress
  campaignKey={key}
  className="!top-1/2 !left-1/2 !-translate-x-1/2 !-translate-y-1/2 !bottom-auto !right-auto"
/>
```

### Personalizar Ancho

```typescript
<CampaignClosureProgress
  campaignKey={key}
  className="!w-[500px]"  // Más ancho
/>
```

### Tema Oscuro

El componente usa clases de shadcn/ui que soportan modo oscuro automáticamente:

```typescript
// El tema se aplica automáticamente según:
// <html class="dark">
```

---

## 🧪 Testing

### Test del Hook

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useCampaignClosureProgress } from '@/hooks/use-campaign-closure-progress';

describe('useCampaignClosureProgress', () => {
  it('should connect to WebSocket when campaignKey is provided', async () => {
    const { result } = renderHook(() =>
      useCampaignClosureProgress('test-campaign-1')
    );

    await waitFor(() => {
      expect(result.current.isProcessing).toBe(true);
    });
  });

  it('should call onComplete when progress reaches 100%', async () => {
    const onComplete = jest.fn();

    const { result } = renderHook(() =>
      useCampaignClosureProgress('test-campaign-1', { onComplete })
    );

    // Simular mensaje WebSocket
    // ... (mock WebSocket)

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });
  });
});
```

### Test del Componente

```typescript
import { render, screen } from '@testing-library/react';
import { CampaignClosureProgress } from '@/components/ui/campaign-closure-progress';

describe('CampaignClosureProgress', () => {
  it('should render nothing when no campaignKey', () => {
    const { container } = render(<CampaignClosureProgress />);
    expect(container.firstChild).toBeNull();
  });

  it('should render progress bar when processing', async () => {
    render(<CampaignClosureProgress campaignKey="test-1" />);

    await waitFor(() => {
      expect(screen.getByText('Cerrando campaña...')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });
});
```

---

## 🔍 Debugging

### Habilitar Logs Detallados

Los logs están habilitados por defecto en el hook:

```typescript
console.log(`📡 Conectando WebSocket para monitorear campaña: ${campaignKey}`);
console.log(`✅ WebSocket conectado para campaña: ${campaignKey}`);
console.log(`📊 Progreso ${campaignKey}: ${data.progress}% - ${data.message}`);
console.log(`✅ Campaña ${campaignKey} completada exitosamente`);
console.error(`❌ Error en campaña ${campaignKey}: ${data.error}`);
```

### Verificar Conexión WebSocket

```javascript
// En DevTools Console
const ws = new WebSocket('ws://localhost:5000/ws');

ws.onopen = () => {
  console.log('Conectado!');
  ws.send(JSON.stringify({
    type: 'register_campaign_progress',
    campaignKey: 'red_finance-1'
  }));
};

ws.onmessage = (event) => {
  console.log('Mensaje recibido:', JSON.parse(event.data));
};
```

### Problemas Comunes

#### WebSocket no se conecta

**Síntoma**: No aparece el progreso

**Solución**:
1. Verificar que el servidor WebSocket esté corriendo
2. Verificar que el puerto sea correcto (5000)
3. Verificar que no haya CORS bloqueando WebSocket

#### Progreso no se actualiza

**Síntoma**: Componente se muestra pero no cambia

**Solución**:
1. Verificar que `campaignKey` esté llegando al backend
2. Verificar logs del servidor para eventos WebSocket
3. Verificar que el registro sea exitoso (mensaje `register_campaign_progress`)

#### Queries no se invalidan

**Síntoma**: Dashboard no se actualiza después de cerrar

**Solución**:
1. Verificar que React Query esté configurado
2. Verificar que los query keys sean correctos
3. Esperar 1 segundo después de completar (delay intencional)

---

## 📝 Notas Importantes

### CampaignKey Format

La `campaignKey` debe ser única para cada operación de cierre:

```typescript
// ✅ CORRECTO
const key = `${clientName.toLowerCase().replace(/\s+/g, '_')}-${campaignNumber}-${Date.now()}`;
// Ejemplo: "red_finance-1-1705329600000"

// ❌ INCORRECTO (no único)
const key = `${clientName}-${campaignNumber}`;
// Si se cierra 2 veces, usará la misma key
```

### Memory Leaks

El hook limpia correctamente las conexiones:

```typescript
// Cleanup automático
useEffect(() => {
  // ...
  return () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'Componente desmontado');
    }
  };
}, [campaignKey, connect]);
```

### Performance

- **Una sola conexión WebSocket por campaignKey**: No múltiples conexiones
- **Reconexión inteligente**: Solo reintenta si está procesando
- **Auto-desconexión**: Cierra después de completar o error

---

## 🚀 Roadmap

### Features Planeadas

- [ ] Modo compacto (solo barra de progreso)
- [ ] Soporte para múltiples campañas simultáneas
- [ ] Historial de cierres recientes
- [ ] Cancelar cierre en progreso
- [ ] Estimación de tiempo restante
- [ ] Notificaciones de escritorio (Notification API)

### Mejoras de UX

- [ ] Animaciones más suaves
- [ ] Sonido al completar (opcional)
- [ ] Modo picture-in-picture
- [ ] Guardar estado en localStorage

---

**Versión**: 1.0.0
**Fecha**: 2025-01-15
**Mantenido por**: Equipo Frontend CRM MADI
