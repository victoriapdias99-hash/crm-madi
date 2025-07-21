import { useState } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { UseFormReturn } from "react-hook-form";
import { 
  InsertCliente, 
  TIPO_FACTURACION, 
  MARCAS_DISPONIBLES, 
  ZONAS, 
  PROVINCIAS_BUENOS_AIRES, 
  TIPOS_INTEGRACION, 
  TIPOS_CLIENTE 
} from "@shared/schema";
import GeographicalExclusions from "@/components/geographical-exclusions";

interface ClienteFormProps {
  form: UseFormReturn<InsertCliente>;
  onSubmit: (data: InsertCliente) => void;
  isLoading: boolean;
  isEditing: boolean;
}

export default function ClienteForm({ form, onSubmit, isLoading, isEditing }: ClienteFormProps) {
  const [exclusiones, setExclusiones] = useState(form.watch("exclusionesGeograficas") || []);

  const handleExclusionesChange = (newExclusiones: any[]) => {
    setExclusiones(newExclusiones);
    form.setValue("exclusionesGeograficas", newExclusiones);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Información Básica */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="nombreCliente"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre Cliente *</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: NOVO GROUP" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nombreComercial"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre Comercial *</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Novo Automotores" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Contacto */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="telefono"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Teléfono</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: +54 11 1234-5678" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="Ej: contacto@novo.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Información Comercial */}
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="cuitCliente"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CUIT</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: 20-12345678-9" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tipoFacturacion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo Facturación *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(TIPO_FACTURACION).map(([key, value]) => (
                      <SelectItem key={key} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tipoCliente"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Cliente</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TIPOS_CLIENTE.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Marcas Solicitadas */}
        <FormField
          control={form.control}
          name="marcasSolicitadas"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Marcas Solicitadas</FormLabel>
              <div className="grid grid-cols-4 gap-2">
                {MARCAS_DISPONIBLES.map((marca) => (
                  <FormItem
                    key={marca}
                    className="flex flex-row items-start space-x-3 space-y-0"
                  >
                    <FormControl>
                      <Checkbox
                        checked={field.value?.includes(marca)}
                        onCheckedChange={(checked) => {
                          const current = field.value || [];
                          if (checked) {
                            field.onChange([...current, marca]);
                          } else {
                            field.onChange(current.filter((m) => m !== marca));
                          }
                        }}
                      />
                    </FormControl>
                    <FormLabel className="text-sm font-normal">
                      {marca}
                    </FormLabel>
                  </FormItem>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Zonas y Ubicación */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="zonas"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Zonas</FormLabel>
                <div className="grid grid-cols-1 gap-2">
                  {ZONAS.map((zona) => (
                    <FormItem
                      key={zona}
                      className="flex flex-row items-start space-x-3 space-y-0"
                    >
                      <FormControl>
                        <Checkbox
                          checked={field.value?.includes(zona)}
                          onCheckedChange={(checked) => {
                            const current = field.value || [];
                            if (checked) {
                              field.onChange([...current, zona]);
                            } else {
                              field.onChange(current.filter((z) => z !== zona));
                            }
                          }}
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal">
                        {zona}
                      </FormLabel>
                    </FormItem>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="provinciaBuenosAires"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Provincia Buenos Aires (si aplica)</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar provincia" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="max-h-60">
                    <SelectItem value="">Ninguna</SelectItem>
                    {PROVINCIAS_BUENOS_AIRES.map((provincia) => (
                      <SelectItem key={provincia} value={provincia}>
                        {provincia}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Integración */}
        <FormField
          control={form.control}
          name="integracion"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Integración</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar integración" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="">Ninguna</SelectItem>
                  {TIPOS_INTEGRACION.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {tipo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Exclusiones Geográficas */}
        <GeographicalExclusions
          exclusions={exclusiones}
          onChange={handleExclusionesChange}
        />

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Guardando..." : isEditing ? "Actualizar Cliente" : "Crear Cliente"}
        </Button>
      </form>
    </Form>
  );
}