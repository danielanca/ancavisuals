import React, { useEffect, useState } from "react";
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
  majorat: "Majorat",
  inmormantare: "Înmormântare",
  acte: "Acte & Documente",
  general: "General",
};

const CATEGORY_ORDER = ["nunta", "botez", "majorat", "inmormantare", "acte", "general"];

const BlogList: React.FC = () => {
  const [posts, setPosts] = useState(BLOG_POSTS);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");

  useEffect(() => {
    fetch("/api/blog")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setPosts(data))
      .catch(() => {});
  }, []);

  const categoriesPresent = CATEGORY_ORDER.filter(category => posts.some(post => post.category === category));
  const byCategory = categoryFilter === "all" ? posts : posts.filter(post => post.category === categoryFilter);
  const cities = Array.from(new Set(byCategory.map(post => post.city).filter(Boolean))).sort() as string[];
  const visiblePosts = cityFilter === "all" ? byCategory : byCategory.filter(post => post.city === cityFilter);

  const breadcrumbs = [
    { label: "Acasă", to: "/" },
    { label: "Blog", to: "/blog" },
  ];

  return (
    <>
      <SeoPageHead
        title="Blog foto-video — sfaturi, acte și ghiduri | Anca Visuals"
        description="Ghiduri practice pentru nunți, botezuri, majorate și înmormântări: acte necesare, sfaturi, cum alegi fotograful și multe altele."
        canonicalPath="/blog"
        keywords={["blog fotografie", "sfaturi nunta", "acte botez", "acte casatorie", "fotograf nunta", "fotograf inmormantare"]}
        breadcrumbs={breadcrumbs}
      />
      <Navbar />

      <main className="min-h-screen bg-[#0a0a0a] text-white pt-24 pb-20">
        <div className="max-w-5xl mx-auto px-4">
          <header className="mb-12 text-center">
            <h1 className="text-4xl font-bold mb-4">Blog Anca Visuals</h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Sfaturi practice, ghiduri de acte și idei utile pentru nunți, botezuri, majorate și înmormântări.
            </p>
          </header>

          <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => { setCategoryFilter("all"); setCityFilter("all"); }}
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-widest transition-colors ${categoryFilter === "all" ? `${ACCENT.border} ${ACCENT.text}` : "border-white/10 text-gray-400 hover:border-white/25 hover:text-white"}`}
            >
              Toate
            </button>
            {categoriesPresent.map(category => (
              <button
                key={category}
                onClick={() => { setCategoryFilter(category); setCityFilter("all"); }}
                className={`rounded-full border px-4 py-2 text-xs uppercase tracking-widest transition-colors ${categoryFilter === category ? `${ACCENT.border} ${ACCENT.text}` : "border-white/10 text-gray-400 hover:border-white/25 hover:text-white"}`}
              >
                {CATEGORY_LABELS[category] ?? category}
              </button>
            ))}
          </div>

          <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-gray-500">{visiblePosts.length} {visiblePosts.length === 1 ? "articol" : "articole"}</p>
            {cities.length > 1 && (
              <label className="flex items-center gap-3 text-sm text-gray-400">
                <span>Filtrează după oraș</span>
                <select value={cityFilter} onChange={event => setCityFilter(event.target.value)} className="bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-white">
                  <option value="all">Toate orașele</option>
                  {cities.map(city => <option key={city} value={city}>{city.replace(/-/g, " ")}</option>)}
                </select>
              </label>
            )}
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visiblePosts.map(post => (
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
