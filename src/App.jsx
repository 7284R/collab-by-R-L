import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./utils/supabase.js";
import {
  deleteCommunityPost,
  fetchCommunityPosts,
  publishCommunityComment,
  publishCommunityPost,
  subscribeToCommunityFeed,
  toggleCommunityLike,
  unsubscribeFromCommunityFeed,
} from "./utils/community.js";

const MAX_IMAGE_SIZE = 1.5 * 1024 * 1024;

const iconPaths = {
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z" /></>,
  bookmark: <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4z" />,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
  smile: <><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" /></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
  message: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" /></>,
  send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  close: <><path d="m18 6-12 12M6 6l12 12" /></>,
  sparkle: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z" /><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2z" /></>,
  arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
};

function Icon({ name, size = 18, className = "" }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  );
}

function getInitials(name = "You") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "Y";
}

function toCommunityUser(user) {
  if (!user?.email_confirmed_at) return null;
  const email = user.email || "";
  return {
    id: user.id,
    name: user.user_metadata?.full_name?.trim() || email.split("@")[0] || "Community member",
    email,
  };
}

function Avatar({ initials, color = "coral", image, size = "normal" }) {
  return image ? (
    <img className={`avatar avatar-${size}`} src={image} alt="" />
  ) : (
    <span className={`avatar avatar-${color} avatar-${size}`} aria-hidden="true">
      {initials}
    </span>
  );
}

function AuthDialog({ mode, onClose, onModeChange, onAuth }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const result = await onAuth({ mode, name, email, password });
      if (result?.needsEmailConfirmation) {
        setNotice("Check your inbox to confirm your email address, then sign in.");
      }
    } catch (authError) {
      setError(authError.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="icon-button dialog-close" onClick={onClose} aria-label="Close dialog">
          <Icon name="close" />
        </button>
        <div className="brand-mark brand-mark-large">R/L</div>
        <p className="eyebrow">YOUR PEOPLE. YOUR SPACE.</p>
        <h2 id="auth-title">{mode === "signup" ? "Join the conversation." : "Welcome back."}</h2>
        <p className="dialog-copy">
          {mode === "signup"
            ? "Create your account and share what matters."
            : "Sign in to pick up right where you left off."}
        </p>
        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <label>
              Your name
              <input
                autoComplete="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Alex Morgan"
                maxLength={50}
              />
            </label>
          )}
          <label>
            Email address
            <input
              autoComplete="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          <button className="button button-primary auth-submit" disabled={busy}>
            {busy ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
            {!busy && <Icon name="arrow" size={16} />}
          </button>
        </form>
        <p className="auth-switch">
          {mode === "signup" ? "Already part of the community?" : "New around here?"}{" "}
          <button onClick={() => onModeChange(mode === "signup" ? "login" : "signup")}>
            {mode === "signup" ? "Sign in" : "Create an account"}
          </button>
        </p>
        <p className="privacy-note">Authentication secured by Supabase.</p>
      </section>
    </div>
  );
}

