import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localProjectsApi } from '@/shared/lib/localApi';

export const localProjectKeys = {
  all: ['local-projects'] as const,
  list: (orgId: string) => ['local-projects', orgId] as const,
  detail: (id: string) => ['local-projects', 'detail', id] as const,
};

export function useLocalProjects(organizationId: string) {
  return useQuery({
    queryKey: localProjectKeys.list(organizationId),
    queryFn: () => localProjectsApi.list(organizationId),
    enabled: !!organizationId,
  });
}

export function useCreateLocalProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: localProjectsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: localProjectKeys.all });
    },
  });
}

export function useUpdateLocalProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof localProjectsApi.update>[1] }) =>
      localProjectsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: localProjectKeys.all });
    },
  });
}

export function useDeleteLocalProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: localProjectsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: localProjectKeys.all });
    },
  });
}
