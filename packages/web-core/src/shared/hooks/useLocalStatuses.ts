import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localStatusesApi } from '@/shared/lib/localApi';

export const localStatusKeys = {
  all: ['local-statuses'] as const,
  list: (projectId: string) => ['local-statuses', projectId] as const,
};

export function useLocalStatuses(projectId: string) {
  return useQuery({
    queryKey: localStatusKeys.list(projectId),
    queryFn: () => localStatusesApi.list(projectId),
    enabled: !!projectId,
  });
}

export function useCreateLocalStatus(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      color: string;
      sort_order: number;
      hidden?: boolean;
    }) => localStatusesApi.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: localStatusKeys.list(projectId),
      });
    },
  });
}

export function useUpdateLocalStatus(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof localStatusesApi.update>[1];
    }) => localStatusesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: localStatusKeys.list(projectId),
      });
    },
  });
}

export function useDeleteLocalStatus(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: localStatusesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: localStatusKeys.list(projectId),
      });
    },
  });
}
