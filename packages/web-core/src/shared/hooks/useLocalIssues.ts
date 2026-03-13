import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  localIssuesApi,
  type CreateLocalIssueData,
  type UpdateLocalIssueData,
} from '@/shared/lib/localApi';

export const localIssueKeys = {
  all: ['local-issues'] as const,
  list: (projectId: string) => ['local-issues', projectId] as const,
  detail: (id: string) => ['local-issues', 'detail', id] as const,
};

export function useLocalIssues(projectId: string) {
  return useQuery({
    queryKey: localIssueKeys.list(projectId),
    queryFn: () => localIssuesApi.list(projectId),
    enabled: !!projectId,
  });
}

export function useCreateLocalIssue(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLocalIssueData) =>
      localIssuesApi.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: localIssueKeys.list(projectId) });
    },
  });
}

export function useUpdateLocalIssue(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLocalIssueData }) =>
      localIssuesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: localIssueKeys.list(projectId) });
    },
  });
}

export function useDeleteLocalIssue(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: localIssuesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: localIssueKeys.list(projectId) });
    },
  });
}

export function useBulkUpdateLocalIssues(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: Array<{ id: string; changes: UpdateLocalIssueData }>) =>
      localIssuesApi.bulkUpdate(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: localIssueKeys.list(projectId) });
    },
  });
}
