import { useCallback, useEffect, useState } from "react";
import {
  fetchLeads,
  reassignLeads,
} from "@/lib/api/leads";
import {
  Lead,
  LeadFilters,
  ReassignLeadsPayload,
} from "@/lib/api/leads-types";

// Hook para listar leads
export function useLeads(initialFilters?: LeadFilters) {
  const [filters, setFilters] = useState<LeadFilters>(initialFilters ?? {});
  const [data, setData] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (overrideFilters?: LeadFilters) => {
      const nextFilters = overrideFilters ?? filters;
      setLoading(true);
      try {
        const leads = await fetchLeads(nextFilters);
        setData(leads);
        setError(null);
      } catch (e) {
        console.error(e);
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    // carga inicial
    load().catch(() => undefined);
  }, [load]);

  return {
    leads: data,
    loading,
    error,
    filters,
    setFilters,
    reload: load,
  };
}

// Hook para reasignar leads
export function useReassignLeads(onSuccess?: () => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = async (payload: ReassignLeadsPayload) => {
    setLoading(true);
    try {
      await reassignLeads(payload);
      setError(null);
      if (onSuccess) onSuccess();
    } catch (e) {
      console.error(e);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return { mutate, loading, error };
}
