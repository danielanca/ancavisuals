import React, { useState } from 'react';

const ContactForm: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    date: '',
    message: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log(formData);
    alert('Form submitted!');
  };

  return (
    <section className='form-section'>
      <h2 className='form-title'>Hai să povestim despre ziua ta specială</h2>
      <form className='contact-form' onSubmit={handleSubmit}>
        <div className='form-grid'>
          <input
            type='text'
            name='name'
            placeholder='Your Name'
            value={formData.name}
            onChange={handleChange}
            required
          />
          <input
            type='email'
            name='email'
            placeholder='Your Email'
            value={formData.email}
            onChange={handleChange}
            required
          />
          <input
            type='tel'
            name='phone'
            placeholder='Your Phone'
            value={formData.phone}
            onChange={handleChange}
            required
          />
          <input
            type='date'
            name='date'
            placeholder='Event Date'
            value={formData.date}
            onChange={handleChange}
            required
          />
          <input
            type='text'
            name='location'
            placeholder='Event Location'
            value={formData.location}
            onChange={handleChange}
            required
          />
        </div>
        <textarea
          name='message'
          placeholder='Your Message'
          rows={5}
          value={formData.message}
          onChange={handleChange}
          required
        />
        <button type='submit' className='submit-btn'>
          Send Message
        </button>
      </form>

      <div className='sqs-html-content'>
        <h4 className='notime'>No time to type it all out? </h4>
        <p className='text-center mt-6'>
          <a
            href='tel:+40745469907'
            className='inline-flex items-center gap-2 px-6 py-3 text-base font-semibold tracking-wide text-black bg-yellow-200 rounded-full hover:bg-yellow-300 transition duration-300 ease-in-out shadow-lg'
          >
            <span className='text-xl'>📞</span>
            SUNĂ-NE ACUM
          </a>
        </p>
      </div>
    </section>
  );
};

export default ContactForm;
