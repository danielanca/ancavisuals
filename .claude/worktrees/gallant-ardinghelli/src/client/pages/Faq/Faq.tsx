import React, { useState } from "react";
import "./faq.css";
import "font-awesome/css/font-awesome.min.css";

interface FAQ {
  question: string;
  answer: string;
}

const Faq = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs: FAQ[] = [
    {
      question: "Cât costă un pachet complet foto-video pentru nuntă sau botez?",
      answer:
        "Prețul variază în funcție de numărul de ore acoperite și opțiunile incluse în pachet. Spune-ne detalii despre evenimentul tău și îți trimitem o ofertă personalizată în mai puțin de 24h.",
    },
    {
      question: "Ce conține pachetul vostru standard?",
      answer:
        "Filmări din ziua evenimentului, ședință foto, montaj video cinematic, galerie online și livrare pe stick sau DVD. La cerere, oferim și albume printate și reels pentru social media.",
    },
    {
      question: "În cât timp livrați materialele?",
      answer:
        "Timpul de livrare este între 30 și 60 de zile. Ne concentrăm pe calitate și fiecare material este editat cu atenție. Pentru urgențe, avem și opțiune de livrare rapidă.",
    },
    {
      question: "Putem alege noi muzica din video?",
      answer:
        "Desigur. Dacă ai melodii preferate, le integrăm în montaj. Dacă nu, alegem noi ceva potrivit emoției și stilului vostru.",
    },
    {
      question: "Ne puteți ajuta cu idei pentru organizarea zilei?",
      answer:
        "Da, am fost implicați în multe evenimente și putem sugera ore bune pentru golden hour, momente speciale și cum să iasă totul natural și fluid în imagini.",
    },
    {
      question: "Lucrați doar în zona noastră?",
      answer:
        "Suntem din Turda, dar acoperim toată țara și chiar și evenimente în străinătate. Trimite-ne un mesaj și găsim o variantă pentru tine.",
    },
    {
      question: "Cum putem rezerva data?",
      answer:
        "Trimite-ne un mesaj cu data evenimentului și dacă suntem disponibili, semnăm un contract simplu și se achită un avans pentru rezervare.",
    },
  ];

  const toggleDetails = (index: number): void => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="faq-section">
      <header className="faq-header">
        <h2 className="faq-title">Întrebări frecvente</h2>
        <p className="faq-subtitle">Răspunsuri la cele mai des întâlnite întrebări.</p>
      </header>
      {faqs.map((faq, index) => (
        <div key={index} className="faq-item">
          <summary className="faq-summary" onClick={() => toggleDetails(index)}>
            <h4 className="faq-question">{faq.question}</h4>
            <span className={`fa fa-chevron-down faq-icon ${openIndex === index ? "open" : ""}`} />
          </summary>
          {openIndex === index && <p className="faq-answer">{faq.answer}</p>}
          <hr className="faq-divider" />
        </div>
      ))}
    </div>
  );
};

export default Faq;
