import type { Comment } from "./types";

/**
 * Comments form threads: a reply names the comment it answers in `parentId`, at any depth. A deleted comment that
 * still has replies stays as an empty `deleted` placeholder so the thread holds together; it goes once its replies do.
 */

export interface CommentThread {
  comment: Comment;
  /** Replies, oldest first. */
  replies: CommentThread[];
}

const oldestFirst = (a: Comment, b: Comment) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

/**
 * The comments as threads, oldest first, with each reply under the comment it answers. A reply whose comment is gone
 * starts a thread of its own, so no comment is lost.
 */
export function commentThreads(comments: Comment[]): CommentThread[] {
  const ids = new Set(comments.map((comment) => comment.id));
  const children = new Map<string, Comment[]>();
  const roots: Comment[] = [];
  for (const comment of comments)
    if (comment.parentId && comment.parentId !== comment.id && ids.has(comment.parentId))
      children.set(comment.parentId, [...(children.get(comment.parentId) ?? []), comment]);
    else roots.push(comment);
  const seen = new Set<string>();
  const build = (comment: Comment): CommentThread => {
    seen.add(comment.id);
    return {
      comment,
      replies: (children.get(comment.id) ?? [])
        .filter((reply) => !seen.has(reply.id))
        .sort(oldestFirst)
        .map(build),
    };
  };
  const threads = roots.sort(oldestFirst).map(build);
  // Comments that answer each other in a loop reach no root; each of them starts a thread instead.
  for (const comment of [...comments].sort(oldestFirst)) if (!seen.has(comment.id)) threads.push(build(comment));
  return threads.sort((a, b) => oldestFirst(a.comment, b.comment));
}

/** Every comment of the threads in reading order: each thread, then its replies below it, with their depth. */
export function threadOrder(comments: Comment[]): Array<{ comment: Comment; depth: number }> {
  const result: Array<{ comment: Comment; depth: number }> = [];
  const walk = (thread: CommentThread, depth: number) => {
    result.push({ comment: thread.comment, depth });
    for (const reply of thread.replies) walk(reply, depth + 1);
  };
  for (const thread of commentThreads(comments)) walk(thread, 0);
  return result;
}

/** The comments that are not deleted placeholders. */
export const liveComments = (comments: Comment[]) => comments.filter((comment) => !comment.deleted);

/** How many live replies a thread holds, at every depth. */
export function replyCount(thread: CommentThread): number {
  return thread.replies.reduce((sum, reply) => sum + (reply.comment.deleted ? 0 : 1) + replyCount(reply), 0);
}

/**
 * Removes a comment. One with replies becomes an empty placeholder; a placeholder left without replies goes too, up
 * the thread.
 */
export function removeComment(comments: Comment[], id: string): Comment[] {
  let next = comments.map((comment) =>
    comment.id === id ? { ...comment, text: "", deleted: true as const } : comment,
  );
  for (let size = -1; size !== next.length; ) {
    size = next.length;
    const current = next;
    next = current.filter((comment) => !comment.deleted || current.some((reply) => reply.parentId === comment.id));
  }
  return next;
}

/** Copies of the comments with new ids, the replies pointing at the copies of the comments they answer. */
export function copyComments(comments: Comment[], newId: () => string): Comment[] {
  const ids = new Map(comments.map((comment) => [comment.id, newId()]));
  return comments.map((comment) => ({
    ...comment,
    id: ids.get(comment.id)!,
    parentId: comment.parentId && ids.get(comment.parentId),
  }));
}
