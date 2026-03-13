import { useEffect, useRef, useState } from 'react';
import { CheckIcon, XIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { ThemeMode } from 'shared/types';
import {
  OAuthDialog,
  type OAuthProvider,
} from '@/shared/dialogs/global/OAuthDialog';
import { useUserSystem } from '@/shared/hooks/useUserSystem';
import { useTheme } from '@/shared/hooks/useTheme';
import { OAuthSignInButton } from '@vibe/ui/components/OAuthButtons';
import { PrimaryButton } from '@vibe/ui/components/PrimaryButton';
import { getFirstProjectDestination } from '@/shared/lib/firstProjectDestination';
import { useOrganizationStore } from '@/shared/stores/useOrganizationStore';
import { useAppNavigation } from '@/shared/hooks/useAppNavigation';

type OnboardingDestination =
  | { kind: 'workspaces-create' }
  | { kind: 'project'; projectId: string };

const COMPARISON_ROWS = [
  {
    feature: 'Use kanban board to track issues',
    signedIn: true,
    skip: false,
  },
  {
    feature: 'Invite team to collaborate',
    signedIn: true,
    skip: false,
  },
  {
    feature: 'Organise work into projects and organizations',
    signedIn: true,
    skip: false,
  },
  {
    feature: 'Create workspaces',
    signedIn: true,
    skip: true,
  },
];

type SignInCompletionMethod =
  | 'continue_logged_in'
  | 'skip_sign_in'
  | 'oauth_github'
  | 'oauth_google';
function resolveTheme(theme: ThemeMode): 'light' | 'dark' {
  if (theme === ThemeMode.SYSTEM) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return theme === ThemeMode.DARK ? 'dark' : 'light';
}

export function OnboardingSignInPage() {
  const appNavigation = useAppNavigation();
  const { t } = useTranslation('common');
  const { theme } = useTheme();
  const { config, loginStatus, loading, updateAndSaveConfig } = useUserSystem();
  const setSelectedOrgId = useOrganizationStore((s) => s.setSelectedOrgId);

  const [showComparison, setShowComparison] = useState(false);
  const [saving, setSaving] = useState(false);
  const isCompletingOnboardingRef = useRef(false);
  const hasRedirectedToRootRef = useRef(false);
  const [pendingProvider, setPendingProvider] = useState<OAuthProvider | null>(
    null
  );

  const logoSrc =
    resolveTheme(theme) === 'dark'
      ? '/vibe-kanban-logo-dark.svg'
      : '/vibe-kanban-logo.svg';

  const isLoggedIn = loginStatus?.status === 'loggedin';

  useEffect(() => {
    if (!config?.remote_onboarding_acknowledged) {
      return;
    }
    if (isCompletingOnboardingRef.current || hasRedirectedToRootRef.current) {
      return;
    }

    hasRedirectedToRootRef.current = true;
    appNavigation.goToRoot({ replace: true });
  }, [appNavigation, config?.remote_onboarding_acknowledged]);

  const getOnboardingDestination = async (): Promise<OnboardingDestination> => {
    const firstProjectDestination =
      await getFirstProjectDestination(setSelectedOrgId);
    if (
      !firstProjectDestination ||
      firstProjectDestination.kind !== 'project'
    ) {
      return { kind: 'workspaces-create' };
    }

    return firstProjectDestination;
  };

  const finishOnboarding = async (_options: {
    method: SignInCompletionMethod;
  }) => {
    if (!config || saving || isCompletingOnboardingRef.current) return;

    isCompletingOnboardingRef.current = true;
    setSaving(true);
    const success = await updateAndSaveConfig({
      remote_onboarding_acknowledged: true,
      onboarding_acknowledged: true,
      disclaimer_acknowledged: true,
    });

    if (!success) {
      isCompletingOnboardingRef.current = false;
      setSaving(false);
      return;
    }

    const destination = await getOnboardingDestination();
    switch (destination.kind) {
      case 'workspaces-create':
        appNavigation.goToWorkspacesCreate({ replace: true });
        return;
      case 'project':
        appNavigation.goToProject(destination.projectId, { replace: true });
        return;
    }
  };

  const handleProviderSignIn = async (provider: OAuthProvider) => {
    if (saving || pendingProvider) return;

    setPendingProvider(provider);
    const profile = await OAuthDialog.show({ initialProvider: provider });
    setPendingProvider(null);

    if (profile) {
      await finishOnboarding({
        method: provider === 'github' ? 'oauth_github' : 'oauth_google',
      });
    }
  };

  if (loading || !config) {
    return (
      <div className="h-screen bg-primary flex items-center justify-center">
        <p className="text-low">Loading...</p>
      </div>
    );
  }

  if (
    config.remote_onboarding_acknowledged &&
    !isCompletingOnboardingRef.current
  ) {
    return null;
  }

  return (
    <div className="h-screen overflow-auto bg-primary">
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-base py-double">
        <div className="rounded-sm border border-border bg-secondary p-double space-y-double">
          <header className="space-y-double text-center">
            <div className="flex justify-center">
              <img
                src={logoSrc}
                alt="Vibe Kanban"
                className="h-8 w-auto logo"
              />
            </div>
            {!isLoggedIn && (
              <p className="text-sm text-low">
                {t('onboardingSignIn.subtitle')}
              </p>
            )}
          </header>

          {isLoggedIn ? (
            <section className="space-y-base">
              <p className="text-sm text-normal text-center">
                {t('onboardingSignIn.signedInAs', {
                  name:
                    loginStatus.profile.username || loginStatus.profile.email,
                })}
              </p>
              <div className="flex justify-end">
                <PrimaryButton
                  value={saving ? 'Continuing...' : 'Continue'}
                  onClick={() =>
                    void finishOnboarding({ method: 'continue_logged_in' })
                  }
                  disabled={saving}
                />
              </div>
            </section>
          ) : (
            <>
              <section className="flex flex-col items-center gap-2">
                <OAuthSignInButton
                  provider="github"
                  onClick={() => void handleProviderSignIn('github')}
                  disabled={saving || pendingProvider !== null}
                  loading={pendingProvider === 'github'}
                  loadingText="Opening GitHub..."
                />
                <OAuthSignInButton
                  provider="google"
                  onClick={() => void handleProviderSignIn('google')}
                  disabled={saving || pendingProvider !== null}
                  loading={pendingProvider === 'google'}
                  loadingText="Opening Google..."
                />
              </section>

              <div className="flex justify-center">
                <button
                  type="button"
                  className="text-sm text-low hover:text-normal underline underline-offset-2"
                  onClick={() => {
                    setShowComparison(true);
                  }}
                  disabled={saving || pendingProvider !== null}
                >
                  {t('onboardingSignIn.moreOptions')}
                </button>
              </div>
            </>
          )}

          {showComparison && !isLoggedIn && (
            <section className="space-y-base rounded-sm border border-border bg-panel p-base">
              <div className="overflow-x-auto rounded-sm border border-border">
                <table className="w-full border-collapse">
                  <thead className="bg-secondary text-xs font-medium text-low">
                    <tr>
                      <th className="px-base py-half text-left">
                        {t('onboardingSignIn.featureHeader')}
                      </th>
                      <th className="px-base py-half text-left border-l border-border">
                        {t('onboardingSignIn.signedInHeader')}
                      </th>
                      <th className="px-base py-half text-left border-l border-border">
                        {t('onboardingSignIn.skipSignInHeader')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {COMPARISON_ROWS.map((row, index) => (
                      <tr
                        key={row.feature}
                        className={index > 0 ? 'border-t border-border' : ''}
                      >
                        <td className="px-base py-half text-normal align-top">
                          {row.feature}
                        </td>
                        <td className="px-base py-half align-top border-l border-border text-center">
                          {row.signedIn ? (
                            <>
                              <CheckIcon
                                className="size-icon-xs text-success inline"
                                weight="bold"
                              />
                              <span className="sr-only">
                                {t('onboardingSignIn.yes')}
                              </span>
                            </>
                          ) : (
                            <>
                              <XIcon
                                className="size-icon-xs text-warning inline"
                                weight="bold"
                              />
                              <span className="sr-only">
                                {t('onboardingSignIn.no')}
                              </span>
                            </>
                          )}
                        </td>
                        <td className="px-base py-half align-top border-l border-border text-center">
                          {row.skip ? (
                            <>
                              <CheckIcon
                                className="size-icon-xs text-success inline"
                                weight="bold"
                              />
                              <span className="sr-only">
                                {t('onboardingSignIn.yes')}
                              </span>
                            </>
                          ) : (
                            <>
                              <XIcon
                                className="size-icon-xs text-warning inline"
                                weight="bold"
                              />
                              <span className="sr-only">
                                {t('onboardingSignIn.no')}
                              </span>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <PrimaryButton
                  value={
                    saving
                      ? 'Continuing...'
                      : 'I understand, continue without signing in'
                  }
                  variant="tertiary"
                  onClick={() =>
                    void finishOnboarding({ method: 'skip_sign_in' })
                  }
                  disabled={saving || pendingProvider !== null}
                />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
