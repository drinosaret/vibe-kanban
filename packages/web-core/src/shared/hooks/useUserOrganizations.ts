import { useQuery } from '@tanstack/react-query';
import { organizationsApi } from '@/shared/lib/api';
import { useAuth } from '@/shared/hooks/auth/useAuth';
import type { ListOrganizationsResponse } from 'shared/types';
import { MemberRole } from 'shared/types';
import { organizationKeys } from '@/shared/hooks/organizationKeys';
import { getRemoteApiUrl } from '@/shared/lib/remoteApi';

const LOCAL_ORG_RESPONSE: ListOrganizationsResponse = {
  organizations: [
    {
      id: 'local-org',
      name: '',
      slug: 'local',
      is_personal: false,
      issue_prefix: 'LOCAL',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_role: MemberRole.ADMIN,
    },
  ],
};

/**
 * Hook to fetch all organizations that the current user is a member of.
 * In local-only mode (no remote API), returns a fake local organization.
 */
export function useUserOrganizations() {
  const { isSignedIn } = useAuth();
  const isLocalOnly = !getRemoteApiUrl();

  return useQuery<ListOrganizationsResponse>({
    queryKey: organizationKeys.userList(),
    queryFn: () =>
      isLocalOnly
        ? Promise.resolve(LOCAL_ORG_RESPONSE)
        : organizationsApi.getUserOrganizations(),
    enabled: isLocalOnly || isSignedIn,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
