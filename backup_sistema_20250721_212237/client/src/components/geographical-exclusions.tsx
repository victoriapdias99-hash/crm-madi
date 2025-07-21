import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Plus, MapPin } from 'lucide-react';

interface GeographicalExclusion {
  id: string;
  name: string;
  type: 'city' | 'region' | 'radius';
  coordinates?: { lat: number; lng: number };
  radius?: number;
}

interface GeographicalExclusionsProps {
  exclusions: GeographicalExclusion[];
  onChange: (exclusions: GeographicalExclusion[]) => void;
}

export default function GeographicalExclusions({ exclusions, onChange }: GeographicalExclusionsProps) {
  const [newExclusion, setNewExclusion] = useState('');

  const addExclusion = () => {
    if (!newExclusion.trim()) return;

    const exclusion: GeographicalExclusion = {
      id: Date.now().toString(),
      name: newExclusion.trim(),
      type: 'city' // Por defecto ciudad
    };

    onChange([...exclusions, exclusion]);
    setNewExclusion('');
  };

  const removeExclusion = (id: string) => {
    onChange(exclusions.filter(exc => exc.id !== id));
  };

  const getExclusionIcon = (type: string) => {
    switch (type) {
      case 'city':
        return '🏙️';
      case 'region':
        return '🗺️';
      case 'radius':
        return '📍';
      default:
        return '📍';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4" />
          Exclusiones Geográficas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Agregar nueva exclusión */}
        <div className="flex gap-2">
          <Input
            placeholder="Ej: Villa Carlos Paz, Córdoba Capital, Radio 50km de CABA..."
            value={newExclusion}
            onChange={(e) => setNewExclusion(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addExclusion()}
            className="flex-1"
          />
          <Button
            type="button"
            size="sm"
            onClick={addExclusion}
            disabled={!newExclusion.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Lista de exclusiones */}
        {exclusions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Áreas Excluidas ({exclusions.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {exclusions.map((exclusion) => (
                <Badge
                  key={exclusion.id}
                  variant="secondary"
                  className="flex items-center gap-2 text-xs"
                >
                  <span>{getExclusionIcon(exclusion.type)}</span>
                  {exclusion.name}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-4 w-4 p-0 hover:bg-red-100"
                    onClick={() => removeExclusion(exclusion.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {exclusions.length === 0 && (
          <div className="text-center py-4 text-gray-500 text-sm">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No hay exclusiones geográficas configuradas</p>
            <p className="text-xs">Agrega ciudades, regiones o radios a excluir</p>
          </div>
        )}

        {/* Información adicional */}
        <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
          <p className="font-medium mb-1">💡 Ejemplos de exclusiones:</p>
          <ul className="space-y-1">
            <li>• <strong>Ciudades:</strong> Rosario, Mendoza, Tucumán</li>
            <li>• <strong>Regiones:</strong> Patagonia, NOA, Cuyo</li>
            <li>• <strong>Radio:</strong> 100km desde CABA, 50km desde Córdoba</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}