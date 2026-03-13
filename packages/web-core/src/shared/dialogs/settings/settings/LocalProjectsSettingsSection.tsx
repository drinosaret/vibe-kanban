import { useState, useCallback } from 'react';
import { TrashIcon, DotsThreeIcon, SpinnerIcon } from '@phosphor-icons/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@vibe/ui/components/Dropdown';
import { useLocalProjects, useDeleteLocalProject } from '@/shared/hooks/useLocalProjects';
import { useOrganizationStore } from '@/shared/stores/useOrganizationStore';
import { useAppNavigation } from '@/shared/hooks/useAppNavigation';
import { cn } from '@/shared/lib/utils';
import { SettingsCard } from './SettingsComponents';
import type { Project } from 'shared/remote-types';

export function LocalProjectsSettingsSection() {
  const selectedOrgId = useOrganizationStore((s) => s.selectedOrgId);
  const orgId = selectedOrgId ?? 'local-org';
  const { data: projects = [], isLoading } = useLocalProjects(orgId);
  const deleteProject = useDeleteLocalProject();
  const appNavigation = useAppNavigation();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = useCallback(
    async (project: Project) => {
      if (!confirm(`Delete project "${project.name}"? This cannot be undone.`)) {
        return;
      }
      setDeletingId(project.id);
      try {
        await deleteProject.mutateAsync(project.id);
        // Navigate to first remaining project or home
        const remaining = projects.filter((p) => p.id !== project.id);
        if (remaining.length > 0) {
          appNavigation.goToProject(remaining[0].id);
        }
      } finally {
        setDeletingId(null);
      }
    },
    [deleteProject, projects, appNavigation]
  );

  return (
    <SettingsCard title="Local Projects" description="Manage your local projects.">
      {isLoading ? (
        <div className="flex items-center justify-center py-double gap-base">
          <SpinnerIcon className="size-icon-sm animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <p className="text-sm text-low py-base">No local projects.</p>
      ) : (
        <div className="border border-border rounded-sm divide-y divide-border">
          {projects.map((project) => (
            <div
              key={project.id}
              className="group flex items-center gap-base px-base py-half"
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: `hsl(${project.color})` }}
              />
              <span className="text-sm text-high flex-1 truncate">
                {project.name}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      'p-half rounded-sm hover:bg-panel text-low hover:text-normal',
                      'opacity-0 group-hover:opacity-100 transition-opacity'
                    )}
                    onClick={(e) => e.stopPropagation()}
                    disabled={deletingId === project.id}
                  >
                    {deletingId === project.id ? (
                      <SpinnerIcon className="size-icon-xs animate-spin" />
                    ) : (
                      <DotsThreeIcon className="size-icon-xs" weight="bold" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(project);
                    }}
                    className="text-error focus:text-error"
                  >
                    <div className="flex items-center gap-half w-full">
                      <TrashIcon className="size-icon-xs mr-base" />
                      Delete
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}
    </SettingsCard>
  );
}
