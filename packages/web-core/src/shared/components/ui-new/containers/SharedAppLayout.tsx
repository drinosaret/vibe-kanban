import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DropResult } from '@hello-pangea/dnd';
import { Outlet } from '@tanstack/react-router';
import { XIcon, PlusIcon, LayoutIcon, KanbanIcon } from '@phosphor-icons/react';
import { SyncErrorProvider } from '@/shared/providers/SyncErrorProvider';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useUiPreferencesStore } from '@/shared/stores/useUiPreferencesStore';
import { cn } from '@/shared/lib/utils';

import { NavbarContainer } from './NavbarContainer';
import { AppBar } from '@vibe/ui/components/AppBar';
import { MobileDrawer } from '@vibe/ui/components/MobileDrawer';
import { AppBarUserPopoverContainer } from './AppBarUserPopoverContainer';
import { useUserOrganizations } from '@/shared/hooks/useUserOrganizations';
import { useOrganizationStore } from '@/shared/stores/useOrganizationStore';
import { useAuth } from '@/shared/hooks/auth/useAuth';
import { useUserSystem } from '@/shared/hooks/useUserSystem';
import { useAppNavigation } from '@/shared/hooks/useAppNavigation';
import { useCurrentAppDestination } from '@/shared/hooks/useCurrentAppDestination';
import {
  getProjectDestination,
  isWorkspacesDestination,
} from '@/shared/lib/routes/appNavigation';
import {
  CreateRemoteProjectDialog,
  type CreateRemoteProjectResult,
} from '@/shared/dialogs/org/CreateRemoteProjectDialog';
import {
  CreateLocalProjectDialog,
  type CreateLocalProjectResult,
} from '@/shared/dialogs/org/CreateLocalProjectDialog';
import { OAuthDialog } from '@/shared/dialogs/global/OAuthDialog';
import { getRemoteApiUrl } from '@/shared/lib/remoteApi';
import { useLocalProjects, localProjectKeys } from '@/shared/hooks/useLocalProjects';
import { localProjectsApi } from '@/shared/lib/localApi';
import { useQueryClient } from '@tanstack/react-query';
import { CommandBarDialog } from '@/shared/dialogs/command-bar/CommandBarDialog';
import { useCommandBarShortcut } from '@/shared/hooks/useCommandBarShortcut';
import { useWorkspaceSidebarPreviewController } from '@/shared/hooks/useWorkspaceSidebarPreviewController';
import { useShape } from '@/shared/integrations/electric/hooks';
import { sortProjectsByOrder } from '@/shared/lib/projectOrder';
import {
  PROJECT_MUTATION,
  PROJECTS_SHAPE,
  type Project as RemoteProject,
} from 'shared/remote-types';
import { WorkspacesSidebarContainer } from '@/pages/workspaces/WorkspacesSidebarContainer';
import { WorkspacesSidebarReopenTag } from '@vibe/ui/components/WorkspacesSidebar';

