import { Badge } from "@/components/ui/badge";
import { extractBrandsFromCampaign, type BrandInfo } from "@shared/utils/multi-brand-utils";

interface ExtendedBrandInfo extends BrandInfo {
  zona?: string;
}

interface BrandDisplayProps {
  /** Datos de la campaña para extraer marcas */
  campaignData?: any;
  /** Marcas ya procesadas (alternativa a campaignData) */
  brands?: ExtendedBrandInfo[];
  /** Si mostrar solo nombres de marcas sin porcentajes */
  showOnlyNames?: boolean;
  /** Clase CSS personalizada */
  className?: string;
  /** Variante del badge */
  variant?: "default" | "secondary" | "destructive" | "outline";
}

/**
 * Componente reutilizable para mostrar marcas de campañas
 * Maneja automáticamente la lógica de asignación automática vs manual
 */
export function BrandDisplay({
  campaignData,
  brands: externalBrands,
  showOnlyNames = false,
  className = "",
  variant = "secondary"
}: BrandDisplayProps) {
  // Extraer marcas de los datos de campaña o usar las proporcionadas
  const brands = externalBrands || (campaignData ? extractBrandsFromCampaign(campaignData, campaignData?.asignacionAutomatica) : []);

  if (!brands || brands.length === 0) {
    return (
      <Badge variant="outline" className={`text-gray-500 text-xs ${className}`}>
        Sin marcas
      </Badge>
    );
  }

  // Verificar si es asignación automática
  const isAutoAssignment = campaignData?.asignacionAutomatica === true;

  // Agrupar marcas por zona
  const brandsByZone = brands.reduce((acc, brand) => {
    const zona = brand.zona || 'N/A';
    if (!acc[zona]) {
      acc[zona] = [];
    }
    acc[zona].push(brand);
    return acc;
  }, {} as Record<string, ExtendedBrandInfo[]>);

  // Si hay una sola marca
  if (brands.length === 1) {
    const brand = brands[0];
    const zona = brand.zona || 'N/A';
    return (
      <div className={`${className}`}>
        <div className="text-xs">
          <span className="font-semibold text-slate-700">{zona}:</span>{' '}
          <span className="text-slate-600">{brand.marca}</span>
          {!showOnlyNames && !isAutoAssignment && (
            <span className="text-slate-500 ml-1">({brand.porcentaje}%)</span>
          )}
        </div>
      </div>
    );
  }

  // Múltiples marcas agrupadas por zona
  return (
    <div className={`space-y-1 ${className}`}>
      {Object.entries(brandsByZone).map(([zona, zonaBrands]) => (
        <div key={zona} className="text-xs leading-relaxed">
          <span className="font-semibold text-slate-700">{zona}:</span>{' '}
          <span className="text-slate-600">
            {zonaBrands.map((brand, index) => (
              <span key={index}>
                {brand.marca}
                {!showOnlyNames && !isAutoAssignment && (
                  <span className="text-slate-500"> ({brand.porcentaje}%)</span>
                )}
                {index < zonaBrands.length - 1 && ', '}
              </span>
            ))}
          </span>
        </div>
      ))}
      {isAutoAssignment && (
        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 px-1.5 py-0.5">
          AUTO
        </Badge>
      )}
    </div>
  );
}

/**
 * Hook para obtener información de marcas de una campaña
 * Útil para lógica que necesita acceso a los datos sin renderizar
 */
export function useBrandInfo(campaignData: any): {
  brands: BrandInfo[];
  isAutoAssignment: boolean;
  brandCount: number;
  displayText: string;
} {
  const brands = campaignData ? extractBrandsFromCampaign(campaignData, campaignData?.asignacionAutomatica) : [];
  const isAutoAssignment = campaignData?.asignacionAutomatica === true;
  const brandCount = brands.length;

  let displayText = "";
  if (brands.length === 0) {
    displayText = "Sin marcas";
  } else if (isAutoAssignment) {
    displayText = `${brands.map(b => b.marca).join(", ")} (AUTO)`;
  } else if (brands.length === 1) {
    displayText = brands[0].marca;
  } else {
    displayText = brands.map(b => `${b.marca} (${b.porcentaje}%)`).join(", ");
  }

  return {
    brands,
    isAutoAssignment,
    brandCount,
    displayText
  };
}