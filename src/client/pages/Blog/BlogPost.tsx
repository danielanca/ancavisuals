import React, { useState, useEffect } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Navbar/Footer";
import SeoPageHead from "../../components/SEO/SeoPageHead";
import { BLOG_POSTS, getPostMeta } from "../../../../data/blogManifest";
import PortfolioGallery from "../Portfolio/PortfolioGallery";
import { ACCENT } from "../../utils/theme";

interface BlogPostData {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  tags: string[];
  city?: string;
  content: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  nunta: "Nuntă",
  botez: "Botez",
  acte: "Acte & Documente",
  general: "General",
};

const BlogPost: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const meta = slug ? getPostMeta(slug) : undefined;

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/blog/${slug}`)
      .then(res => {
        if (!res.ok) throw new Error("not found");
        return res.json();
      })
      .then((data: BlogPostData) => {
        setPost(data);
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [slug]);

  if (!meta && !loading) return <Navigate to="/blog" replace />;
  if (notFound) return <Navigate to="/blog" replace />;

  const breadcrumbs = [
    { label: "Acasă", to: "/" },
    { label: "Blog", to: "/blog" },
    { label: meta?.title ?? slug ?? "", to: `/blog/${slug}` },
  ];

  const relatedPosts = BLOG_POSTS.filter(
    p => p.slug !== slug && (p.category === meta?.category || p.city === meta?.city),
  ).slice(0, 3);

  return (
    <>
      {meta && (
        <SeoPageHead
          title={`${meta.title} | Anca Visuals`}
          description={meta.description}
          canonicalPath={`/blog/${slug}`}
          keywords={meta.tags}
          breadcrumbs={breadcrumbs}
          schema={{
            "@type": "Article",
            headline: meta.title,
            description: meta.description,
            datePublished: meta.date,
            author: { "@type": "Person", name: "Anca Visuals" },
          }}
        />
      )}
      <Navbar />

      <main className="min-h-screen bg-[#0a0a0a] text-white pt-24 pb-20">
        <div className="max-w-3xl mx-auto px-4">

          {/* Breadcrumbs */}
          <nav className="text-sm text-gray-500 mb-8 flex gap-2 flex-wrap">
            <Link to="/" className="hover:text-white transition-colors">Acasă</Link>
            <span>/</span>
            <Link to="/blog" className="hover:text-white transition-colors">Blog</Link>
            {meta && (
              <>
                <span>/</span>
                <span className="text-gray-300 truncate max-w-xs">{meta.title}</span>
              </>
            )}
          </nav>

          {loading && (
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-white/10 rounded w-3/4" />
              <div className="h-4 bg-white/10 rounded w-full" />
              <div className="h-4 bg-white/10 rounded w-5/6" />
              <div className="h-4 bg-white/10 rounded w-full" />
            </div>
          )}

          {post && !loading && (
            <>
              <header className="mb-10">
                <span className={`text-xs uppercase tracking-widest ${ACCENT.textMuted} mb-3 block`}>
                  {CATEGORY_LABELS[post.category] ?? post.category}
                  {post.city ? ` · ${post.city.replace(/-/g, " ")}` : ""}
                </span>
                <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-4">{post.title}</h1>
                <p className="text-gray-400 text-lg">{post.description}</p>
                <time className="block mt-3 text-xs text-gray-500">
                  {new Date(post.date).toLocaleDateString("ro-RO", { year: "numeric", month: "long", day: "numeric" })}
                </time>
              </header>

              {/* Content */}
              <article
                className="blog-article max-w-none"
                dangerouslySetInnerHTML={{ __html: post.content }}
              />

              {/* CTA */}
              <div className={`mt-16 bg-gradient-to-br ${ACCENT.bgSubtle} to-transparent ${ACCENT.border} border rounded-2xl p-8 text-center`}>
                <h2 className={`text-2xl font-bold mb-3 ${ACCENT.text}`}>Cauți fotograf sau videograf?</h2>
                <p className="text-gray-300 mb-6 max-w-xl mx-auto">
                  La <strong className="text-white">Anca Visuals</strong> fotografiem și filmăm nunți, botezuri și majorate în toată Transilvania.
                  Stil discret, livrare rapidă, imagini pe care le revezi cu plăcere ani la rând.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link
                    to="/contact"
                    className={`${ACCENT.bg} ${ACCENT.bgHover} text-black font-semibold px-6 py-3 rounded-xl transition-colors`}
                  >
                    Cere o ofertă gratuită
                  </Link>
                  <Link
                    to="/portofoliu"
                    className={`border ${ACCENT.borderStrong} ${ACCENT.borderHover} ${ACCENT.text} px-6 py-3 rounded-xl transition-colors`}
                  >
                    Vezi portofoliu
                  </Link>
                </div>
              </div>

              {/* Related posts */}
              {relatedPosts.length > 0 && (
                <section className="mt-16">
                  <h2 className="text-xl font-bold mb-6 text-gray-200">Articole similare</h2>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {relatedPosts.map(rp => (
                      <Link
                        key={rp.slug}
                        to={`/blog/${rp.slug}`}
                        className={`group block bg-[#111] border border-white/10 rounded-xl p-4 hover:${ACCENT.border} transition-colors`}
                      >
                        <span className={`text-xs ${ACCENT.textMuted} uppercase tracking-widest mb-1 block`}>
                          {CATEGORY_LABELS[rp.category] ?? rp.category}
                        </span>
                        <h3 className={`text-sm font-semibold leading-snug group-hover:${ACCENT.text} transition-colors`}>
                          {rp.title}
                        </h3>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Portfolio gallery */}
              <section className="mt-20">
                <h2 className="text-xl font-bold mb-6 text-gray-200">Din portofoliul nostru</h2>
                <PortfolioGallery />
              </section>
            </>
          )}

        </div>
      </main>

      <Footer />
    </>
  );
};

export default BlogPost;
