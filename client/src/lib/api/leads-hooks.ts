import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchLeads, reassignLeads, LeadFilters, ReassignLeadsPayload } from "./leads";

export function useLeads(filters: LeadFilters) {
  return useQuery({
    queryKey: ["leads", filters],
    queryFn: () => fetchLeads(filters),
  });
}

export function useReassignLeads() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ReassignLeadsPayload) => reassignLeads(payload),
    onSuccess: () => {
      // invalidar cache de leads
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}
