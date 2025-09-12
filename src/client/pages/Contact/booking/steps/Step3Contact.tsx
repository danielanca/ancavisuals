// src/booking/steps/Step3Contact.tsx
import React from 'react';

export default function Step3Contact({ fullName, setFullName, phone, setPhone, errors, goNext, goBack }: any) {
  return (
    <>
      <h3>3) Detalii de contact</h3>
      <form
        autoComplete='on'
        onSubmit={e => {
          e.preventDefault();
          goNext();
        }}
        className='booking-form'
      >
        <label htmlFor='contact-name' className='sr-only'>
          Numele tău
        </label>
        <input
          id='contact-name'
          type='text'
          name='name'
          autoComplete='name'
          autoCapitalize='words'
          placeholder='Numele tău'
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          inputMode='text'
        />
        <label htmlFor='contact-phone' className='sr-only'>
          Numărul tău de telefon
        </label>
        <input
          id='contact-phone'
          type='tel'
          name='tel'
          autoComplete='tel'
          inputMode='tel'
          placeholder='Numărul tău de telefon'
          value={phone}
          onChange={e => setPhone(e.target.value)}
        />
        {errors.fullName && <p className='error'>{errors.fullName}</p>}
        {errors.phone && <p className='error'>{errors.phone}</p>}
        <div className='input-group' style={{ marginTop: 12 }}>
          <button type='button' onClick={goBack}>
            Înapoi
          </button>
          <button type='submit'>Continuă</button>
        </div>
      </form>
    </>
  );
}
