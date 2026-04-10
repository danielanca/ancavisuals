import { useState } from 'react';
import styles from './DeliveryForm.module.scss';

type Props = {
    albumId: string;
    onClose:  () => void;
    onSuccess: () => void;
}

const initialForm = {
  fullName: '',
  phone: '',
  street: '',
  city: '',
  easybox: '',
};

export default function DeliveryForm({ albumId, onClose, onSuccess }:Props) {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({  fullName :  "",
    phone: "",
    street : "",
    city : ""});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Add state
const [showSuccess, setShowSuccess] = useState(false);

  const validate = () => {
    const newErrors = {
        fullName :  "",
        phone: "",
        street : "",
        city : ""
    };
    if (!form.fullName.trim()) newErrors.fullName = 'Numele și prenumele sunt obligatorii';
    if (!form.phone.trim()) newErrors.phone = 'Numărul de telefon este obligatoriu';
    if (!form.street.trim()) newErrors.street = 'Adresa stradală este obligatorie';
    if (!form.city.trim()) newErrors.city = 'Localitatea este obligatorie';
    return newErrors;
  };

  const handleSubmit = async (e : any) => {
    e.preventDefault();
    const validationErrors = validate();

    if (
      validationErrors.fullName !== "" ||
      validationErrors.city !== ""
      || validationErrors.phone !== "" 
      || validationErrors.street !== ""
      ) {
      console.log(validationErrors);
      setErrors(validationErrors);
      return;
    }
    try {
     // onSuccess?.();
      const res = await fetch(`/api/album/${albumId}/delivery-address`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          phone: form.phone,
          street: form.street,
          city: form.city,
          easybox: form.easybox || null,
        }),
      });
      
      if (res.ok) {
        setShowSuccess(true);   
        setForm(initialForm);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Adresă de livrare</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Închide"
          >
            ×
          </button>
        </div>

        <div className={styles.content}>
        {showSuccess ? (
          <div className={styles.successBanner}>
          ✓ Adresa de livrare a fost salvată cu succes!
           </div>
          ): (
          <form className={styles.form}>
            <div className={styles.group}>
              <label className={`${styles.label} ${styles.required}`}>Nume și prenume</label>
              <input
                className={styles.input}
                value={form.fullName}
                onChange={ e => setForm( { ...form , fullName: e.target.value } ) } 
              />
              {errors.fullName && <div className={styles.error}>{errors.fullName}</div>}
            </div>

            <div className={styles.group}>
              <label className={`${styles.label} ${styles.required}`}>Număr de telefon</label>
              <input
                className={styles.input}
                type="tel"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
              />
              {errors.phone && <div className={styles.error}>{errors.phone}</div>}
            </div>

            <div className={styles.group}>
              <label className={`${styles.label} ${styles.required}`}>Adresă stradală</label>
              <input
                className={styles.input}
                value={form.street}
                onChange={ e => setForm( { ...form, street: e.target.value } ) }
              />
              {errors.street && <div className={styles.error}>{errors.street}</div>}
            </div>

            <div className={styles.group}>
              <label className={`${styles.label} ${styles.required}`}>Localitate</label>
              <input
                className={styles.input}
                value={form.city}
                onChange={ e => setForm({ ...form, city: e.target.value })}
              />
              {errors.city && <div className={styles.error}>{errors.city}</div>}
            </div>

            <div className={styles.group}>
              <label className={styles.label}>Easybox / Locker (opțional)</label>
              <input
                className={styles.input}
                value={form.easybox}
                onChange={e => setForm({ ...form, easybox: e.target.value })}
                placeholder="ex. Easybox București Mall – #1245"
              />
              <div className={styles.help}>
                Lasă gol dacă dorești livrare la domiciliu
              </div>
            </div>

            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.btnCancel}
                onClick={onClose}
                disabled={isSubmitting}
              >
                Anulează
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                className={styles.btnSave}
                //disabled={isSubmitting}
              >
                {isSubmitting ? 'Se salvează...' : 'Salvează adresa'}
              </button>
            </div>
          </form>
          ) }
        </div>
      </div>
    </div>
  );
}