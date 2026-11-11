import { supabase } from "./supabase.js";

const PHOTO_BUCKET = "community-photos";
const POST_SELECT = `
  id,
  user_id,
  author_name,
  body,
  image_path,
  created_at,
  post_likes (user_id),
  post_comments (id, user_id, author_name, body, created_at)
`;

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase isn't configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
  }
  return supabase;
}

function formatRelativeTime(value) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  if (Math.abs(seconds) < 3600) return formatter.format(Math.round(seconds / 60), "minute");
  if (Math.abs(seconds) < 86400) return formatter.format(Math.round(seconds / 3600), "hour");
  if (Math.abs(seconds) < 604800) return formatter.format(Math.round(seconds / 86400), "day");
  return new Date(value).toLocaleDateString("en", { month: "short", day: "numeric" });
}

function mapPost(row) {
  const comments = (row.post_comments || [])
    .sort((left, right) => new Date(left.created_at) - new Date(right.created_at))
    .map((comment) => ({
      id: comment.id,
      userId: comment.user_id,
      name: comment.author_name,
      initials: comment.author_name.slice(0, 2).toUpperCase(),
      color: "violet",
      text: comment.body,
    }));

  return {
    id: row.id,
    userId: row.user_id,
    name: row.author_name,
    handle: `@${row.author_name.toLowerCase().replace(/[^a-z0-9]+/g, "") || "member"}`,
    initials: row.author_name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(""),
    color: "violet",
    time: formatRelativeTime(row.created_at),
    createdAt: row.created_at,
    text: row.body,
    image: row.image_path
      ? requireSupabase().storage.from(PHOTO_BUCKET).getPublicUrl(row.image_path).data.publicUrl
      : "",
    imagePath: row.image_path,
    likes: row.post_likes?.length || 0,
    likedBy: (row.post_likes || []).map((like) => like.user_id),
    comments,
    tag: "Community",
    isMember: true,
  };
}

export async function fetchCommunityPosts() {
  const client = requireSupabase();
  const { data, error } = await client
    .from("posts")
    .select(POST_SELECT)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []).map(mapPost);
}

export async function publishCommunityPost({ user, body, file }) {
  const client = requireSupabase();
  let imagePath = null;

  if (file) {
    const extension = file.name.split(".").pop()?.toLowerCase();
    const safeExtension = extension && /^[a-z0-9]{1,8}$/.test(extension)
      ? extension
      : "image";
    imagePath = `${user.id}/${crypto.randomUUID()}.${safeExtension}`;

    const { error: uploadError } = await client.storage
      .from(PHOTO_BUCKET)
      .upload(imagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
  }

  const { data, error } = await client
    .from("posts")
    .insert({
      user_id: user.id,
      author_name: user.name,
      body,
      image_path: imagePath,
    })
    .select("id")
    .single();

  if (error) {
    if (imagePath) {
      const { error: cleanupError } = await client.storage.from(PHOTO_BUCKET).remove([imagePath]);
      if (cleanupError) {
        throw new Error(`${error.message} The uploaded photo also could not be removed: ${cleanupError.message}`);
      }
    }
    throw error;
  }

  return data;
}

export async function toggleCommunityLike({ postId, userId, liked }) {
  const client = requireSupabase();
  const query = client.from("post_likes");

  const result = liked
    ? await query.delete().eq("post_id", postId).eq("user_id", userId)
    : await query.insert({ post_id: postId, user_id: userId });

  if (result.error) throw result.error;
}

export async function publishCommunityComment({ postId, user, body }) {
  const { error } = await requireSupabase()
    .from("post_comments")
    .insert({
      post_id: postId,
      user_id: user.id,
      author_name: user.name,
      body,
    });

  if (error) throw error;
}

export async function deleteCommunityPost(post) {
  const client = requireSupabase();
  const { error } = await client
    .from("posts")
    .delete()
    .eq("id", post.id)
    .eq("user_id", post.userId);

  if (error) throw error;

  if (post.imagePath) {
    const { error: photoError } = await client.storage
      .from(PHOTO_BUCKET)
      .remove([post.imagePath]);
    if (photoError) {
      throw new Error(`The post was deleted, but its photo could not be removed: ${photoError.message}`);
    }
  }
}

export function subscribeToCommunityFeed(onChange, onError) {
  const client = requireSupabase();
  const channel = client.channel("shared-community-feed");
  const tables = ["posts", "post_likes", "post_comments"];

  for (const table of tables) {
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      onChange,
    );
  }

  return channel.subscribe((status, error) => {
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      onError(error || new Error(`Community live updates failed (${status}).`));
    }
  });
}

export function unsubscribeFromCommunityFeed(channel) {
  if (channel && supabase) return supabase.removeChannel(channel);
  return Promise.resolve();
}
