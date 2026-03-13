import { useMemo, useCallback, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { genId } from '@/shared/lib/id';
import { useLocalIssues, localIssueKeys } from '@/shared/hooks/useLocalIssues';
import {
  useLocalStatuses,
  localStatusKeys,
} from '@/shared/hooks/useLocalStatuses';
import { useLocalTags, useLocalIssueTags, localTagKeys } from '@/shared/hooks/useLocalTags';
import {
  localIssuesApi,
  localStatusesApi,
  localTagsApi,
  localRelationshipsApi,
} from '@/shared/lib/localApi';
import {
  useLocalWorkspaceIssues,
} from '@/shared/hooks/useLocalWorkspaceIssues';
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
  const { data: rawIssueTags = [] } = useLocalIssueTags(projectId);

  // Map raw issue tags (no id field) to IssueTag shape (with synthetic id)
  const issueTags: IssueTag[] = useMemo(
    () => rawIssueTags.map((it) => ({ id: `${it.issue_id}:${it.tag_id}`, issue_id: it.issue_id, tag_id: it.tag_id })),
    [rawIssueTags]
  );

  const invalidateIssueTags = useCallback(
    () => queryClient.invalidateQueries({ queryKey: localTagKeys.issueTags(projectId) }),
    [queryClient, projectId]
  );

  // Relationships
  const relationshipsQueryKey = useMemo(() => ['local-relationships', projectId] as const, [projectId]);
  const { data: issueRelationships = [] } = useQuery({
    queryKey: relationshipsQueryKey,
    queryFn: () => localRelationshipsApi.listByProject(projectId),
    enabled: !!projectId,
  });
  const invalidateRelationships = useCallback(
    () => queryClient.invalidateQueries({ queryKey: relationshipsQueryKey }),
    [queryClient, relationshipsQueryKey]
  );

  // Workspace-issue links
  const { data: workspaceIssueLinks = [] } = useLocalWorkspaceIssues(projectId);

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
  const emptyPullRequests: PullRequest[] = useMemo(() => [], []);

  // Build Workspace objects from local workspace-issue links so
  // IssueWorkspacesSectionContainer can display them.
  const workspaces: Workspace[] = useMemo(
    () =>
      workspaceIssueLinks.map((link) => ({
        id: link.workspace_id,
        project_id: link.project_id,
        owner_user_id: '',
        issue_id: link.issue_id,
        local_workspace_id: link.workspace_id,
        name: null,
        archived: false,
        files_changed: null,
        lines_added: null,
        lines_removed: null,
        created_at: link.created_at,
        updated_at: link.created_at,
      })),
    [workspaceIssueLinks]
  );

  const getAssigneesForIssue = useCallback(
    (_issueId: string): IssueAssignee[] => [],
    []
  );
  const getFollowersForIssue = useCallback(
    (_issueId: string): IssueFollower[] => [],
    []
  );
  const getTagsForIssue = useCallback(
    (issueId: string): IssueTag[] => issueTags.filter((it) => it.issue_id === issueId),
    [issueTags]
  );
  const getTagObjectsForIssue = useCallback(
    (issueId: string): Tag[] => {
      const tagIds = new Set(issueTags.filter((it) => it.issue_id === issueId).map((it) => it.tag_id));
      return tags.filter((t) => tagIds.has(t.id));
    },
    [issueTags, tags]
  );
  const getRelationshipsForIssue = useCallback(
    (issueId: string): IssueRelationship[] =>
      issueRelationships.filter((r) => r.issue_id === issueId || r.related_issue_id === issueId),
    [issueRelationships]
  );
  const getPullRequestsForIssue = useCallback(
    (_issueId: string): PullRequest[] => [],
    []
  );
  const getWorkspacesForIssue = useCallback(
    (issueId: string): Workspace[] =>
      workspaces.filter((w) => w.issue_id === issueId),
    [workspaces]
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
  // Issue tag mutations
  // ---------------------------------------------------------------------------

  const insertIssueTag = useCallback(
    (data: { issue_id: string; tag_id: string }): InsertResult<IssueTag> => {
      const currentTagIds = issueTags
        .filter((it) => it.issue_id === data.issue_id)
        .map((it) => it.tag_id);
      const newTagIds = [...currentTagIds, data.tag_id];
      const syntheticId = `${data.issue_id}:${data.tag_id}`;
      const persisted = localTagsApi.setForIssue(data.issue_id, newTagIds).then(() => {
        invalidateIssueTags();
        return { id: syntheticId, ...data } as IssueTag;
      });
      return { data: { id: syntheticId, ...data } as IssueTag, persisted };
    },
    [issueTags, invalidateIssueTags]
  );

  const removeIssueTag = useCallback(
    (id: string): MutationResult => {
      // id is synthetic: "issueId:tagId"
      const match = issueTags.find((it) => it.id === id);
      if (!match) return { persisted: Promise.resolve() };
      const remainingTagIds = issueTags
        .filter((it) => it.issue_id === match.issue_id && it.id !== id)
        .map((it) => it.tag_id);
      const persisted = localTagsApi.setForIssue(match.issue_id, remainingTagIds).then(() => {
        invalidateIssueTags();
      });
      return { persisted };
    },
    [issueTags, invalidateIssueTags]
  );

  // ---------------------------------------------------------------------------
  // Issue relationship mutations
  // ---------------------------------------------------------------------------

  const insertIssueRelationship = useCallback(
    (data: { issue_id: string; related_issue_id: string; relationship_type: string }): InsertResult<IssueRelationship> => {
      const tempId = genId();
      const optimistic = { id: tempId, ...data, created_at: new Date().toISOString() } as IssueRelationship;
      const persisted = localRelationshipsApi.create(data as Parameters<typeof localRelationshipsApi.create>[0]).then((result) => {
        invalidateRelationships();
        return result as unknown as IssueRelationship;
      });
      return { data: optimistic, persisted };
    },
    [invalidateRelationships]
  );

  const removeIssueRelationship = useCallback(
    (id: string): MutationResult => {
      const persisted = localRelationshipsApi.delete(id).then(() => {
        invalidateRelationships();
      });
      return { persisted };
    },
    [invalidateRelationships]
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
      issueTags,
      issueRelationships: issueRelationships as IssueRelationship[],
      pullRequests: emptyPullRequests,
      workspaces,

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
      insertIssueTag: insertIssueTag as ProjectContextValue['insertIssueTag'],
      removeIssueTag,
      insertIssueRelationship: insertIssueRelationship as ProjectContextValue['insertIssueRelationship'],
      removeIssueRelationship,

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
      issueTags,
      issueRelationships,
      emptyPullRequests,
      workspaces,
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
      insertIssueTag,
      removeIssueTag,
      insertIssueRelationship,
      removeIssueRelationship,
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
