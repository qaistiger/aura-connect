export type Author = {
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_verified?: boolean;
};

export type FeedPost = {
  id: string;
  user_id: string;
  media_kind: "photo" | "video";
  media_path: string;
  caption: string;
  visibility: "public" | "only_me";
  like_count: number;
  comment_count: number;
  created_at: string;
  is_removed?: boolean;
  is_short?: boolean;
  author: Author | null;
};

export const POST_SELECT =
  "id,user_id,media_kind,media_path,caption,visibility,like_count,comment_count,created_at,is_removed,is_short,author:profiles!posts_author_fkey(username,display_name,avatar_url,is_verified)";