function PostCard({ post, currentUser, onLike, onComment, onDelete, onRequireAuth }) {
  const [comment, setComment] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [commentError, setCommentError] = useState("");
  const liked = Boolean(currentUser && post.likedBy?.includes(currentUser.id));
  const ownPost = currentUser?.id === post.userId;

  function submitComment(event) {
    event.preventDefault();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    if (!comment.trim()) return;
    setCommentError("");
    onComment(post.id, comment.trim())
      .then(() => {
        setComment("");
        setShowComments(true);
      })
      .catch((error) => setCommentError(error.message || "Your comment could not be published."));
  }

  return (
    <article className="post-card">
      <div className="post-top">
        <div className="post-author">
          <Avatar initials={post.initials} color={post.color} image={post.avatar} />
          <div>
            <div className="author-name">{post.name}{post.isMember && <span className="member-check">✓</span>}</div>
            <div className="post-meta">{post.handle} <span>·</span> {post.time}</div>
          </div>
        </div>
        {ownPost ? (
          <button className="icon-button post-menu" aria-label="Delete your post" onClick={() => onDelete(post.id)}>
            <Icon name="more" />
          </button>
        ) : (
          <span className="post-tag">{post.tag || "Community"}</span>
        )}
      </div>
      <p className="post-text">{post.text}</p>
      {post.image && <img className="post-image" src={post.image} alt="Shared by the community" />}
      <div className="post-stats">
        <span><span className="mini-heart">♥</span> {post.likes} likes</span>
        <button onClick={() => setShowComments((value) => !value)}>
          {post.comments?.length || 0} comments
        </button>
      </div>
      <div className="post-actions">
        <button className={liked ? "post-action liked" : "post-action"} onClick={() => onLike(post.id)}>
          <Icon name="heart" size={18} /> Like
        </button>
        <button className="post-action" onClick={() => setShowComments((value) => !value)}>
          <Icon name="message" size={18} /> Comment
        </button>
        <button className="post-action share-action" onClick={() => {
          if (navigator.share) navigator.share({ title: "Collaboration by R/L", text: post.text });
          else onRequireAuth("Sign in to share posts with your community.");
        }}>
          <Icon name="send" size={17} /> Share
        </button>
      </div>
      {showComments && (
        <div className="comments-area">
          {commentError && <p className="composer-error" role="alert">{commentError}</p>}
          {post.comments?.map((item) => (
            <div className="comment-row" key={item.id}>
              <Avatar initials={item.initials} color={item.color} size="small" />
              <p><strong>{item.name}</strong> {item.text}</p>
            </div>
          ))}
          <form className="comment-form" onSubmit={submitComment}>
            <Avatar initials={currentUser ? getInitials(currentUser.name) : "?"} color="violet" size="small" />
            <input
              aria-label="Write a comment"
              placeholder={currentUser ? "Write a comment..." : "Sign in to join the conversation"}
              value={comment}
              onFocus={() => { if (!currentUser) onRequireAuth(); }}
              onChange={(event) => setComment(event.target.value)}
            />
            <button type="submit" className="comment-send" aria-label="Send comment" disabled={!comment.trim()}>
              <Icon name="send" size={17} />
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState("");
  const [authMode, setAuthMode] = useState("");
  const [activeNav, setActiveNav] = useState("Home");
  const [draft, setDraft] = useState("");
  const [image, setImage] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imageName, setImageName] = useState("");
  const [composerError, setComposerError] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const fileInput = useRef(null);

  const refreshFeed = useCallback(async () => {
    try {
      const communityPosts = await fetchCommunityPosts();
      setPosts(communityPosts);
      setPostsError("");
      setPostsLoading(false);
      return true;
    } catch (error) {
      setPostsError(error.message || "The community feed could not be loaded.");
      setPostsLoading(false);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!image) return undefined;
    return () => URL.revokeObjectURL(image);
  }, [image]);

  useEffect(() => {
    let active = true;
    let channel;

    if (!supabase) {
      setPostsError("The community feed needs a Supabase connection.");
      setPostsLoading(false);
      return undefined;
    }

    channel = subscribeToCommunityFeed(
      () => {
        if (active) void refreshFeed();
      },
      (error) => {
        if (active) setToast(`Live updates could not connect: ${error.message}`);
      },
    );
    void refreshFeed();

    return () => {
      active = false;
      void unsubscribeFromCommunityFeed(channel);
    };
  }, [refreshFeed]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!supabase) return undefined;

    let active = true;
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) {
          setToast(`Unable to restore your session: ${error.message}`);
          return;
        }
        if (!active) return;
        const user = toCommunityUser(data.session?.user);
        setCurrentUser(user);
        if (!user && data.session) {
          supabase.auth.signOut().then(({ error: signOutError }) => {
            if (active && signOutError) {
              setToast(`Unable to clear an unverified session: ${signOutError.message}`);
            }
          }).catch((signOutError) => {
            if (active) setToast(`Unable to clear an unverified session: ${signOutError.message}`);
          });
        }
      })
      .catch((error) => {
        if (active) setToast(`Unable to restore your session: ${error.message}`);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(toCommunityUser(session?.user));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function authenticate({ mode, name, email, password }) {
    if (!supabase) {
      throw new Error("Supabase isn't configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then restart the app.");
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { full_name: name.trim() },
          emailRedirectTo: window.location.href,
        },
      });
      if (error) throw error;
      if (!data.user?.email_confirmed_at) {
        if (data.session) {
          const { error: signOutError } = await supabase.auth.signOut();
          if (signOutError) throw signOutError;
        }
        return { needsEmailConfirmation: true };
      }

      const newUser = toCommunityUser(data.user);
      setCurrentUser(newUser);
      setAuthMode("");
      setToast(`Welcome to the community, ${name.trim().split(" ")[0]}!`);
      return {};
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (error) throw error;

    const user = toCommunityUser(data.user);
    if (!user) {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      throw new Error("Please verify your email address before signing in. Check your inbox for the confirmation link.");
    }

    setCurrentUser(user);
    setAuthMode("");
    setToast(`Welcome back, ${user.name.split(" ")[0]}!`);
  }

  async function signOut() {
    if (!supabase) {
      setCurrentUser(null);
      return;
    }
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setToast(`Unable to sign out: ${error.message}`);
        return;
      }
    } catch (error) {
      setToast(`Unable to sign out: ${error.message}`);
      return;
    }
    setCurrentUser(null);
    setToast("You've signed out.");
  }

  function requireAuth(message = "Sign in or create an account to join the conversation.") {
    setToast(message);
    if (!currentUser) setAuthMode("signup");
  }

  function handleImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setComposerError("");
    if (!file.type.startsWith("image/")) {
      setComposerError("Please choose an image file.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setComposerError("Choose an image smaller than 1.5 MB.");
      event.target.value = "";
      return;
    }
    setImage(URL.createObjectURL(file));
    setImageFile(file);
    setImageName(file.name);
    event.target.value = "";
  }

  async function createPost(event) {
    event.preventDefault();
    if (!currentUser) {
      requireAuth();
      return;
    }
    if (!draft.trim() && !imageFile) {
      setComposerError("Add a thought or a photo before sharing.");
      return;
    }
    setIsPublishing(true);
    setComposerError("");
    try {
      await publishCommunityPost({ user: currentUser, body: draft.trim(), file: imageFile });
      setDraft("");
      setImage("");
      setImageFile(null);
      setImageName("");
      setToast("Your post is shared with the community.");
      if (!await refreshFeed()) {
        setToast("Your post was saved, but the community feed could not refresh.");
      }
    } catch (error) {
      setComposerError(error.message || "Your post could not be published.");
    } finally {
      setIsPublishing(false);
    }
  }

  async function toggleLike(postId) {
    if (!currentUser) {
      requireAuth("Sign in to like a post.");
      return;
    }
    const post = posts.find((item) => item.id === postId);
    if (!post) return;
    const liked = post.likedBy?.includes(currentUser.id) || false;
    try {
      await toggleCommunityLike({ postId, userId: currentUser.id, liked });
      if (!await refreshFeed()) setToast("Your like was saved, but the feed could not refresh.");
    } catch (error) {
      setToast(`Your like could not be saved: ${error.message}`);
    }
  }

  async function addComment(postId, text) {
    if (!currentUser) {
      requireAuth();
      throw new Error("Sign in to comment.");
    }
    await publishCommunityComment({ postId, user: currentUser, body: text });
    if (!await refreshFeed()) setToast("Your comment was saved, but the feed could not refresh.");
  }

  async function deletePost(postId) {
    const post = posts.find((item) => item.id === postId);
    if (!post || post.userId !== currentUser?.id) return;
    try {
      await deleteCommunityPost(post);
      if (!await refreshFeed()) {
        setToast("Your post was deleted, but the community feed could not refresh.");
        return;
      }
      setToast("Your post was deleted.");
    } catch (error) {
      setToast(`Your post could not be deleted: ${error.message}`);
    }
  }

  const visiblePosts = posts.filter((post) => {
    const query = search.trim().toLowerCase();
    return !query || `${post.name} ${post.handle} ${post.text}`.toLowerCase().includes(query);
  });

  const navItems = [
    { name: "Home", icon: "home" },
    { name: "Explore", icon: "compass" },
    { name: "Saved", icon: "bookmark" },
    { name: "Community", icon: "users" },
  ];

  return (
    <div className="app-shell">
      <aside className="left-sidebar">
        <a className="brand" href="#home" aria-label="Collaboration by R/L home">
          <span className="brand-mark">R/L</span>
          <span className="brand-name">collaboration<span>by R/L</span></span>
        </a>
        <button className="button button-primary sidebar-create" onClick={() => currentUser ? document.getElementById("thought-box")?.focus() : setAuthMode("signup")}>
          <Icon name="plus" /> Create a post
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          <p className="nav-label">MENU</p>
          {navItems.map(({ name, icon }) => (
            <button
              className={`nav-item ${activeNav === name ? "active" : ""}`}
              key={name}
              onClick={() => {
                setActiveNav(name);
                if (name !== "Home") setToast(`${name} is coming soon. For now, explore the community feed.`);
              }}
            >
              <Icon name={icon} />
              <span>{name}</span>
            </button>
          ))}
          <p className="nav-label nav-label-spaced">YOUR SPACE</p>
          <button className="nav-item" onClick={() => currentUser ? setToast("You're all caught up!") : setAuthMode("login")}>
            <Icon name="bell" /><span>Notifications</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon"><Icon name="sparkle" size={18} /></span>
            <strong>A space to be you.</strong>
            <p>Share a little, connect a lot.</p>
          </div>
          {currentUser ? (
            <button className="sidebar-profile" onClick={signOut}>
              <Avatar initials={getInitials(currentUser.name)} color="violet" />
              <span className="profile-name">{currentUser.name}<small>Sign out</small></span>
              <Icon name="more" />
            </button>
          ) : (
            <button className="sidebar-profile guest-profile" onClick={() => setAuthMode("login")}>
              <Avatar initials="RL" color="blue" />
              <span className="profile-name">Welcome, friend<small>Sign in to your account</small></span>
              <Icon name="arrow" />
            </button>
          )}
        </div>
      </aside>

      <main className="main-content" id="home">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark">R/L</span><strong>collaboration <span>by R/L</span></strong></div>
          <label className="search-box">
            <Icon name="search" size={18} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people or ideas..." aria-label="Search posts" />
            <kbd>⌘ K</kbd>
          </label>
          <div className="topbar-actions">
            <button className="icon-button top-notifications" aria-label="Notifications" onClick={() => currentUser ? setToast("You're all caught up!") : setAuthMode("login")}>
              <Icon name="bell" size={19} /><span />
            </button>
            {currentUser ? (
              <button className="top-profile" onClick={signOut} title="Sign out">
                <Avatar initials={getInitials(currentUser.name)} color="violet" size="small" />
                <span>{currentUser.name.split(" ")[0]}</span>
              </button>
            ) : (
              <div className="top-auth">
                <button className="text-button" onClick={() => setAuthMode("login")}>Log in</button>
                <button className="button button-primary top-signup" onClick={() => setAuthMode("signup")}>Sign up</button>
              </div>
            )}
          </div>
        </header>

        <div className="content-grid">
          <section className="feed-column" aria-label="Community feed">
            <section className="welcome-banner">
              <div className="banner-glow banner-glow-one" />
              <div className="banner-glow banner-glow-two" />
              <div className="banner-copy">
                <span className="eyebrow"><span className="live-dot" /> A COMMUNITY OF IDEAS</span>
                <h1>Good things happen<br />when we <span>share.</span></h1>
                <p>A little corner of the internet to be real, be creative, and find your people.</p>
                {!currentUser && (
                  <button className="banner-link" onClick={() => setAuthMode("signup")}>
                    Find your people <Icon name="arrow" size={15} />
                  </button>
                )}
              </div>
              <div className="banner-art" aria-hidden="true">
                <div className="orbit orbit-one" /><div className="orbit orbit-two" />
                <span className="art-star star-one">✳</span><span className="art-star star-two">✦</span>
                <span className="art-letter">R<span>/</span>L</span>
                <span className="art-caption">a space to connect</span>
              </div>
            </section>

            <section className="composer-card" aria-label="Create a post">
              <div className="composer-top">
                <Avatar initials={currentUser ? getInitials(currentUser.name) : "RL"} color={currentUser ? "violet" : "blue"} />
                <textarea
                  id="thought-box"
                  value={draft}
                  onChange={(event) => { setDraft(event.target.value); setComposerError(""); }}
                  onFocus={() => { if (!currentUser) setAuthMode("signup"); }}
                  placeholder={currentUser ? "What's on your mind today?" : "Share a thought with your community..."}
                  rows="2"
                  aria-label="Write your post"
                />
              </div>
              {image && (
                <div className="image-preview">
                  <img src={image} alt="Selected upload preview" />
                  <span>{imageName}</span>
                  <button className="icon-button" aria-label="Remove selected image" onClick={() => { setImage(""); setImageFile(null); setImageName(""); }}>
                    <Icon name="close" size={16} />
                  </button>
                </div>
              )}
              {composerError && <p className="composer-error" role="alert">{composerError}</p>}
              <div className="composer-footer">
                <div className="composer-tools">
                  <button className="tool-button" onClick={() => currentUser ? fileInput.current?.click() : setAuthMode("signup")}>
                    <Icon name="image" size={17} /><span>Photo</span>
                  </button>
                  <input ref={fileInput} className="visually-hidden" type="file" accept="image/*" onChange={handleImage} />
                  <button className="tool-button" onClick={() => currentUser ? setDraft((value) => `${value}${value ? " " : ""}✨`) : setAuthMode("signup")}>
                    <Icon name="smile" size={17} /><span>Feeling</span>
                  </button>
                </div>
                <button className="button button-primary share-button" onClick={createPost} disabled={isPublishing}>
                  {isPublishing ? "Sharing..." : "Share post"} {!isPublishing && <Icon name="arrow" size={15} />}
                </button>
              </div>
            </section>

            <div className="feed-toolbar">
              <div><h2>Your feed</h2><span className="feed-count">{visiblePosts.length}</span></div>
              <button className="sort-button" onClick={() => setToast("Showing the newest posts first.")}>For you <span>⌄</span></button>
            </div>
            {postsError && (
              <div className="feed-error" role="alert">
                <p>{postsError.includes("Could not find the table") || postsError.includes("relation") || postsError.includes("schema cache")
                  ? "The shared feed database has not been set up yet. Run the Supabase migration to get started."
                  : postsError}</p>
                <button className="quiet-link" onClick={() => { setPostsLoading(true); void refreshFeed(); }}>Try again</button>
              </div>
            )}
            <div className="posts-list">
              {postsLoading ? (
                <div className="empty-state"><p>Loading community posts...</p></div>
              ) : postsError ? null : visiblePosts.length ? visiblePosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUser={currentUser}
                  onLike={toggleLike}
                  onComment={addComment}
                  onDelete={deletePost}
                  onRequireAuth={requireAuth}
                />
              )) : (
                <div className="empty-state">
                  <Icon name={search.trim() ? "search" : "users"} size={25} />
                  <h3>{search.trim() ? "No posts found" : "No community posts yet"}</h3>
                  <p>{search.trim() ? "Try a different name or search term." : "Confirmed members can sign in and share the first post."}</p>
                </div>
              )}
            </div>
            <footer className="feed-footer">Made for good conversations <span>✦</span> Collaboration by R/L</footer>
          </section>

          <aside className="right-sidebar">
            <section className="side-card community-card">
              <div className="side-card-heading"><span className="side-icon"><Icon name="users" /></span><span className="online-indicator" /></div>
              <p className="eyebrow">YOUR COMMUNITY</p>
              <h2>Better, together.</h2>
              <p className="side-description">The best ideas grow when they have people to share them with.</p>
              <button className="button button-outline" onClick={() => currentUser ? setToast("You're already part of this community.") : setAuthMode("signup")}>
                {currentUser ? "You're a member" : "Join the community"} <Icon name="arrow" size={15} />
              </button>
            </section>

            <section className="quote-card">
              <span className="quote-mark">“</span>
              <p>Alone we can do so little; together we can do so much.</p>
              <span className="quote-credit">HELEN KELLER <i>✳</i></span>
            </section>
            <p className="legal-links">About <span>·</span> Guidelines <span>·</span> Privacy<br />© 2026 Collaboration by R/L</p>
          </aside>
        </div>
      </main>
      {authMode && (
        <AuthDialog
          mode={authMode}
          onClose={() => setAuthMode("")}
          onModeChange={setAuthMode}
          onAuth={authenticate}
        />
      )}
      {toast && <div className="toast" role="status"><span>✦</span>{toast}</div>}
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.slice(0, 4).map(({ name, icon }) => (
          <button className={activeNav === name ? "active" : ""} key={name} onClick={() => {
            setActiveNav(name);
            if (name !== "Home") setToast(`${name} is coming soon. For now, explore the community feed.`);
          }}>
            <Icon name={icon} size={20} /><span>{name}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
