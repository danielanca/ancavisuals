import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import MediaPromoFooter from "../../components/Marketing/MediaPromoFooter";
import Footer from "../../components/Navbar/Footer";
import SeoPageHead from "../../components/SEO/SeoPageHead";
import { BLOG_POSTS } from "../../../../data/blogManifest";
import { ACCENT } from "../../utils/theme";

const CATEGORY_LABELS: Record<string, string> = {
  nunta: "Nuntă",
  botez: "Botez",
  acte: "Acte & Documente",
  general: "General",
};

const BlogList: React.FC = () => {
  const posts = [...BLOG_POSTS].sort((a, b) => (a.date > b.date ? -1 : 1));

  const breadcrumbs = [
    { label: "Acasă", to: "/" },
    { label: "Blog", to: "/blog" },
  ];

  return (
    <>
      <SeoPageHead
        title="Blog foto-video — sfaturi, acte și ghiduri | Anca Visuals"
        description="Ghiduri practice pentru nunți, botezuri și majorate: acte necesare, sfaturi pentru mirese, cum alegi fotograful și multe altele."
        canonicalPath="/blog"
        keywords={["blog fotografie", "sfaturi nunta", "acte botez", "acte casatorie", "fotograf nunta"]}
        breadcrumbs={breadcrumbs}
      />
      <Navbar />

      <main className="min-h-screen bg-[#0a0a0a] text-white pt-24 pb-20">
        <div className="max-w-5xl mx-auto px-4">
          <header className="mb-12 text-center">
            <h1 className="text-4xl font-bold mb-4">Blog Anca Visuals</h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Sfaturi practice, ghiduri de acte și idei utile pentru nunți, botezuri și alte momente importante.
            </p>
          </header>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map(post => (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}`}
                className={`group block bg-[#111] border border-white/10 rounded-xl p-6 hover:${ACCENT.border} transition-colors`}
              >
                <span className={`text-xs uppercase tracking-widest ${ACCENT.textMuted} mb-2 block`}>
                  {CATEGORY_LABELS[post.category] ?? post.category}
                  {post.city ? ` · ${post.city.replace(/-/g, " ")}` : ""}
                </span>
                <h2 className={`text-base font-semibold leading-snug mb-3 group-hover:${ACCENT.text} transition-colors`}>
                  {post.title}
                </h2>
                <p className="text-gray-400 text-sm line-clamp-3">{post.description}</p>
                <span className="mt-4 inline-block text-xs text-gray-500">
                  {new Date(post.date).toLocaleDateString("ro-RO", { year: "numeric", month: "long", day: "numeric" })}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </main>

      <MediaPromoFooter />
      <Footer />
    </>
  );
};

export default BlogList;
