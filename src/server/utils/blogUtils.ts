import fs from "fs/promises";
import path from "path";
import { existsSync, readdirSync } from "fs";
import matter from "gray-matter";
import { marked } from "marked";
import { fileURLToPath } from "url";

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

  return posts.sort((a, b) => (a.date > b.date ? -1 : 1));
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
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
