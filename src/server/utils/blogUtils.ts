import fs from "fs/promises";
import path from "path";
import { existsSync, readdirSync } from "fs";
import matter from "gray-matter";
import { marked } from "marked";
import { fileURLToPath } from "url";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR_CANDIDATES = [
  path.resolve(__dirname, "../../../data/blog"),
  path.resolve(__dirname, "../../../data"),
  path.resolve(__dirname, "../../../"),
];

function hasMarkdownFiles(directory: string): boolean {
  if (!existsSync(directory)) return false;

  try {
    return readdirSync(directory).some(file => file.endsWith(".md"));
  } catch {
    return false;
  }
}

function resolveBlogDir(): string {
  return BLOG_DIR_CANDIDATES.find(hasMarkdownFiles) ?? BLOG_DIR_CANDIDATES[0];
}

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  tags: string[];
  city?: string;
  coverImage?: string;
  content: string;
  status?: "draft" | "published";
  updatedAt?: string | null;
}

export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  tags: string[];
  city?: string;
  coverImage?: string;
  status?: "draft" | "published";
  updatedAt?: string | null;
}

export interface EditableBlogPost extends BlogPostMeta {
  content: string;
  status: "draft" | "published";
  source: "markdown" | "firestore";
  updatedAt: string | null;
}

export async function getAllPosts(): Promise<BlogPostMeta[]> {
  const blogDir = resolveBlogDir();
  let files: string[];
  try {
    files = await fs.readdir(blogDir);
  } catch {
    return [];
  }

  const posts: BlogPostMeta[] = [];

  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const slug = file.replace(".md", "");
    const raw = await fs.readFile(path.join(blogDir, file), "utf-8");
    const { data } = matter(raw);
    posts.push({
      slug,
      title: data.title ?? slug,
      description: data.description ?? "",
      date: data.date ?? "",
      category: data.category ?? "general",
      tags: data.tags ?? [],
      city: data.city,
      coverImage: data.coverImage,
    });
  }

  const firestorePosts = await getFirestorePosts("published");
  const bySlug = new Map(posts.map((post) => [post.slug, post]));
  for (const post of firestorePosts) bySlug.set(post.slug, post);

  return Array.from(bySlug.values()).sort((a, b) => (a.date > b.date ? -1 : 1));
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const firestorePost = await getFirestorePost(slug);
  if (firestorePost?.status === "published") {
    return {
      ...firestorePost,
      content: await marked(firestorePost.content),
    };
  }

  const blogDir = resolveBlogDir();
  const filePath = path.join(blogDir, `${slug}.md`);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }

  const { data, content } = matter(raw);
  const htmlContent = await marked(content);

  return {
    slug,
    title: data.title ?? slug,
    description: data.description ?? "",
    date: data.date ?? "",
    category: data.category ?? "general",
    tags: data.tags ?? [],
    city: data.city,
    coverImage: data.coverImage,
    content: htmlContent,
  };
}

const BLOG_COLLECTION = "blogPosts";

function toIso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : null;
}

function normalizeBlogData(slug: string, data: Record<string, unknown>, source: "markdown" | "firestore"): EditableBlogPost {
  return {
    slug,
    title: typeof data.title === "string" ? data.title : slug,
    description: typeof data.description === "string" ? data.description : "",
    date: typeof data.date === "string" ? data.date : new Date().toISOString().slice(0, 10),
    category: typeof data.category === "string" ? data.category : "general",
    tags: Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === "string") : [],
    city: typeof data.city === "string" ? data.city : undefined,
    coverImage: typeof data.coverImage === "string" ? data.coverImage : undefined,
    content: typeof data.content === "string" ? data.content : "",
    status: data.status === "draft" ? "draft" : "published",
    source,
    updatedAt: toIso(data.updatedAt),
  };
}

async function getFirestorePost(slug: string): Promise<EditableBlogPost | null> {
  try {
    const snapshot = await firestore().collection(BLOG_COLLECTION).doc(slug).get();
    return snapshot.exists ? normalizeBlogData(slug, snapshot.data() ?? {}, "firestore") : null;
  } catch (error) {
    console.error(`[blog] Firestore read failed for ${slug}:`, error);
    return null;
  }
}

async function getFirestorePosts(status?: "draft" | "published"): Promise<EditableBlogPost[]> {
  try {
    const snapshot = await firestore().collection(BLOG_COLLECTION).get();
    console.log(`[blog] loaded ${snapshot.size} Firestore posts from ${BLOG_COLLECTION}`);
    return snapshot.docs
      .map((doc) => normalizeBlogData(doc.id, doc.data(), "firestore"))
      .filter((post) => !status || post.status === status);
  } catch (error) {
    console.error("[blog] Firestore list failed:", error);
    return [];
  }
}

export async function getEditablePosts(): Promise<EditableBlogPost[]> {
  const markdownPosts = await getAllPostsFromMarkdown();
  const firestorePosts = await getFirestorePosts();
  const bySlug = new Map(markdownPosts.map((post) => [post.slug, post]));
  for (const post of firestorePosts) bySlug.set(post.slug, post);
  return Array.from(bySlug.values()).sort((a, b) => (a.date > b.date ? -1 : 1));
}

async function getAllPostsFromMarkdown(): Promise<EditableBlogPost[]> {
  const blogDir = resolveBlogDir();
  let files: string[];
  try { files = await fs.readdir(blogDir); } catch { return []; }
  const posts: EditableBlogPost[] = [];
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const slug = file.replace(/\.md$/, "");
    const raw = await fs.readFile(path.join(blogDir, file), "utf-8");
    const { data, content } = matter(raw);
    posts.push(normalizeBlogData(slug, { ...data, content }, "markdown"));
  }
  return posts;
}

export async function saveBlogPost(input: Omit<EditableBlogPost, "source" | "updatedAt">): Promise<EditableBlogPost> {
  const now = Timestamp.now();
  await firestore().collection(BLOG_COLLECTION).doc(input.slug).set({
    slug: input.slug,
    title: input.title,
    description: input.description,
    date: input.date,
    category: input.category,
    tags: input.tags,
    city: input.city ?? null,
    coverImage: input.coverImage ?? null,
    content: input.content,
    status: input.status,
    updatedAt: now,
    managedByAdmin: true,
    ...(input.status === "published" ? { publishedAt: now } : {}),
  }, { merge: true });
  return normalizeBlogData(input.slug, { ...input, updatedAt: now }, "firestore");
}

export async function importMarkdownPosts(): Promise<number> {
  const posts = await getAllPostsFromMarkdown();
  const database = firestore();
  const batch = database.batch();
  const existing = await database.collection(BLOG_COLLECTION).get();
  const existingSlugs = new Set(existing.docs.map((doc) => doc.id));
  for (const post of posts) {
    if (existingSlugs.has(post.slug)) continue;
    batch.set(database.collection(BLOG_COLLECTION).doc(post.slug), {
      slug: post.slug,
      title: post.title,
      description: post.description,
      date: post.date,
      category: post.category,
      tags: post.tags,
      city: post.city ?? null,
      coverImage: post.coverImage ?? null,
      content: post.content,
      status: "published",
      updatedAt: Timestamp.now(),
      managedByAdmin: true,
    });
  }
  const imported = posts.filter((post) => !existingSlugs.has(post.slug)).length;
  if (imported > 0) await batch.commit();
  return imported;
}
