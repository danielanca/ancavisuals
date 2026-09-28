import React, { useState, useEffect } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import MediaPromoFooter from "../../components/Marketing/MediaPromoFooter";
import Footer from "../../components/Navbar/Footer";
import SeoPageHead from "../../components/SEO/SeoPageHead";
import { getPostMeta } from "../../../../data/blogManifest";
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
  coverImage?: string;
  content: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  nunta: "Nuntă",
  botez: "Botez",
  majorat: "Majorat",
  inmormantare: "Înmormântare",
  acte: "Acte & Documente",
  general: "General",
};

const BlogPost: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const staticMeta = slug ? getPostMeta(slug) : undefined;

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

  const meta = post ?? staticMeta;
  if (!meta && !loading) return <Navigate to="/" replace />;
  if (notFound) return <Navigate to="/" replace />;

  const breadcrumbs = [
    { label: "Acasă", to: "/" },
    { label: meta?.title ?? slug ?? "", to: `/blog/${slug}` },
  ];

  return (
    <>
      {meta && (
        <SeoPageHead
          title={`${meta.title} | Anca Visuals`}
          description={meta.description}
          canonicalPath={`/blog/${slug}`}
          keywords={meta.tags}
          breadcrumbs={breadcrumbs}
          image={meta.coverImage}
          schema={{
            "@type": "Article",
            headline: meta.title,
            description: meta.description,
            datePublished: meta.date,
            author: { "@type": "Person", name: "Anca Visuals" },
            ...(meta.coverImage ? { image: meta.coverImage } : {}),
          }}
        />
      )}
      <Navbar />

      <main className="min-h-screen bg-[#0a0a0a] text-white pt-24 pb-20">
        <div className="max-w-3xl mx-auto px-4">

          {/* Breadcrumbs */}
          <nav className="text-sm text-gray-500 mb-8 flex gap-2 flex-wrap">
            <Link to="/" className="hover:text-white transition-colors">Acasă</Link>
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
                {post.coverImage && (
                  <img
                    src={post.coverImage}
                    alt={post.title}
                    className="w-full rounded-2xl border border-white/10 mb-6 object-cover max-h-[480px]"
                    loading="eager"
                  />
                )}
                <p className="text-gray-400 text-lg">{post.description}</p>
              </header>

              {/* Content */}
              <article
                className="blog-article max-w-none"
                dangerouslySetInnerHTML={{ __html: post.content }}
              />

              {/* CTA */}
              {post.category === "inmormantare" ? (
                <div className={`mt-16 bg-gradient-to-br ${ACCENT.bgSubtle} to-transparent ${ACCENT.border} border rounded-2xl p-8 text-center`}>
                  <h2 className={`text-2xl font-bold mb-3 ${ACCENT.text}`}>Cauți fotograf și/sau videograf?</h2>
                  <p className="text-gray-300 mb-6 max-w-xl mx-auto">
                    La <strong className="text-white">Anca Visuals</strong> fotografiem și filmăm evenimentul tău.
                    Stil discret, livrare rapidă, imagini pe care le revezi cu plăcere ani la rând.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <a
                      href={`https://wa.me/40745469907?text=${encodeURIComponent("Bună ziua. Aș dori să discut despre servicii foto-video pentru o înmormântare. Data: … Localitatea: …")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-[#25d366] hover:bg-[#1fbf5a] text-black font-semibold px-6 py-3 rounded-xl transition-colors"
                    >
                      Scrie-ne pe WhatsApp
                    </a>
                    <a
                      href="tel:+40745469907"
                      className={`border ${ACCENT.borderStrong} ${ACCENT.borderHover} ${ACCENT.text} px-6 py-3 rounded-xl transition-colors font-semibold`}
                    >
                      0745 469 907 (Apelează acum)
                    </a>
                  </div>
                </div>
              ) : (
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
              )}

              {/* Portfolio gallery */}
              <section className="mt-20">
                <h2 className="text-xl font-bold mb-6 text-gray-200">Din portofoliul nostru</h2>
                <PortfolioGallery minTotalImages={post.category === "inmormantare" ? 20 : 0} />
              </section>
            </>
          )}

        </div>
      </main>

      <MediaPromoFooter />
      <Footer />
    </>
  );
};

export default BlogPost;
