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

  const validate = () => {
    const newErrors = {
        fullName :  "",
        phone: "",
        street : "",
        city : ""
    };
    if (!form.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!form.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!form.street.trim()) newErrors.street = 'Street address is required';
    if (!form.city.trim()) newErrors.city = 'City is required';
    return newErrors;
  };

  const handleSubmit = async (e : any) => {
    e.preventDefault();
    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      console.log(validationErrors);
      setErrors(validationErrors);
    }
    try {
      // Your API call here
      onSuccess?.();
      setForm(initialForm);
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
          console.log(res);
      }

    } catch (err) {
      console.error(err);
      // show error toast in real app
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Delivery Address</h2>
        </div>

        <div className={styles.content}>
          <form className={styles.form}  onSubmit={handleSubmit}>
            <div className={styles.group}>
              <label className={`${styles.label} ${styles.required}`}>Full Name</label>
              <input
                className={styles.input}
                value={form.fullName}
                onChange={ e => setForm( { ...form , fullName: e.target.value } ) } 
              />
              {errors.fullName && <div className={styles.error}>{errors.fullName}</div>}
            </div>

            <div className={styles.group}>
              <label className={`${styles.label} ${styles.required}`}>Phone Number</label>
              <input
                className={styles.input}
                type="tel"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
              />
              {errors.phone && <div className={styles.error}>{errors.phone}</div>}
            </div>

            <div className={styles.group}>
              <label className={`${styles.label} ${styles.required}`}>Street Address</label>
              <input
                className={styles.input}
                value={form.street}
                onChange={ e => setForm( { ...form, street: e.target.value } ) }
              />
              {errors.street && <div className={styles.error}>{errors.street}</div>}
            </div>

            <div className={styles.group}>
              <label className={`${styles.label} ${styles.required}`}>City</label>
              <input
                className={styles.input}
                value={form.city}
                onChange={ e => setForm({ ...form, city: e.target.value })}
              />
              {errors.city && <div className={styles.error}>{errors.city}</div>}
            </div>

            <div className={styles.group}>
              <label className={styles.label}>Easybox LockerRoom (optional)</label>
              <input
                className={styles.input}
                value={form.easybox}
                onChange={e => setForm({ ...form, easybox: e.target.value })}
                placeholder="e.g. Easybox București Mall – #1245"
              />
              <div className={styles.help}>
                Leave empty if you prefer home delivery
              </div>
            </div>

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSubmitting} 
            >
              {isSubmitting ? 'Saving...' : 'Save address'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}