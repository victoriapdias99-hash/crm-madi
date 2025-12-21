import { LeadFilters } from "@/lib/api/leads";
// import { Brand } from "@/lib/api/brands";
// etc.

interface Props {
  filters: LeadFilters;
  onChange: (filters: LeadFilters) => void;
}

export function LeadsFilters({ filters, onChange }: Props) {
  // TODO: inputs para fechas, marca, cliente, zona, search
  return (
    <div className="flex flex-wrap gap-2">
      {/* Aquí irán DatePickers, Selects, Inputs, etc. */}
      {/* onChange({ ...filters, fromDate: '2025-01-01' }) */}
      Filtros TODO
    </div>
  );
}
