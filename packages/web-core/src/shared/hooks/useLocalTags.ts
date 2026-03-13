import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localTagsApi } from '@/shared/lib/localApi';

export const localTagKeys = {
  all: ['local-tags'] as const,
  list: (projectId: string) => ['local-tags', projectId] as const,
  issueTags: (projectId: string) => ['local-issue-tags', projectId] as const,
};

export function useLocalTags(projectId: string) {
  return useQuery({
    queryKey: localTagKeys.list(projectId),
    queryFn: () => localTagsApi.list(projectId),
    enabled: !!projectId,
  });
}

export function useCreateLocalTag(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      localTagsApi.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: localTagKeys.list(projectId),
      });
    },
  });
}

export function useDeleteLocalTag(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: localTagsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: localTagKeys.list(projectId),
      });
    },
  });
}

export function useLocalIssueTags(projectId: string) {
  return useQuery({
    queryKey: localTagKeys.issueTags(projectId),
    queryFn: () => localTagsApi.listIssueTags(projectId),
    enabled: !!projectId,
  });
}

export function useSetLocalIssueTags(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, tagIds }: { issueId: string; tagIds: string[] }) =>
      localTagsApi.setForIssue(issueId, tagIds),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: localTagKeys.list(projectId),
      });
    },
  });
}
