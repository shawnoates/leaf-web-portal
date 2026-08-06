import type { Post } from "./samplePosts";

/**
 * A single mock calendar post, used in the "What shows up" feed.
 *
 * The member's name sits on the card, not the church's — that's both a
 * design choice and the visual proof of the attribution promise made in
 * the "So anyone can post anything?" section.
 */
export default function PostCard({ post }: { post: Post }) {
  return (
    <article className="post">
      <div className="post__head">
        <span
          className="post__avatar"
          style={{ background: post.tint }}
          aria-hidden="true"
        >
          {post.initials}
        </span>
        <div className="post__meta">
          <p className="post__who">{post.who}</p>
          <p className="post__when">{post.when}</p>
        </div>
      </div>
      <p className="post__body">{post.body}</p>
    </article>
  );
}
