import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useCampaignClosureProgress } from "@/hooks/use-campaign-closure-progress";

interface CampaignClosureProgressProps {
  campaignKey?: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

/**
 * Componente que muestra el progreso de cierre de una campaña en tiempo real
 * Se conecta por WebSocket y actualiza automáticamente
 */
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
                  {hasError ? (
                    "Error al cerrar campaña"
                  ) : progress === 100 ? (
                    "Campaña cerrada exitosamente"
                  ) : (
                    "Cerrando campaña..."
                  )}
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
