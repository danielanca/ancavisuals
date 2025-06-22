import React from 'react';
import { useState } from "react"
import { Link } from 'react-router-dom';
import 'font-awesome/css/font-awesome.min.css';
import './faq.css'

interface FAQ {
  question: string;
  answer: string;
}

const Faq = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs: FAQ[] = [
    {
      question: 'Why is Raycast free for personal use?',
      answer:
        'We think of Raycast as a productivity layer that everybody should use to get work done faster. To make it accessible, we don’t charge for the individual plan. The plan covers all built-in extensions, such as Clipboard History, Calendar or Window Management, and provides access to all public extensions built by our community.',
    },
    {
      question: 'When is Raycast for teams available?',
      answer:
        'We don’t have an exact date right now, but we will launch Raycast for Teams in 2022. You can sign up to get early access above and be the first to hear when we’re launching it.',
    },
    {
      question: 'Question is here?',
      answer:
        'We don’t have an exact date right now, early access above and be the first to hear when we’re launching it.',
    },
  ];

  const toggleDetails = (index: number): void => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="faq-section">
      <header>
        <h2>FAQs</h2>
        <p>Answers to the most frequently asked questions.</p>
      </header>
      {faqs.map((faq, index) => (
        <div key={index} className="faq-item">
          <summary onClick={() => toggleDetails(index)}>
            <h4>{faq.question}</h4>
            <span className={`fa fa-chevron-down ${openIndex === index ? 'open' : ''}`} />
          </summary>
          {openIndex === index && <p>{faq.answer}</p>}
          <hr />
        </div>
      ))}
    </div>
  );
};

export default Faq;