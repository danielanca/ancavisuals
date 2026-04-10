import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './GuestVerification.module.scss'; // create simple styles

interface VerificationForm {
  name: string;
  phone: string;
}

const GuestVerificationPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<VerificationForm>({ name: '', phone: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !formData.name.trim() || !formData.phone.trim()) {
      setError('Please enter your name and phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/event/${slug}/verify-guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          phone: formData.phone.replace(/\s+/g, '').replace(/^\+?/, ''), // normalize
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        // Redirect to invitation with verification token
        const token = json.token || 'verified';
        navigate(`/invitatie/${slug}/invitation?verified=true&guest=${encodeURIComponent(formData.name)}&token=${token}`);
      } else {
        setError(json.error || 'Sorry, you are not on the guest list. Please check your phone number.');
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      console.error('Verification error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.verificationContainer}>
      <div className={styles.card}>
        <h1 className={styles.title}>Welcome to the Wedding! 🎉</h1>
        <p className={styles.subtitle}>Please verify you're a guest</p>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label>Your Full Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. John Doe"
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label>Phone Number (as invited)</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="e.g. 08012345678 or +2348012345678"
              required
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button 
            type="submit" 
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? 'Verifying...' : 'Enter Wedding →'}
          </button>
        </form>

        <p className={styles.helpText}>
          Enter the phone number you received the invitation with. 
          Contact the couple if you have issues.
        </p>
      </div>
    </div>
  );
};

export default GuestVerificationPage;
  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return 'Verification failed. Please try again.';
  };
