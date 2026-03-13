import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workspacesApi } from '@/shared/lib/api';
import { localWorkspaceIssuesApi } from '@/shared/lib/localApi';
import { getRemoteApiUrl } from '@/shared/lib/remoteApi';
import type { CreateAndStartWorkspaceRequest } from 'shared/types';
import { workspaceSummaryKeys } from '@/shared/hooks/workspaceSummaryKeys';
import { localWorkspaceIssueKeys } from '@/shared/hooks/useLocalWorkspaceIssues';

interface CreateWorkspaceParams {
  data: CreateAndStartWorkspaceRequest;
  linkToIssue?: {
    remoteProjectId: string;
    issueId: string;
  };
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  const isLocalOnly = !getRemoteApiUrl();

  const createWorkspace = useMutation({
    mutationFn: async ({ data, linkToIssue }: CreateWorkspaceParams) => {
      const { workspace } = await workspacesApi.createAndStart(data);

      if (linkToIssue && workspace) {
        try {
          if (isLocalOnly) {
            await localWorkspaceIssuesApi.create({
              workspace_id: workspace.id,
              issue_id: linkToIssue.issueId,
              project_id: linkToIssue.remoteProjectId,
            });
          } else {
            await workspacesApi.linkToIssue(
              workspace.id,
              linkToIssue.remoteProjectId,
              linkToIssue.issueId
            );
          }
        } catch (linkError) {
          console.error('Failed to link workspace to issue:', linkError);
        }
      }

      return { workspace };
    },
    onSuccess: () => {
      // Invalidate workspace summaries so they refresh with the new workspace included
      queryClient.invalidateQueries({ queryKey: workspaceSummaryKeys.all });
      // Ensure create-mode defaults refetch the latest session/model selection.
      queryClient.invalidateQueries({ queryKey: ['workspaceCreateDefaults'] });
      if (isLocalOnly) {
        queryClient.invalidateQueries({ queryKey: localWorkspaceIssueKeys.all });
      }
    },
    onError: (err) => {
      console.error('Failed to create workspace:', err);
    },
  });

  return { createWorkspace };
}
