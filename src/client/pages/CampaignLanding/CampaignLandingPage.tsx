import React, { useState } from "react";
import { measureOaiq } from "../../utils/oaiq";

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
  viewCount?: number;
  videoThumbnailUrl?: string;
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

function ArrowIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

const journeySteps = [
  {
    number: "01",
    title: "Descoperă stilul nostru",
    text: "Privește momente reale și vezi dacă felul în care spunem o poveste vă reprezintă.",
  },
  {
    number: "02",
    title: "Alege ce vi se potrivește",
    text: "Compară simplu pachetele și păstrează doar serviciile care contează pentru evenimentul vostru.",
  },
  {
    number: "03",
    title: "Verificăm împreună data",
    text: "Trimite-ne câteva detalii, iar noi revenim cu disponibilitatea și următorii pași.",
  },
];

export default function CampaignLandingPage({ page }: CampaignLandingPageProps) {
  const whatsappLink = `https://wa.me/${page.whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent("Bună! Am văzut oferta voastră și aș dori mai multe detalii.")}`;
  const [form, setForm] = useState({ name: "", phone: "", eventDate: "" });
  const [formStatus, setFormStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const trackLead = () => measureOaiq("lead_created", { type: "customer_action" });

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return;
    setFormStatus("sending");
    try {
      const res = await fetch(`/api/campaign/${page.slug}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setFormStatus(res.ok ? "sent" : "error");
      if (res.ok) trackLead();
    } catch {
      setFormStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white">

      <header className="absolute top-0 inset-x-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <a href="#acasa" className="text-xs tracking-[0.28em] uppercase font-medium text-white">Anca Visuals</a>
          <a
            href="#oferta"
            className="hidden sm:inline-flex items-center gap-2 text-xs tracking-wide text-white/80 hover:text-white transition-colors"
          >
            Vezi oferta <ArrowIcon />
          </a>
        </div>
      </header>

      {/* ── HERO ───────────────────────────────────────────────────── */}
      <section id="acasa" className="relative min-h-[85vh] flex items-end overflow-hidden">
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

        <div className="relative w-full max-w-6xl mx-auto px-6 pb-16 pt-32">
          <p className="text-amber-200 text-xs tracking-[0.3em] uppercase mb-4 font-medium">
            Foto & video pentru povești reale
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
              onClick={trackLead}
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
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/65">
            <span>✓ Răspuns personalizat</span>
            <span>✓ Pachete transparente</span>
            <span>✓ Amintiri livrate cu grijă</span>
          </div>
        </div>
      </section>

      {/* ── JOURNEY ────────────────────────────────────────────────── */}
      <section className="py-20 px-6 border-b border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-12">
            <p className="text-amber-200 text-xs tracking-[0.25em] uppercase mb-3">Simplu, de la primul mesaj</p>
            <h2 className="text-3xl sm:text-4xl font-light leading-tight">Tot ce ai nevoie ca să alegi cu încredere.</h2>
          </div>
          <div className="grid md:grid-cols-3 border-y border-white/10">
            {journeySteps.map((step, index) => (
              <div key={step.number} className={`py-8 md:py-3 md:pr-8 ${index ? "md:pl-8 md:border-l md:border-white/10" : ""}`}>
                <p className="text-amber-200 text-xs tracking-[0.2em] mb-8">{step.number}</p>
                <h3 className="text-lg font-medium mb-3">{step.title}</h3>
                <p className="text-sm leading-relaxed text-neutral-400">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GALLERY ────────────────────────────────────────────────── */}
      {page.gallery.length > 0 && (
        <section className="py-24 px-6 max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
            <div>
              <p className="text-amber-200 text-xs tracking-[0.25em] uppercase mb-3">Portofoliu</p>
              <h2 className="text-3xl font-light">Mai mult decât imagini frumoase.</h2>
            </div>
            <a href="#oferta" className="inline-flex items-center gap-2 text-sm text-white hover:text-amber-100 transition-colors">Vezi cum lucrăm <ArrowIcon /></a>
          </div>
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
        <section id="pachete" className="py-24 px-6 bg-[#151515]">
          <div className="max-w-6xl mx-auto">
            <div className="max-w-2xl mb-10">
              <p className="text-amber-200 text-xs tracking-[0.25em] uppercase mb-3">Pachete</p>
              <h2 className="text-3xl sm:text-4xl font-light text-white mb-3">Alege experiența care vi se potrivește.</h2>
              <p className="text-sm text-neutral-400 leading-relaxed">Fiecare pachet este un punct de plecare. Ne adaptăm poveștii, ritmului și oamenilor care fac ziua voastră unică.</p>
            </div>
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
                    onClick={trackLead}
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
        <section className="py-24 px-6 max-w-6xl mx-auto">
          <p className="text-amber-200 text-xs tracking-[0.25em] uppercase mb-3">Recenzii</p>
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

      {/* ── CONTACT FORM ───────────────────────────────────────────── */}
      <section id="oferta" className="py-24 px-6 bg-neutral-900 border-t border-neutral-800 scroll-mt-6">
        <div className="max-w-xl mx-auto">
          <p className="text-amber-200 text-xs tracking-[0.25em] uppercase mb-3 text-center">Ultimul pas</p>
          <h2 className="text-3xl sm:text-4xl font-light text-white mb-3 text-center">Spune-ne când are loc povestea voastră.</h2>
          <p className="text-neutral-400 text-sm mb-8 text-center leading-relaxed">Lasă-ne datele de bază. Verificăm disponibilitatea, apoi discutăm relaxat despre ce vă doriți.</p>

          {formStatus === "sent" ? (
            <div className="bg-green-900/30 border border-green-700/40 rounded-2xl p-8 text-center">
              <p className="text-3xl mb-3">✓</p>
              <p className="text-green-300 font-medium mb-1">Cererea a fost trimisă!</p>
              <p className="text-neutral-400 text-sm">Te vom contacta în curând.</p>
            </div>
          ) : (
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <input type="text" placeholder="Numele tău *" required value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3.5 text-white placeholder-neutral-500 text-sm outline-none focus:border-amber-500 transition-colors"
              />
              <input type="tel" placeholder="Telefon *" required value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3.5 text-white placeholder-neutral-500 text-sm outline-none focus:border-amber-500 transition-colors"
              />
              <input type="date" value={form.eventDate}
                onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3.5 text-white text-sm outline-none focus:border-amber-500 transition-colors"
              />
              {formStatus === "error" && <p className="text-red-400 text-sm">A apărut o eroare. Încearcă din nou.</p>}
              <button type="submit" disabled={formStatus === "sending" || !form.name || !form.phone}
                className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-semibold py-4 rounded-xl text-sm transition-all"
              >
                {formStatus === "sending" ? "Se trimite..." : "Trimite cererea"}
              </button>
            </form>
          )}

          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <a href={whatsappLink} target="_blank" rel="noreferrer" onClick={trackLead}
              className="flex-1 inline-flex items-center justify-center gap-2.5 bg-green-500 hover:bg-green-400 text-white font-semibold px-6 py-3.5 rounded-xl text-sm transition-all"
            >
              <WhatsAppIcon />
              {page.ctaText || "Scrie pe WhatsApp"}
            </a>
            <a href={`tel:${page.phoneNumber}`} onClick={trackLead}
              className="flex-1 inline-flex items-center justify-center gap-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-medium px-6 py-3.5 rounded-xl text-sm border border-neutral-700 transition-all"
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
