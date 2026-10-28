/*
 * Purpose: /servicii/:slug — a "pagină specială" SEO made in /admin/seo-radar/pagina for a keyword
 * where we didn't rank: H1, intro, sections, FAQ (also as FAQPage schema), contact call to action
 * and the portfolio. Data: GET /api/seo-pages/:slug (published pages only), HTML already sanitized
 * on the server. Shared types: src/shared/seoLandingPages.ts.
 */
import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Navbar/Footer";
import SeoPageHead from "../../components/SEO/SeoPageHead";
import PortfolioGallery from "../Portfolio/PortfolioGallery";
import { ACCENT } from "../../utils/theme";
import { seoPagePath, type SeoLandingPage as SeoPage } from "../../../shared/seoLandingPages";

export default function SeoLandingPage() {
  const { slug = "" } = useParams();
  const [page, setPage] = useState<SeoPage | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/seo-pages/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("not found");
        const data = await res.json() as { page: SeoPage };
        if (!cancelled) setPage(data.page);
      })
      .catch(() => { if (!cancelled) setMissing(true); });
    return () => { cancelled = true; };
  }, [slug]);

  if (missing) return <Navigate to="/" replace />;

  const path = seoPagePath(slug);
  return (
    <>
      {page && (
        <SeoPageHead
          title={page.seoTitle}
          description={page.metaDescription}
          canonicalPath={path}
          keywords={[page.keyword]}
          breadcrumbs={[{ label: "Acasă", to: "/" }, { label: page.h1, to: path }]}
          schema={[
            { "@type": "Service", name: page.h1, description: page.metaDescription, provider: { "@type": "Organization", name: "Anca Visuals", url: "https://www.ancavisuals.ro" }, ...(page.city ? { areaServed: page.city } : {}) },
            ...(page.faq.length ? [{
              "@type": "FAQPage",
              mainEntity: page.faq.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })),
            }] : []),
          ]}
        />
      )}
      <Navbar />
      <main className="min-h-screen bg-[#0a0a0a] pb-20 pt-24 text-white">
        <div className="mx-auto max-w-3xl px-4">
          <nav className="mb-8 flex flex-wrap gap-2 text-sm text-gray-500" aria-label="Breadcrumb">
            <Link to="/" className="transition-colors hover:text-white">Acasă</Link>
            {page && <><span>/</span><span className="max-w-xs truncate text-gray-300">{page.h1}</span></>}
          </nav>

          {!page ? (
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-3/4 bg-white/10" />
              <div className="h-4 w-full bg-white/10" />
              <div className="h-4 w-5/6 bg-white/10" />
            </div>
          ) : (
            <>
              <header className="mb-10">
                <h1 className="mb-4 text-3xl font-bold leading-tight sm:text-4xl">{page.h1}</h1>
                {page.subtitle && <p className="text-lg text-gray-400">{page.subtitle}</p>}
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link to="/contact" className={`${ACCENT.bg} ${ACCENT.bgHover} px-6 py-3 text-center font-semibold text-black transition-colors`}>Cere o ofertă</Link>
                  <Link to="/portofoliu" className={`border ${ACCENT.borderStrong} ${ACCENT.borderHover} ${ACCENT.text} px-6 py-3 text-center transition-colors`}>Vezi portofoliul</Link>
                </div>
              </header>

              <article className="blog-article max-w-none">
                <div dangerouslySetInnerHTML={{ __html: page.intro }} />
                {page.sections.map((section) => (
                  <section key={section.heading}>
                    <h2>{section.heading}</h2>
                    <div dangerouslySetInnerHTML={{ __html: section.html }} />
                  </section>
                ))}
                {page.faq.length > 0 && (
                  <section>
                    <h2>Întrebări frecvente</h2>
                    {page.faq.map((item) => (
                      <div key={item.question}>
                        <h3>{item.question}</h3>
                        <p>{item.answer}</p>
                      </div>
                    ))}
                  </section>
                )}
              </article>

              <div className={`mt-16 border ${ACCENT.border} bg-gradient-to-br ${ACCENT.bgSubtle} to-transparent p-8 text-center`}>
                <h2 className={`mb-3 text-2xl font-bold ${ACCENT.text}`}>Verificați dacă data voastră e liberă</h2>
                <p className="mx-auto mb-6 max-w-xl text-gray-300">Spuneți-ne data și locul evenimentului și vă trimitem oferta.</p>
                <div className="flex flex-col justify-center gap-3 sm:flex-row">
                  <Link to="/contact" className={`${ACCENT.bg} ${ACCENT.bgHover} px-6 py-3 font-semibold text-black transition-colors`}>Cere o ofertă</Link>
                  <Link to="/oferta/olx" className={`border ${ACCENT.borderStrong} ${ACCENT.borderHover} ${ACCENT.text} px-6 py-3 transition-colors`}>Vezi pachetele</Link>
                </div>
              </div>

              <section className="mt-20">
                <h2 className="mb-6 text-xl font-bold text-gray-200">Din portofoliul nostru</h2>
                <PortfolioGallery />
              </section>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
