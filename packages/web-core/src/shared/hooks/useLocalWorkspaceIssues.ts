import { useQuery } from '@tanstack/react-query';
import { localWorkspaceIssuesApi } from '@/shared/lib/localApi';

export const localWorkspaceIssueKeys = {
  all: ['local-workspace-issues'] as const,
  list: (projectId: string) => ['local-workspace-issues', projectId] as const,
};

export function useLocalWorkspaceIssues(projectId: string) {
  return useQuery({
    queryKey: localWorkspaceIssueKeys.list(projectId),
    queryFn: () => localWorkspaceIssuesApi.list(projectId),
    enabled: !!projectId,
  });
}
