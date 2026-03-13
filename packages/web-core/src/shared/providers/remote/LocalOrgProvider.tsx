import { useMemo, useCallback, type ReactNode } from 'react';
import { useLocalProjects } from '@/shared/hooks/useLocalProjects';
import { localProjectsApi } from '@/shared/lib/localApi';
import { useQueryClient } from '@tanstack/react-query';
import { localProjectKeys } from '@/shared/hooks/useLocalProjects';
import { genId } from '@/shared/lib/id';
import type {
  Project,
  Notification,
  CreateProjectRequest,
  UpdateProjectRequest,
  UpdateNotificationRequest,
} from 'shared/remote-types';
import type { OrganizationMemberWithProfile } from 'shared/types';
import type { InsertResult, MutationResult } from '@/shared/lib/electric/types';
import { OrgContext, type OrgContextValue } from '@/shared/hooks/useOrgContext';

interface LocalOrgProviderProps {
  organizationId: string;
  children: ReactNode;
}

/**
 * Local-only replacement for OrgProvider.
 * Fetches projects from local API instead of Electric sync.
 * Members and notifications are not supported locally.
 */
export function LocalOrgProvider({
  organizationId,
  children,
}: LocalOrgProviderProps) {
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } =
    useLocalProjects(organizationId);

  const emptyNotifications: Notification[] = useMemo(() => [], []);

  const projectsById = useMemo(() => {
    const map = new Map<string, Project>();
    for (const project of projects) {
      map.set(project.id, project);
    }
    return map;
  }, [projects]);

  const membersWithProfilesById = useMemo(
    () => new Map<string, OrganizationMemberWithProfile>(),
    []
  );

  const getProject = useCallback(
    (projectId: string) => projectsById.get(projectId),
    [projectsById]
  );

  const getUnseenNotifications = useCallback(
    (): Notification[] => [],
    []
  );

  const invalidateProjects = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: localProjectKeys.all,
    });
  }, [queryClient]);

  const insertProject = useCallback(
    (data: CreateProjectRequest): InsertResult<Project> => {
      const optimistic: Project = {
        id: data.id ?? genId(),
        organization_id: data.organization_id,
        name: data.name,
        color: data.color,
        sort_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const persisted = localProjectsApi
        .create({
          name: data.name,
          color: data.color,
          organization_id: data.organization_id,
        })
        .then((created) => {
          invalidateProjects();
          return created;
        });

      return { data: optimistic, persisted };
    },
    [invalidateProjects]
  );

  const updateProject = useCallback(
    (id: string, changes: Partial<UpdateProjectRequest>): MutationResult => {
      // Strip null values for local API compatibility
      const localChanges: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(changes)) {
        if (value !== undefined) {
          localChanges[key] = value;
        }
      }
      const persisted = localProjectsApi.update(id, localChanges as Partial<Project>).then(() => {
        invalidateProjects();
      });
      return { persisted };
    },
    [invalidateProjects]
  );

  const removeProject = useCallback(
    (id: string): MutationResult => {
      const persisted = localProjectsApi.delete(id).then(() => {
        invalidateProjects();
      });
      return { persisted };
    },
    [invalidateProjects]
  );

  const updateNotification = useCallback(
    (_id: string, _changes: Partial<UpdateNotificationRequest>): MutationResult => ({
      persisted: Promise.resolve(),
    }),
    []
  );

  const value = useMemo<OrgContextValue>(
    () => ({
      organizationId,
      projects,
      notifications: emptyNotifications,
      isLoading,
      error: null,
      retry: invalidateProjects,
      insertProject,
      updateProject,
      removeProject,
      updateNotification,
      getProject,
      getUnseenNotifications,
      projectsById,
      membersWithProfilesById,
    }),
    [
      organizationId,
      projects,
      emptyNotifications,
      isLoading,
      invalidateProjects,
      insertProject,
      updateProject,
      removeProject,
      updateNotification,
      getProject,
      getUnseenNotifications,
      projectsById,
      membersWithProfilesById,
    ]
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}
