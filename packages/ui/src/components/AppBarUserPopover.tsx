import {
  GearIcon,
  SignInIcon,
  SignOutIcon,
  UserIcon,
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from './Dropdown';

interface AppBarUserPopoverProps {
  isSignedIn: boolean;
  avatarUrl: string | null;
  avatarError: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettings?: () => void;
  onSignIn: () => void;
  onLogout: () => void;
  onAvatarError: () => void;
}

export function AppBarUserPopover({
  isSignedIn,
  avatarUrl,
  avatarError,
  open,
  onOpenChange,
  onSettings,
  onSignIn,
  onLogout,
  onAvatarError,
}: AppBarUserPopoverProps) {
  const { t } = useTranslation();
  const settingsLabel = t('settings:settings.layout.nav.title', {
    defaultValue: 'Settings',
  });

  if (!isSignedIn) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex items-center justify-center w-7 h-7 sm:w-10 sm:h-10 rounded-md sm:rounded-lg',
              'bg-panel text-normal font-medium text-sm',
              'transition-colors cursor-pointer',
              'hover:bg-panel/70',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand'
            )}
            aria-label="Sign in"
          >
            <UserIcon className="size-icon-sm" weight="bold" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="end" className="min-w-[200px]">
          <DropdownMenuItem icon={SignInIcon} onClick={onSignIn}>
            {t('signIn')}
          </DropdownMenuItem>
          {onSettings && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem icon={GearIcon} onClick={onSettings}>
                {settingsLabel}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center justify-center w-7 h-7 sm:w-10 sm:h-10 rounded-md sm:rounded-lg',
            'transition-colors cursor-pointer overflow-hidden',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand',
            (!avatarUrl || avatarError) &&
              'bg-panel text-normal font-medium text-sm',
            (!avatarUrl || avatarError) && 'hover:bg-panel/70'
          )}
          aria-label="Account"
        >
          {avatarUrl && !avatarError ? (
            <img
              src={avatarUrl}
              alt="User avatar"
              className="w-full h-full object-cover"
              onError={onAvatarError}
            />
          ) : (
            <UserIcon className="size-icon-sm" weight="bold" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="min-w-[200px]">
        {onSettings && (
          <DropdownMenuItem icon={GearIcon} onClick={onSettings}>
            {settingsLabel}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={SignOutIcon} onClick={onLogout}>
          {t('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
