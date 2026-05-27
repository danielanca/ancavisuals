import React from "react";

export interface CampaignPackage {
  id: string;
  name: string;
  price: string;
  features: string[];
  highlighted?: boolean;
}

export interface CampaignTestimonial {
  id: string;
  name: string;
  eventType: string;
  text: string;
}

export interface CampaignGalleryItem {
  url: string;
  bunnyPath: string;
}

export interface CampaignPage {
  slug: string;
  title: string;
  subtitle: string;
  ctaText: string;
  whatsappNumber: string;
  phoneNumber: string;
  heroImageUrl: string;
  heroVideoUrl: string;
  videoUrl?: string;
  gallery: CampaignGalleryItem[];
  packages: CampaignPackage[];
  testimonials: CampaignTestimonial[];
  active: boolean;
}

interface CampaignLandingPageProps {
  page: CampaignPage;
}

function WhatsAppIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.115 1.527 5.845L.057 23.455a.5.5 0 00.614.614l5.61-1.47A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.896 0-3.673-.497-5.21-1.367l-.374-.218-3.878 1.016 1.016-3.878-.218-.374A9.944 9.944 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  );
}

export default function CampaignLandingPage({ page }: CampaignLandingPageProps) {
  const whatsappLink = `https://wa.me/${page.whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent("Bună! Am văzut oferta voastră și aș dori mai multe detalii.")}`;

  return (
    <div className="min-h-screen bg-neutral-950 text-white">

      {/* ── HERO ───────────────────────────────────────────────────── */}
      <section className="relative min-h-[85vh] flex items-end overflow-hidden">
        {page.heroVideoUrl ? (
          <video
            src={page.heroVideoUrl}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : page.heroImageUrl ? (
          <img
            src={page.heroImageUrl}
            alt={page.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-900" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

        <div className="relative w-full max-w-5xl mx-auto px-6 pb-16 pt-24">
          <p className="text-amber-400 text-xs tracking-[0.3em] uppercase mb-4 font-medium">
            Ancavisuals
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light leading-tight text-white mb-4 max-w-2xl">
            {page.title}
          </h1>
          {page.subtitle && (
            <p className="text-neutral-300 text-lg font-light max-w-xl mb-10 leading-relaxed">
              {page.subtitle}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2.5 bg-green-500 hover:bg-green-400 text-white font-semibold px-7 py-4 rounded-xl text-sm transition-all active:scale-[0.98] shadow-lg shadow-green-900/40"
            >
              <WhatsAppIcon />
              {page.ctaText || "Scrie pe WhatsApp"}
            </a>
            <a
              href={`tel:${page.phoneNumber}`}
              className="inline-flex items-center justify-center gap-2.5 bg-white/10 hover:bg-white/20 backdrop-blur text-white font-medium px-7 py-4 rounded-xl text-sm border border-white/20 transition-all active:scale-[0.98]"
            >
              <PhoneIcon />
              {page.phoneNumber}
            </a>
          </div>
        </div>
      </section>

      {/* ── GALLERY ────────────────────────────────────────────────── */}
      {page.gallery.length > 0 && (
        <section className="py-20 px-6 max-w-5xl mx-auto">
          <p className="text-neutral-500 text-xs tracking-[0.25em] uppercase mb-8">Portofoliu</p>
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-2 sm:gap-3">
            {page.gallery.map((item, index) => (
              <div key={index} className="mb-2 sm:mb-3 break-inside-avoid overflow-hidden rounded-xl">
                <img
                  src={item.url}
                  alt={`Ancavisuals ${index + 1}`}
                  loading="lazy"
                  className="w-full object-cover hover:scale-[1.02] transition-transform duration-500"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── PACKAGES ───────────────────────────────────────────────── */}
      {page.packages.length > 0 && (
        <section className="py-20 px-6 bg-neutral-900/50">
          <div className="max-w-5xl mx-auto">
            <p className="text-neutral-500 text-xs tracking-[0.25em] uppercase mb-2">Pachete</p>
            <h2 className="text-3xl font-light text-white mb-10">Ce oferim</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {page.packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`rounded-2xl border p-6 flex flex-col ${
                    pkg.highlighted
                      ? "bg-amber-950/30 border-amber-700/50 shadow-lg shadow-amber-900/20"
                      : "bg-neutral-900 border-neutral-800"
                  }`}
                >
                  {pkg.highlighted && (
                    <span className="self-start text-[10px] font-bold tracking-widest uppercase text-amber-400 bg-amber-900/40 px-2.5 py-1 rounded-full mb-3">
                      Popular
                    </span>
                  )}
                  <h3 className="text-white font-semibold text-lg mb-1">{pkg.name}</h3>
                  <p className="text-amber-400 text-2xl font-light mb-5">{pkg.price}</p>
                  <ul className="space-y-2 flex-1">
                    {pkg.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-2 text-sm text-neutral-300">
                        <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-6 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-white text-sm font-medium py-3 px-4 rounded-xl transition-colors"
                  >
                    <WhatsAppIcon />
                    Alege pachetul
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── TESTIMONIALS ───────────────────────────────────────────── */}
      {page.testimonials.length > 0 && (
        <section className="py-20 px-6 max-w-5xl mx-auto">
          <p className="text-neutral-500 text-xs tracking-[0.25em] uppercase mb-2">Recenzii</p>
          <h2 className="text-3xl font-light text-white mb-10">Ce spun clienții</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {page.testimonials.map((testimonial) => (
              <div key={testimonial.id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                <p className="text-neutral-300 text-sm leading-relaxed mb-5 italic">"{testimonial.text}"</p>
                <div>
                  <p className="text-white text-sm font-medium">{testimonial.name}</p>
                  <p className="text-neutral-500 text-xs capitalize mt-0.5">{testimonial.eventType}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── FOOTER CTA ─────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-neutral-900 border-t border-neutral-800">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-light text-white mb-3">Hai să colaborăm</h2>
          <p className="text-neutral-400 text-sm mb-8">Contactați-ne pentru o consultație gratuită și o ofertă personalizată.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2.5 bg-green-500 hover:bg-green-400 text-white font-semibold px-8 py-4 rounded-xl text-sm transition-all"
            >
              <WhatsAppIcon />
              {page.ctaText || "Scrie pe WhatsApp"}
            </a>
            <a
              href={`tel:${page.phoneNumber}`}
              className="inline-flex items-center justify-center gap-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-medium px-8 py-4 rounded-xl text-sm border border-neutral-700 transition-all"
            >
              <PhoneIcon />
              Sună acum
            </a>
          </div>
        </div>
      </section>

      <div className="py-6 text-center">
        <p className="text-neutral-700 text-xs">© Ancavisuals · ancavisuals.ro</p>
      </div>
    </div>
  );
}
