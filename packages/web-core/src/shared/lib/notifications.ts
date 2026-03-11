import type { Notification } from 'shared/remote-types';
import type { OrganizationMemberWithProfile } from 'shared/types';

interface NotificationPayload {
  deeplink_path?: string;
  issue_title?: string;
  actor_user_id?: string;
  comment_preview?: string;
  old_status_id?: string;
  new_status_id?: string;
  old_status_name?: string;
  new_status_name?: string;
  old_title?: string;
  new_title?: string;
  old_priority?: string | null;
  new_priority?: string | null;
  assignee_user_id?: string;
  emoji?: string;
  reaction_action?: 'added' | 'changed' | 'removed';
}

export function getPayload(n: Notification): NotificationPayload {
  return (n.payload ?? {}) as NotificationPayload;
}

export function getDeeplinkPath(n: Notification): string | null {
  return getPayload(n).deeplink_path ?? null;
}

/** A segment of a notification message — either plain/bold text or a user avatar. */
export type MessageSegment =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'user'; userId: string };

function text(value: string): MessageSegment {
  return { type: 'text', value };
}

function bold(value: string): MessageSegment {
  return { type: 'bold', value };
}

function user(userId: string): MessageSegment {
  return { type: 'user', userId };
}

function formatPriority(priority?: string | null): string | null {
  if (!priority) return null;
  return priority
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getNotificationSegments(n: Notification): MessageSegment[] {
  const payload = getPayload(n);
  const title = payload.issue_title ?? 'an issue';
  const actorId = payload.actor_user_id;

  const actor = actorId ? [user(actorId)] : [text('Someone')];

  switch (n.notification_type) {
    case 'issue_title_changed': {
      if (payload.old_title && payload.new_title) {
        return [
          ...actor,
          text(' changed the title '),
          bold(payload.old_title),
          text(' to '),
          bold(payload.new_title),
        ];
      }
      return [...actor, text(' changed the title on '), bold(title)];
    }
    case 'issue_assignee_changed': {
      const assigneeId = payload.assignee_user_id;
      const assignee = assigneeId ? [user(assigneeId)] : [text('Someone')];
      return [
        ...assignee,
        text(' was assigned to '),
        bold(title),
        text(' by '),
        ...actor,
      ];
    }
    case 'issue_unassigned': {
      return [...actor, text(' unassigned you from '), bold(title)];
    }
    case 'issue_description_changed': {
      return [
        text('Description updated on '),
        bold(title),
        text(' by '),
        ...actor,
      ];
    }
    case 'issue_priority_changed': {
      const oldPriority = formatPriority(payload.old_priority);
      const newPriority = formatPriority(payload.new_priority);
      if (oldPriority && newPriority) {
        return [
          ...actor,
          text(' changed priority on '),
          bold(title),
          text(' from '),
          bold(oldPriority),
          text(' to '),
          bold(newPriority),
        ];
      }
      if (newPriority) {
        return [
          ...actor,
          text(' changed priority on '),
          bold(title),
          text(' to '),
          bold(newPriority),
        ];
      }
      return [...actor, text(' cleared priority on '), bold(title)];
    }
    case 'issue_comment_added': {
      return [...actor, text(' commented on '), bold(title)];
    }
    case 'issue_comment_reaction': {
      if (payload.reaction_action === 'removed') {
        return [
          ...actor,
          text(' removed a reaction from your comment on '),
          bold(title),
        ];
      }
      if (payload.reaction_action === 'changed' && payload.emoji) {
        return [
          ...actor,
          text(' changed their reaction to '),
          bold(payload.emoji),
          text(' on your comment on '),
          bold(title),
        ];
      }
      if (payload.emoji) {
        return [
          ...actor,
          text(' reacted '),
          bold(payload.emoji),
          text(' to your comment on '),
          bold(title),
        ];
      }
      return [...actor, text(' reacted to your comment on '), bold(title)];
    }
    case 'issue_status_changed': {
      if (payload.old_status_name && payload.new_status_name) {
        return [
          ...actor,
          text(' changed status on '),
          bold(title),
          text(' from '),
          bold(payload.old_status_name),
          text(' to '),
          bold(payload.new_status_name),
        ];
      }
      return [...actor, text(' changed status on '), bold(title)];
    }
    case 'issue_deleted': {
      return [...actor, text(' deleted '), bold(title)];
    }
    default:
      return [text('New notification')];
  }
}

export function resolveMember(
  userId: string,
  members: OrganizationMemberWithProfile[]
): OrganizationMemberWithProfile | undefined {
  return members.find((m) => m.user_id === userId);
}
