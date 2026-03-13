import { useMemo, useCallback, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { genId } from '@/shared/lib/id';
import { localCommentsApi, type LocalIssueComment } from '@/shared/lib/localApi';
import type {
  IssueComment,
  IssueCommentReaction,
  CreateIssueCommentRequest,
  UpdateIssueCommentRequest,
  CreateIssueCommentReactionRequest,
} from 'shared/remote-types';
import type { InsertResult, MutationResult } from '@/shared/lib/electric/types';
import {
  IssueContext,
  type IssueContextValue,
} from '@/shared/hooks/useIssueContext';

interface LocalIssueProviderProps {
  issueId: string;
  children: ReactNode;
}

const localCommentKeys = {
  all: ['local-comments'] as const,
  byIssue: (issueId: string) => ['local-comments', issueId] as const,
};

/**
 * A local-only replacement for IssueProvider that fetches comments from the
 * local Rust backend via react-query instead of Electric sync.
 *
 * Reactions are not supported locally and are stubbed with empty arrays / no-ops.
 */
export function LocalIssueProvider({
  issueId,
  children,
}: LocalIssueProviderProps) {
  const queryClient = useQueryClient();

  const { data: rawComments = [], isLoading } = useQuery({
    queryKey: localCommentKeys.byIssue(issueId),
    queryFn: () => localCommentsApi.list(issueId),
    enabled: Boolean(issueId),
  });

  // Map LocalIssueComment to IssueComment shape
  const comments = useMemo<IssueComment[]>(
    () =>
      rawComments.map((c: LocalIssueComment) => ({
        id: c.id,
        issue_id: c.issue_id,
        author_id: c.author_id,
        parent_id: c.parent_id,
        message: c.message,
        created_at: c.created_at,
        updated_at: c.updated_at,
      })),
    [rawComments]
  );

  // No reactions in local mode
  const reactions = useMemo<IssueCommentReaction[]>(() => [], []);

  const commentsById = useMemo(() => {
    const map = new Map<string, IssueComment>();
    for (const comment of comments) {
      map.set(comment.id, comment);
    }
    return map;
  }, [comments]);

  const reactionsByComment = useMemo(
    () => new Map<string, IssueCommentReaction[]>(),
    []
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: localCommentKeys.byIssue(issueId),
    });
  }, [queryClient, issueId]);

  const insertComment = useCallback(
    (data: CreateIssueCommentRequest): InsertResult<IssueComment> => {
      const id = data.id ?? genId();
      const now = new Date().toISOString();
      const optimistic: IssueComment = {
        id,
        issue_id: data.issue_id,
        author_id: null,
        parent_id: data.parent_id,
        message: data.message,
        created_at: now,
        updated_at: now,
      };

      const persisted = localCommentsApi
        .create({
          issue_id: data.issue_id,
          message: data.message,
          parent_id: data.parent_id,
        })
        .then((created) => {
          invalidate();
          return {
            id: created.id,
            issue_id: created.issue_id,
            author_id: created.author_id,
            parent_id: created.parent_id,
            message: created.message,
            created_at: created.created_at,
            updated_at: created.updated_at,
          } as IssueComment;
        });

      return { data: optimistic, persisted };
    },
    [invalidate]
  );

  const updateComment = useCallback(
    (
      id: string,
      changes: Partial<UpdateIssueCommentRequest>
    ): MutationResult => {
      const persisted = localCommentsApi
        .update(id, { message: changes.message ?? '' })
        .then(() => {
          invalidate();
        });
      return { persisted };
    },
    [invalidate]
  );

  const removeComment = useCallback(
    (id: string): MutationResult => {
      const persisted = localCommentsApi.delete(id).then(() => {
        invalidate();
      });
      return { persisted };
    },
    [invalidate]
  );

  // Reactions are no-ops in local mode
  const insertReaction = useCallback(
    (_data: CreateIssueCommentReactionRequest): InsertResult<IssueCommentReaction> => {
      const stub: IssueCommentReaction = {
        id: genId(),
        comment_id: _data.comment_id,
        user_id: '',
        emoji: _data.emoji,
        created_at: new Date().toISOString(),
      };
      return { data: stub, persisted: Promise.resolve(stub) };
    },
    []
  );

  const removeReaction = useCallback(
    (_id: string): MutationResult => ({ persisted: Promise.resolve() }),
    []
  );

  const getComment = useCallback(
    (commentId: string) => commentsById.get(commentId),
    [commentsById]
  );

  const getReactionsForComment = useCallback(
    (_commentId: string) => [] as IssueCommentReaction[],
    []
  );

  const getReactionCountForComment = useCallback(
    (_commentId: string) => 0,
    []
  );

  const hasUserReactedToComment = useCallback(
    (_commentId: string, _userId: string, _emoji: string) => false,
    []
  );

  const retry = useCallback(() => {
    invalidate();
  }, [invalidate]);

  const value = useMemo<IssueContextValue>(
    () => ({
      issueId,
      comments,
      reactions,
      isLoading,
      error: null,
      retry,
      insertComment,
      updateComment,
      removeComment,
      insertReaction,
      removeReaction,
      getComment,
      getReactionsForComment,
      getReactionCountForComment,
      hasUserReactedToComment,
      commentsById,
      reactionsByComment,
    }),
    [
      issueId,
      comments,
      reactions,
      isLoading,
      retry,
      insertComment,
      updateComment,
      removeComment,
      insertReaction,
      removeReaction,
      getComment,
      getReactionsForComment,
      getReactionCountForComment,
      hasUserReactedToComment,
      commentsById,
      reactionsByComment,
    ]
  );

  return (
    <IssueContext.Provider value={value}>{children}</IssueContext.Provider>
  );
}