export function SharedAppLayout() {
  const queryClient = useQueryClient();
  const appNavigation = useAppNavigation();
  const currentDestination = useCurrentAppDestination();
  const isMigrateRoute = currentDestination?.kind === 'migrate';
  const isMobile = useIsMobile();
  const isLocalOnly = !getRemoteApiUrl();
  const mobileFontScale = useUiPreferencesStore((s) => s.mobileFontScale);
  const isLeftSidebarVisible = useUiPreferencesStore(
    (s) => s.isLeftSidebarVisible
  );
  const { isSignedIn } = useAuth();
  const { appVersion } = useUserSystem();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAppBarHovered, setIsAppBarHovered] = useState(false);

  // Register CMD+K shortcut globally for all routes under SharedAppLayout
  useCommandBarShortcut(() => CommandBarDialog.show());

  // Apply mobile font scale CSS variable
  useEffect(() => {
    if (!isMobile) {
      document.documentElement.style.removeProperty('--mobile-font-scale');
      return;
    }
    const scaleMap = { default: '1', small: '0.9', smaller: '0.8' } as const;
    document.documentElement.style.setProperty(
      '--mobile-font-scale',
      scaleMap[mobileFontScale]
    );
    return () => {
      document.documentElement.style.removeProperty('--mobile-font-scale');
    };
  }, [isMobile, mobileFontScale]);

  // AppBar state - organizations and projects
  const { data: orgsData } = useUserOrganizations();
  const organizations = useMemo(
    () => orgsData?.organizations ?? [],
    [orgsData?.organizations]
  );

  const selectedOrgId = useOrganizationStore((s) => s.selectedOrgId);
  const setSelectedOrgId = useOrganizationStore((s) => s.setSelectedOrgId);
  const prevOrgIdRef = useRef<string | null>(null);

  // Auto-select first org if none selected or selection is invalid
  useEffect(() => {
    if (organizations.length === 0) return;

    const hasValidSelection = selectedOrgId
      ? organizations.some((org) => org.id === selectedOrgId)
      : false;

    if (!selectedOrgId || !hasValidSelection) {
      const firstNonPersonal = organizations.find((org) => !org.is_personal);
      setSelectedOrgId((firstNonPersonal ?? organizations[0]).id);
    }
  }, [organizations, selectedOrgId, setSelectedOrgId]);

  const projectParams = useMemo(
    () => ({ organization_id: selectedOrgId || '' }),
    [selectedOrgId]
  );
  const remoteProjectsResult = useShape(PROJECTS_SHAPE, projectParams, {
    enabled: !isLocalOnly && isSignedIn && !!selectedOrgId,
    mutation: PROJECT_MUTATION,
  });
  const localProjectsResult = useLocalProjects(
    isLocalOnly ? (selectedOrgId || '') : ''
  );
  const orgProjects = isLocalOnly
    ? (localProjectsResult.data ?? [])
    : (remoteProjectsResult.data ?? []);
  const isLoading = isLocalOnly
    ? localProjectsResult.isLoading
    : remoteProjectsResult.isLoading;
  const updateManyProjects = remoteProjectsResult.updateMany;
  const sortedProjects = useMemo(
    () => sortProjectsByOrder(orgProjects),
    [orgProjects]
  );
  const [orderedProjects, setOrderedProjects] =
    useState<RemoteProject[]>(sortedProjects);
  const [isSavingProjectOrder, setIsSavingProjectOrder] = useState(false);

  useEffect(() => {
    if (isSavingProjectOrder) {
      return;
    }
    setOrderedProjects(sortedProjects);
  }, [isSavingProjectOrder, sortedProjects]);

  // Navigate to the first ordered project when org changes
  useEffect(() => {
    // Skip auto-navigation when on migration flow
    if (isMigrateRoute) {
      prevOrgIdRef.current = selectedOrgId;
      return;
    }

    if (
      prevOrgIdRef.current !== null &&
      prevOrgIdRef.current !== selectedOrgId &&
      selectedOrgId &&
      !isLoading
    ) {
      if (sortedProjects.length > 0) {
        appNavigation.goToProject(sortedProjects[0].id);
      } else {
        appNavigation.goToWorkspaces();
      }
      prevOrgIdRef.current = selectedOrgId;
    } else if (prevOrgIdRef.current === null && selectedOrgId) {
      prevOrgIdRef.current = selectedOrgId;
    }
  }, [selectedOrgId, sortedProjects, isLoading, isMigrateRoute, appNavigation]);

  // Navigation state for AppBar active indicators
  const projectDestination = useMemo(
    () => getProjectDestination(currentDestination),
    [currentDestination]
  );
  const isWorkspacesActive = isWorkspacesDestination(currentDestination);
  const isWorkspaceSidebarPreviewEnabled =
    !isMobile && isWorkspacesActive && !isLeftSidebarVisible;
  const activeProjectId = projectDestination?.projectId ?? null;
  const sidebarPreview = useWorkspaceSidebarPreviewController({
    enabled: isWorkspaceSidebarPreviewEnabled,
    isAppBarHovered,
  });

  // Persist last selected project to scratch store
  const setSelectedProjectId = useUiPreferencesStore(
    (s) => s.setSelectedProjectId
  );
  useEffect(() => {
    if (activeProjectId) {
      setSelectedProjectId(activeProjectId);
    }
  }, [activeProjectId, setSelectedProjectId]);

  const handleWorkspacesClick = useCallback(() => {
    appNavigation.goToWorkspaces();
  }, [appNavigation]);

  const handleProjectClick = useCallback(
    (projectId: string) => {
      appNavigation.goToProject(projectId);
    },
    [appNavigation]
  );

  const handleProjectsDragEnd = useCallback(
    async ({ source, destination }: DropResult) => {
      if (isSavingProjectOrder) {
        return;
      }
      if (!destination || source.index === destination.index) {
        return;
      }

      const previousOrder = orderedProjects;
      const reordered = [...orderedProjects];
      const [moved] = reordered.splice(source.index, 1);

      if (!moved) {
        return;
      }

      reordered.splice(destination.index, 0, moved);
      setOrderedProjects(reordered);
      setIsSavingProjectOrder(true);

      try {
        if (isLocalOnly) {
          await Promise.all(
            reordered.map((project, index) =>
              localProjectsApi.update(project.id, { sort_order: index })
            )
          );
          await queryClient.invalidateQueries({ queryKey: localProjectKeys.all });
        } else {
          await updateManyProjects(
            reordered.map((project, index) => ({
              id: project.id,
              changes: { sort_order: index },
            }))
          ).persisted;
        }
      } catch (error) {
        console.error('Failed to reorder projects:', error);
        setOrderedProjects(previousOrder);
      } finally {
        setIsSavingProjectOrder(false);
      }
    },
    [isSavingProjectOrder, orderedProjects, updateManyProjects, isLocalOnly, queryClient]
  );

  const handleCreateProject = useCallback(async () => {
    if (!selectedOrgId) return;

    try {
      if (isLocalOnly) {
        const result: CreateLocalProjectResult =
          await CreateLocalProjectDialog.show({ organizationId: selectedOrgId });

        if (result.action === 'created' && result.project) {
          await queryClient.invalidateQueries({ queryKey: localProjectKeys.all });
          appNavigation.goToProject(result.project.id);
        }
      } else {
        const result: CreateRemoteProjectResult =
          await CreateRemoteProjectDialog.show({ organizationId: selectedOrgId });

        if (result.action === 'created' && result.project) {
          appNavigation.goToProject(result.project.id);
        }
      }
    } catch {
      // Dialog cancelled
    }
  }, [selectedOrgId, appNavigation, isLocalOnly, queryClient]);

  const handleSignIn = useCallback(async () => {
    try {
      await OAuthDialog.show({});
    } catch {
      // Dialog cancelled
    }
  }, []);

  const handleMigrate = useCallback(async () => {
    if (!isSignedIn) {
      try {
        const profile = await OAuthDialog.show({});
        if (profile) {
          appNavigation.goToMigrate();
        }
      } catch {
        // Dialog cancelled
      }
    } else {
      appNavigation.goToMigrate();
    }
  }, [isSignedIn, appNavigation]);

  return (
    <SyncErrorProvider>
      <div
        className={cn(
          'flex bg-primary',
          isMobile
            ? 'fixed inset-0 pb-[env(safe-area-inset-bottom)]'
            : 'h-screen'
        )}
      >
        {!isMobile && !isMigrateRoute && (
          <AppBar
            projects={orderedProjects}
            onCreateProject={handleCreateProject}
            onWorkspacesClick={handleWorkspacesClick}
            onProjectClick={handleProjectClick}
            onProjectsDragEnd={handleProjectsDragEnd}
            isSavingProjectOrder={isSavingProjectOrder}
            isWorkspacesActive={isWorkspacesActive}
            activeProjectId={activeProjectId}
            isSignedIn={isLocalOnly || isSignedIn}
            isLoadingProjects={isLoading}
            onSignIn={handleSignIn}
            onMigrate={handleMigrate}
            onHoverStart={() => setIsAppBarHovered(true)}
            onHoverEnd={() => setIsAppBarHovered(false)}
            userPopover={
              <AppBarUserPopoverContainer />
            }
            appVersion={appVersion}
          />
        )}

        {/* Mobile project navigation drawer */}
        <MobileDrawer
          open={isDrawerOpen && isMobile}
          onClose={() => setIsDrawerOpen(false)}
        >
          <div className="flex flex-col h-full">
            {/* Header: org name + close button */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <span className="text-sm font-medium text-high truncate">
                {organizations.find((o) => o.id === selectedOrgId)?.name ??
                  'Organization'}
              </span>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="p-1 rounded-sm text-low hover:text-normal cursor-pointer"
              >
                <XIcon className="h-4 w-4" weight="bold" />
              </button>
            </div>

            {/* Workspaces link */}
            <button
              type="button"
              onClick={() => {
                appNavigation.goToWorkspaces();
                setIsDrawerOpen(false);
              }}
              className="flex items-center gap-2 px-4 py-3 text-sm text-normal hover:bg-secondary cursor-pointer"
            >
              <LayoutIcon className="h-4 w-4" />
              Workspaces
            </button>

            {/* Divider */}
            <div className="border-t border-border mx-4" />

            {/* Project list */}
            <div className="flex-1 overflow-y-auto p-2">
              {(isLocalOnly || isSignedIn) ? (
                orderedProjects.map((project) => (
                  <button
                    type="button"
                    key={project.id}
                    onClick={() => {
                      handleProjectClick(project.id);
                      setIsDrawerOpen(false);
                    }}
                    className={cn(
                      'flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm text-left cursor-pointer',
                      'transition-colors',
                      project.id === activeProjectId
                        ? 'bg-brand/10 text-high'
                        : 'text-normal hover:bg-secondary'
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: `hsl(${project.color})` }}
                    />
                    <span className="truncate">{project.name}</span>
                  </button>
                ))
              ) : (
                <div className="px-4 py-6 text-center">
                  <KanbanIcon
                    className="h-8 w-8 mx-auto text-low"
                    weight="bold"
                  />
                  <p className="mt-3 text-sm font-medium text-high">
                    Kanban Boards
                  </p>
                  <p className="mt-1 text-xs text-low">
                    Sign in to organise your coding agents with kanban boards.
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleSignIn();
                        setIsDrawerOpen(false);
                      }}
                      className="w-full px-3 py-2 rounded-md text-sm font-medium bg-brand text-on-brand hover:bg-brand-hover cursor-pointer"
                    >
                      Sign in
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleMigrate();
                        setIsDrawerOpen(false);
                      }}
                      className="w-full px-3 py-2 rounded-md text-sm text-normal bg-secondary hover:bg-panel border border-border cursor-pointer"
                    >
                      Migrate old projects
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Create Project button */}
            {(isLocalOnly || isSignedIn) && (
              <div className="p-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    handleCreateProject();
                    setIsDrawerOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2.5 rounded-md text-sm text-low hover:text-normal hover:bg-secondary cursor-pointer"
                >
                  <PlusIcon className="h-4 w-4" />
                  Create Project
                </button>
              </div>
            )}
          </div>
        </MobileDrawer>
        <div className="flex flex-col flex-1 min-w-0">
          <NavbarContainer
            mobileMode={isMobile}
            onOpenDrawer={() => setIsDrawerOpen(true)}
          />
          <div className="relative flex-1 min-h-0">
            {isWorkspaceSidebarPreviewEnabled &&
              !sidebarPreview.isPreviewOpen && (
                <div className="absolute left-0 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2">
                  <WorkspacesSidebarReopenTag
                    active={false}
                    onHoverStart={sidebarPreview.handleHandleHoverStart}
                    onHoverEnd={sidebarPreview.handleHandleHoverEnd}
                    ariaLabel="Workspaces"
                  />
                </div>
              )}

            <div className="relative h-full overflow-hidden">
              {isWorkspaceSidebarPreviewEnabled && (
                <div
                  className={cn(
                    'absolute left-0 top-0 z-30 h-full w-[300px] transition-transform duration-150 ease-out',
                    sidebarPreview.isPreviewOpen
                      ? 'translate-x-0 pointer-events-auto'
                      : '-translate-x-full pointer-events-none'
                  )}
                  onMouseEnter={sidebarPreview.handlePreviewHoverStart}
                  onMouseLeave={sidebarPreview.handlePreviewHoverEnd}
                >
                  <div className="h-full w-full overflow-hidden border-r border-border bg-secondary shadow-lg">
                    <WorkspacesSidebarContainer />
                  </div>
                </div>
              )}

              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </SyncErrorProvider>
  );
}
