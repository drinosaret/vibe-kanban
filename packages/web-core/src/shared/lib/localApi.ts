import { makeLocalApiRequest } from '@/shared/lib/localApiTransport';
import type {
  Project,
  ProjectStatus,
  Issue,
  Tag,
  IssuePriority,
  IssueRelationshipType,
  JsonValue,
} from 'shared/remote-types';

/**
 * Helper to make requests to the local kanban API (/api/local/...).
 * Expects responses in { success: true, data: T } format.
 */
async function makeLocalKanbanRequest<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await makeLocalApiRequest(`/api/local${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  const json = await response.json();
  if (!json.success) throw new Error(json.message || 'Request failed');
  return json.data as T;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const localProjectsApi = {
  list: (orgId: string) =>
    makeLocalKanbanRequest<Project[]>(
      `/projects?organization_id=${encodeURIComponent(orgId)}`
    ),

  get: (id: string) => makeLocalKanbanRequest<Project>(`/projects/${id}`),

  create: (data: { name: string; color?: string; organization_id: string }) =>
    makeLocalKanbanRequest<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Project>) =>
    makeLocalKanbanRequest<Project>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    makeLocalKanbanRequest<void>(`/projects/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------

export const localStatusesApi = {
  list: (projectId: string) =>
    makeLocalKanbanRequest<ProjectStatus[]>(
      `/projects/${projectId}/statuses`
    ),

  create: (
    projectId: string,
    data: {
      name: string;
      color: string;
      sort_order: number;
      hidden?: boolean;
    }
  ) =>
    makeLocalKanbanRequest<ProjectStatus>(
      `/projects/${projectId}/statuses`,
      { method: 'POST', body: JSON.stringify(data) }
    ),

  update: (
    id: string,
    data: Partial<{
      name: string;
      color: string;
      sort_order: number;
      hidden: boolean;
    }>
  ) =>
    makeLocalKanbanRequest<ProjectStatus>(`/statuses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    makeLocalKanbanRequest<void>(`/statuses/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

export interface CreateLocalIssueData {
  title: string;
  status_id: string;
  description?: string | null;
  priority?: IssuePriority | null;
  start_date?: string | null;
  target_date?: string | null;
  completed_at?: string | null;
  sort_order?: number;
  parent_issue_id?: string | null;
  parent_issue_sort_order?: number | null;
  extension_metadata?: JsonValue;
}

export interface UpdateLocalIssueData {
  status_id?: string;
  title?: string;
  description?: string | null;
  priority?: IssuePriority | null;
  start_date?: string | null;
  target_date?: string | null;
  completed_at?: string | null;
  sort_order?: number;
  parent_issue_id?: string | null;
  parent_issue_sort_order?: number | null;
  extension_metadata?: JsonValue;
}

export const localIssuesApi = {
  list: (projectId: string) =>
    makeLocalKanbanRequest<Issue[]>(`/projects/${projectId}/issues`),

  get: (id: string) => makeLocalKanbanRequest<Issue>(`/issues/${id}`),

  create: (projectId: string, data: CreateLocalIssueData) =>
    makeLocalKanbanRequest<Issue>(`/projects/${projectId}/issues`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateLocalIssueData) =>
    makeLocalKanbanRequest<Issue>(`/issues/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    makeLocalKanbanRequest<void>(`/issues/${id}`, { method: 'DELETE' }),

  bulkUpdate: (updates: Array<{ id: string; changes: UpdateLocalIssueData }>) =>
    Promise.all(
      updates.map(({ id, changes }) => localIssuesApi.update(id, changes))
    ),
};

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export interface LocalIssueTag {
  issue_id: string;
  tag_id: string;
}

export const localTagsApi = {
  list: (projectId: string) =>
    makeLocalKanbanRequest<Tag[]>(`/projects/${projectId}/tags`),

  listIssueTags: (projectId: string) =>
    makeLocalKanbanRequest<LocalIssueTag[]>(`/projects/${projectId}/issue-tags`),

  create: (projectId: string, data: { name: string; color: string }) =>
    makeLocalKanbanRequest<Tag>(`/projects/${projectId}/tags`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    makeLocalKanbanRequest<void>(`/tags/${id}`, { method: 'DELETE' }),

  setForIssue: (issueId: string, tagIds: string[]) =>
    makeLocalKanbanRequest<void>(`/issues/${issueId}/tags`, {
      method: 'PUT',
      body: JSON.stringify({ tag_ids: tagIds }),
    }),
};

// ---------------------------------------------------------------------------
// Issue Relationships
// ---------------------------------------------------------------------------

export interface LocalIssueRelationship {
  id: string;
  issue_id: string;
  related_issue_id: string;
  relationship_type: IssueRelationshipType;
  created_at: string;
}

export const localRelationshipsApi = {
  listByProject: (projectId: string) =>
    makeLocalKanbanRequest<LocalIssueRelationship[]>(`/projects/${projectId}/issue-relationships`),

  create: (data: { issue_id: string; related_issue_id: string; relationship_type: IssueRelationshipType }) =>
    makeLocalKanbanRequest<LocalIssueRelationship>(`/issue-relationships`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    makeLocalKanbanRequest<void>(`/issue-relationships/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Issue Comments
// ---------------------------------------------------------------------------

export interface LocalIssueComment {
  id: string;
  issue_id: string;
  author_id: string | null;
  parent_id: string | null;
  message: string;
  created_at: string;
  updated_at: string;
}

export const localCommentsApi = {
  list: (issueId: string) =>
    makeLocalKanbanRequest<LocalIssueComment[]>(`/issues/${issueId}/comments`),

  create: (data: { issue_id: string; message: string; parent_id?: string | null }) =>
    makeLocalKanbanRequest<LocalIssueComment>(`/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: { message: string }) =>
    makeLocalKanbanRequest<LocalIssueComment>(`/comments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    makeLocalKanbanRequest<void>(`/comments/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Workspace Issue Links
// ---------------------------------------------------------------------------

export interface LocalWorkspaceIssueLink {
  workspace_id: string;
  issue_id: string;
  project_id: string;
  created_at: string;
}

export const localWorkspaceIssuesApi = {
  list: (projectId: string) =>
    makeLocalKanbanRequest<LocalWorkspaceIssueLink[]>(
      `/projects/${projectId}/workspace-issues`
    ),

  create: (data: { workspace_id: string; issue_id: string; project_id: string }) =>
    makeLocalKanbanRequest<LocalWorkspaceIssueLink>('/workspace-issues', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (workspaceId: string) =>
    makeLocalKanbanRequest<void>(`/workspace-issues/${workspaceId}`, {
      method: 'DELETE',
    }),
};
