import { useState } from 'react';
import { AppBarUserPopover } from '@vibe/ui/components/AppBarUserPopover';
import { SettingsDialog } from '@/shared/dialogs/settings/SettingsDialog';
import { useAuth } from '@/shared/hooks/auth/useAuth';
import { useUserSystem } from '@/shared/hooks/useUserSystem';
import { useActions } from '@/shared/hooks/useActions';
import { Actions } from '@/shared/actions';

export function AppBarUserPopoverContainer() {
  const { executeAction } = useActions();
  const { isSignedIn } = useAuth();
  const { loginStatus } = useUserSystem();
  const [open, setOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  // Extract avatar URL from first provider
  const avatarUrl =
    loginStatus?.status === 'loggedin'
      ? (loginStatus.profile.providers[0]?.avatar_url ?? null)
      : null;

  const handleSignIn = async () => {
    await executeAction(Actions.SignIn);
  };

  const handleLogout = async () => {
    await executeAction(Actions.SignOut);
  };

  const handleSettings = async () => {
    setOpen(false);
    await SettingsDialog.show();
  };

  return (
    <AppBarUserPopover
      isSignedIn={isSignedIn}
      avatarUrl={avatarUrl}
      avatarError={avatarError}
      open={open}
      onOpenChange={setOpen}
      onSignIn={handleSignIn}
      onLogout={handleLogout}
      onAvatarError={() => setAvatarError(true)}
      onSettings={handleSettings}
    />
  );
}
