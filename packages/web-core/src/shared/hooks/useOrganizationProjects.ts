import { useShape } from '@/shared/integrations/electric/hooks';
import { PROJECTS_SHAPE } from 'shared/remote-types';
import { useAuth } from '@/shared/hooks/auth/useAuth';
import { getRemoteApiUrl } from '@/shared/lib/remoteApi';
import { useLocalProjects } from '@/shared/hooks/useLocalProjects';

export function useOrganizationProjects(organizationId: string | null) {
  const { isSignedIn } = useAuth();
  const isLocalOnly = !getRemoteApiUrl();

  // Local mode: use local API
  const localResult = useLocalProjects(isLocalOnly ? (organizationId ?? '') : '');

  // Remote mode: only subscribe to Electric when signed in AND have an org
  const enabled = !isLocalOnly && isSignedIn && !!organizationId;

  const { data: remoteData, isLoading: remoteLoading, error } = useShape(
    PROJECTS_SHAPE,
    { organization_id: organizationId || '' },
    { enabled }
  );

  if (isLocalOnly) {
    return {
      data: localResult.data ?? [],
      isLoading: localResult.isLoading,
      isError: localResult.isError,
      error: localResult.error,
    };
  }

  return {
    data: remoteData,
    isLoading: remoteLoading,
    isError: !!error,
    error,
  };
}
