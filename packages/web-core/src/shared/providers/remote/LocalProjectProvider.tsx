import { useMemo, useCallback, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { genId } from '@/shared/lib/id';
import { useLocalIssues, localIssueKeys } from '@/shared/hooks/useLocalIssues';
import {
  useLocalStatuses,
  localStatusKeys,
} from '@/shared/hooks/useLocalStatuses';
import { useLocalTags, localTagKeys } from '@/shared/hooks/useLocalTags';
import {
  localIssuesApi,
  localStatusesApi,
  localTagsApi,
} from '@/shared/lib/localApi';
import type {
  Issue,
  ProjectStatus,
  Tag,
  IssueAssignee,
  IssueFollower,
  IssueTag,
  IssueRelationship,
  PullRequest,
  Workspace,
  CreateIssueRequest,
  UpdateIssueRequest,
  CreateProjectStatusRequest,
  UpdateProjectStatusRequest,
  CreateTagRequest,
  UpdateTagRequest,
} from 'shared/remote-types';
import type { InsertResult, MutationResult } from '@/shared/lib/electric/types';
import {
  ProjectContext,
  type ProjectContextValue,
} from '@/shared/hooks/useProjectContext';

interface LocalProjectProviderProps {
  projectId: string;
  children: ReactNode;
}

/**
 * A local-only replacement for ProjectProvider that fetches data from the
 * local Rust backend via react-query instead of Electric sync.
 *
 * Mutations are applied optimistically then confirmed by the API.
 * Features not supported locally (assignees, followers, relationships,
 * pull requests, workspaces) are stubbed with empty arrays / no-ops.
 */
export function LocalProjectProvider({
  projectId,
  children,
}: LocalProjectProviderProps) {
  const queryClient = useQueryClient();

  const { data: issues = [], isLoading: issuesLoading } =
    useLocalIssues(projectId);
  const { data: statuses = [], isLoading: statusesLoading } =
    useLocalStatuses(projectId);
  const { data: tags = [] } = useLocalTags(projectId);

  const isLoading = issuesLoading || statusesLoading;

  // ---------------------------------------------------------------------------
  // Computed Maps
  // ---------------------------------------------------------------------------

  const issuesById = useMemo(() => {
    const map = new Map<string, Issue>();
    for (const issue of issues) {
      map.set(issue.id, issue);
    }
    return map;
  }, [issues]);

  const statusesById = useMemo(() => {
    const map = new Map<string, ProjectStatus>();
    for (const status of statuses) {
      map.set(status.id, status);
    }
    return map;
  }, [statuses]);

  const tagsById = useMemo(() => {
    const map = new Map<string, Tag>();
    for (const tag of tags) {
      map.set(tag.id, tag);
    }
    return map;
  }, [tags]);

  // ---------------------------------------------------------------------------
  // Lookup helpers
  // ---------------------------------------------------------------------------

  const getIssue = useCallback(
    (issueId: string) => issuesById.get(issueId),
    [issuesById]
  );

  const getIssuesForStatus = useCallback(
    (statusId: string) => issues.filter((i) => i.status_id === statusId),
    [issues]
  );

  const getStatus = useCallback(
    (statusId: string) => statusesById.get(statusId),
    [statusesById]
  );

  const getTag = useCallback(
    (tagId: string) => tagsById.get(tagId),
    [tagsById]
  );

  // Stubs for features not available locally
  const emptyAssignees: IssueAssignee[] = useMemo(() => [], []);
  const emptyFollowers: IssueFollower[] = useMemo(() => [], []);
  const emptyIssueTags: IssueTag[] = useMemo(() => [], []);
  const emptyRelationships: IssueRelationship[] = useMemo(() => [], []);
  const emptyPullRequests: PullRequest[] = useMemo(() => [], []);
  const emptyWorkspaces: Workspace[] = useMemo(() => [], []);

  const getAssigneesForIssue = useCallback(
    (_issueId: string): IssueAssignee[] => [],
    []
  );
  const getFollowersForIssue = useCallback(
    (_issueId: string): IssueFollower[] => [],
    []
  );
  const getTagsForIssue = useCallback(
    (_issueId: string): IssueTag[] => [],
    []
  );
  const getTagObjectsForIssue = useCallback(
    (_issueId: string): Tag[] => [],
    []
  );
  const getRelationshipsForIssue = useCallback(
    (_issueId: string): IssueRelationship[] => [],
    []
  );
  const getPullRequestsForIssue = useCallback(
    (_issueId: string): PullRequest[] => [],
    []
  );
  const getWorkspacesForIssue = useCallback(
    (_issueId: string): Workspace[] => [],
    []
  );

  // ---------------------------------------------------------------------------
  // Mutation helpers
  // ---------------------------------------------------------------------------

  const invalidateIssues = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: localIssueKeys.list(projectId),
    });
  }, [queryClient, projectId]);

  const invalidateStatuses = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: localStatusKeys.list(projectId),
    });
  }, [queryClient, projectId]);

  const invalidateTags = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: localTagKeys.list(projectId),
    });
  }, [queryClient, projectId]);

  // ---------------------------------------------------------------------------
  // Issue mutations
  // ---------------------------------------------------------------------------

  const insertIssue = useCallback(
    (data: CreateIssueRequest): InsertResult<Issue> => {
      const optimistic: Issue = {
        id: data.id ?? genId(),
        project_id: data.project_id,
        issue_number: 0,
        simple_id: '',
        status_id: data.status_id,
        title: data.title,
        description: data.description,
        priority: data.priority,
        start_date: data.start_date,
        target_date: data.target_date,
        completed_at: data.completed_at,
        sort_order: data.sort_order,
        parent_issue_id: data.parent_issue_id,
        parent_issue_sort_order: data.parent_issue_sort_order,
        extension_metadata: data.extension_metadata,
        creator_user_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const persisted = localIssuesApi
        .create(projectId, {
          title: data.title,
          status_id: data.status_id,
          description: data.description,
          priority: data.priority,
          sort_order: data.sort_order,
          start_date: data.start_date,
          target_date: data.target_date,
          completed_at: data.completed_at,
          parent_issue_id: data.parent_issue_id,
          parent_issue_sort_order: data.parent_issue_sort_order,
          extension_metadata: data.extension_metadata,
        })
        .then((created) => {
          invalidateIssues();
          return created;
        });

      return { data: optimistic, persisted };
    },
    [projectId, invalidateIssues]
  );

  const updateIssue = useCallback(
    (id: string, changes: Partial<UpdateIssueRequest>): MutationResult => {
      // Strip null values that aren't valid for the local API
      const localChanges: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(changes)) {
        if (value !== undefined) {
          localChanges[key] = value;
        }
      }
      const persisted = localIssuesApi.update(id, localChanges).then(() => {
        invalidateIssues();
      });
      return { persisted };
    },
    [invalidateIssues]
  );

  const removeIssue = useCallback(
    (id: string): MutationResult => {
      const persisted = localIssuesApi.delete(id).then(() => {
        invalidateIssues();
      });
      return { persisted };
    },
    [invalidateIssues]
  );

  // ---------------------------------------------------------------------------
  // Status mutations
  // ---------------------------------------------------------------------------

  const insertStatus = useCallback(
    (data: CreateProjectStatusRequest): InsertResult<ProjectStatus> => {
      const optimistic: ProjectStatus = {
        id: data.id ?? genId(),
        project_id: data.project_id,
        name: data.name,
        color: data.color,
        sort_order: data.sort_order,
        hidden: data.hidden,
        created_at: new Date().toISOString(),
      };

      const persisted = localStatusesApi
        .create(projectId, {
          name: data.name,
          color: data.color,
          sort_order: data.sort_order,
          hidden: data.hidden,
        })
        .then((created) => {
          invalidateStatuses();
          return created;
        });

      return { data: optimistic, persisted };
    },
    [projectId, invalidateStatuses]
  );

  const updateStatus = useCallback(
    (
      id: string,
      changes: Partial<UpdateProjectStatusRequest>
    ): MutationResult => {
      // Strip null values for local API compatibility
      const localChanges: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(changes)) {
        if (value !== undefined) {
          localChanges[key] = value;
        }
      }
      const persisted = localStatusesApi.update(id, localChanges as Parameters<typeof localStatusesApi.update>[1]).then(() => {
        invalidateStatuses();
      });
      return { persisted };
    },
    [invalidateStatuses]
  );

  const removeStatus = useCallback(
    (id: string): MutationResult => {
      const persisted = localStatusesApi.delete(id).then(() => {
        invalidateStatuses();
      });
      return { persisted };
    },
    [invalidateStatuses]
  );

  // ---------------------------------------------------------------------------
  // Tag mutations
  // ---------------------------------------------------------------------------

  const insertTag = useCallback(
    (data: CreateTagRequest): InsertResult<Tag> => {
      const optimistic: Tag = {
        id: data.id ?? genId(),
        project_id: data.project_id,
        name: data.name,
        color: data.color,
      };

      const persisted = localTagsApi
        .create(projectId, { name: data.name, color: data.color })
        .then((created) => {
          invalidateTags();
          return created;
        });

      return { data: optimistic, persisted };
    },
    [projectId, invalidateTags]
  );

  const updateTag = useCallback(
    (_id: string, _changes: Partial<UpdateTagRequest>): MutationResult => {
      // Tag update not supported in local API yet
      return { persisted: Promise.resolve() };
    },
    []
  );

  const removeTag = useCallback(
    (id: string): MutationResult => {
      const persisted = localTagsApi.delete(id).then(() => {
        invalidateTags();
      });
      return { persisted };
    },
    [invalidateTags]
  );

  // ---------------------------------------------------------------------------
  // Stub mutations for unsupported features
  // ---------------------------------------------------------------------------

  const stubInsert = useCallback(
    <T,>(_data: unknown): InsertResult<T> => ({
      data: {} as T,
      persisted: Promise.resolve({} as T),
    }),
    []
  );

  const stubRemove = useCallback(
    (_id: string): MutationResult => ({
      persisted: Promise.resolve(),
    }),
    []
  );

  // ---------------------------------------------------------------------------
  // Context value
  // ---------------------------------------------------------------------------

  const value = useMemo<ProjectContextValue>(
    () => ({
      projectId,

      // Data
      issues,
      statuses,
      tags,
      issueAssignees: emptyAssignees,
      issueFollowers: emptyFollowers,
      issueTags: emptyIssueTags,
      issueRelationships: emptyRelationships,
      pullRequests: emptyPullRequests,
      workspaces: emptyWorkspaces,

      // Loading/error
      isLoading,
      error: null,
      retry: () => {
        invalidateIssues();
        invalidateStatuses();
        invalidateTags();
      },

      // Issue mutations
      insertIssue,
      updateIssue,
      removeIssue,

      // Status mutations
      insertStatus,
      updateStatus,
      removeStatus,

      // Tag mutations
      insertTag,
      updateTag,
      removeTag,

      // Stub mutations
      insertIssueAssignee: stubInsert as ProjectContextValue['insertIssueAssignee'],
      removeIssueAssignee: stubRemove,
      insertIssueFollower: stubInsert as ProjectContextValue['insertIssueFollower'],
      removeIssueFollower: stubRemove,
      insertIssueTag: stubInsert as ProjectContextValue['insertIssueTag'],
      removeIssueTag: stubRemove,
      insertIssueRelationship: stubInsert as ProjectContextValue['insertIssueRelationship'],
      removeIssueRelationship: stubRemove,

      // Lookup helpers
      getIssue,
      getIssuesForStatus,
      getAssigneesForIssue,
      getFollowersForIssue,
      getTagsForIssue,
      getTagObjectsForIssue,
      getRelationshipsForIssue,
      getStatus,
      getTag,
      getPullRequestsForIssue,
      getWorkspacesForIssue,

      // Computed aggregations
      issuesById,
      statusesById,
      tagsById,
    }),
    [
      projectId,
      issues,
      statuses,
      tags,
      emptyAssignees,
      emptyFollowers,
      emptyIssueTags,
      emptyRelationships,
      emptyPullRequests,
      emptyWorkspaces,
      isLoading,
      invalidateIssues,
      invalidateStatuses,
      invalidateTags,
      insertIssue,
      updateIssue,
      removeIssue,
      insertStatus,
      updateStatus,
      removeStatus,
      insertTag,
      updateTag,
      removeTag,
      stubInsert,
      stubRemove,
      getIssue,
      getIssuesForStatus,
      getAssigneesForIssue,
      getFollowersForIssue,
      getTagsForIssue,
      getTagObjectsForIssue,
      getRelationshipsForIssue,
      getStatus,
      getTag,
      getPullRequestsForIssue,
      getWorkspacesForIssue,
      issuesById,
      statusesById,
      tagsById,
    ]
  );

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}
