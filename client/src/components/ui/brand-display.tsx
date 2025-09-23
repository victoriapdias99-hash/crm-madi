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
      <Badge variant="outline" className={`text-gray-500 ${className}`}>
        Sin marcas
      </Badge>
    );
  }

  // Verificar si es asignación automática
  const isAutoAssignment = campaignData?.asignacionAutomatica === true;

  // Helper para formatear marca con zona
  const formatBrandWithZone = (brand: ExtendedBrandInfo): string => {
    const zona = brand.zona || 'N/A';
    return `${brand.marca} - ${zona}`;
  };

  // Si hay una sola marca
  if (brands.length === 1) {
    const brand = brands[0];
    return (
      <div className={`${className}`}>
        <Badge variant={variant} className="font-semibold block text-center">
          {formatBrandWithZone(brand)}
          {!showOnlyNames && !isAutoAssignment && (
            <span className="text-xs ml-1">({brand.porcentaje}%)</span>
          )}
        </Badge>
      </div>
    );
  }

  // Múltiples marcas
  if (isAutoAssignment) {
    // Modo automático: mostrar todas las marcas con zonas + "AUTO"
    return (
      <div className={`space-y-1 ${className}`}>
        {brands.map((brand, index) => (
          <Badge
            key={index}
            variant={variant}
            className="font-semibold block text-center"
          >
            {formatBrandWithZone(brand)}
          </Badge>
        ))}
        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 block text-center">
          AUTO
        </Badge>
      </div>
    );
  } else {
    // Modo manual: mostrar marcas con zonas y porcentajes
    return (
      <div className={`space-y-1 ${className}`}>
        {brands.map((brand, index) => (
          <Badge
            key={index}
            variant={variant}
            className="font-semibold block text-center"
          >
            {formatBrandWithZone(brand)}
            {!showOnlyNames && (
              <span className="text-xs ml-1">({brand.porcentaje}%)</span>
            )}
          </Badge>
        ))}
      </div>
    );
  }
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