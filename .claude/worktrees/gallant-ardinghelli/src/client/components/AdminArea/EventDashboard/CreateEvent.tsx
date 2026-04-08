"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../../../firebase";
import styles from "./CreateEvent.module.scss";

interface Host {
  name: string;
  role?: string; // e.g. "Bride", "Groom", "Mother of the Bride"
  phone?: string;
  email?: string;
}

interface Guest {
  name: string;
  phone?: string;
  email?: string;
  relation?: string; // family, friend, colleague, etc.
  plusOneAllowed?: boolean;
}

interface WeddingEventForm {
  coupleNames: string;
  weddingTitle: string;
  eventDate: string;
  ceremonyTime: string;
  receptionTime?: string;
  city: string;
  mainVenue: string;
  civilCeremony?: string;
  religiousCeremony?: string;
  receptionVenue: string;
  tagline?: string;
  welcomeMessage?: string;
  dressCode?: string;
  rsvpDeadline?: string;
  hosts: Host[];
  initialGuests: Guest[];
}

const CreateEvent = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<WeddingEventForm>({
    defaultValues: {
      coupleNames: "",
      weddingTitle: "Our Wedding Celebration",
      tagline: "We decided to say 'I do' and we want you by our side",
      hosts: [
        { name: "", role: "Bride" },
        { name: "", role: "Groom" },
      ],
      initialGuests: [],
    },
    mode: "onChange",
  });

  const formValues = watch(); // ← Critical for live preview!

  const { fields: hostFields, append: appendHost, remove: removeHost } = useFieldArray({
    control,
    name: "hosts",
  });

  const { fields: guestFields, append: appendGuest, remove: removeGuest } = useFieldArray({
    control,
    name: "initialGuests",
  });

  const onSubmit = async (data: WeddingEventForm) => {
    const user = auth.currentUser;
    if (!user) {
      alert("Please sign in to create your wedding event");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        ...data,
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
      };

      const res = await fetch("/api/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to create event");
      }

      const result = await res.json();

      // Redirect to guest management page
      navigate(`/invitatie/${result.slug}`);
    } catch (err: any) {
      console.error("Event creation error:", err);
      alert("Couldn't create event\n" + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1>Create Your Dream Wedding Invitation</h1>
          <p>Step {step} of 4 • Let's make it perfect together</p>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <div className={styles.contentGrid}>
            {/* LEFT - Form content */}
            <div className={styles.formSection}>
              {/* STEP 1: Couple & Basic Info */}
              {step === 1 && (
                <>
                  <div className={styles.formGroup}>
                    <label>Couple Names (as displayed) *</label>
                    <input
                      {...register("coupleNames", { required: "Couple names are required" })}
                      placeholder="Estera & Daniel"
                      className={errors.coupleNames ? styles.inputError : ""}
                    />
                    {errors.coupleNames && (
                      <span className={styles.errorText}>{errors.coupleNames.message}</span>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label>Wedding Title</label>
                    <input {...register("weddingTitle")} placeholder="Our Wedding Day" />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Romantic Tagline</label>
                    <input {...register("tagline")} placeholder="Two hearts, one promise..." />
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>Date *</label>
                      <input
                        type="date"
                        {...register("eventDate", { required: "Date is required" })}
                        className={errors.eventDate ? styles.inputError : ""}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Ceremony Time *</label>
                      <input
                        type="time"
                        {...register("ceremonyTime", { required: "Time is required" })}
                        className={errors.ceremonyTime ? styles.inputError : ""}
                      />
                    </div>
                  </div>

                  <button type="button" className={styles.btnPrimary} onClick={() => setStep(2)}>
                    Next → Hosts & Details
                  </button>
                </>
              )}

              {/* STEP 2: Hosts */}
              {step === 2 && (
                <>
                  <h3 className={styles.sectionTitle}>Who is hosting?</h3>
                  <p className={styles.sectionHelp}>Usually the couple, sometimes parents too</p>

                  {hostFields.map((field, index) => (
                    <div key={field.id} className={styles.hostRow}>
                      <div className={styles.formGroup}>
                        <label>Name *</label>
                        <input
                          {...register(`hosts.${index}.name` as const, { required: "Name is required" })}
                          placeholder="Estera Popescu"
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label>Role</label>
                        <select {...register(`hosts.${index}.role` as const)}>
                          <option value="Bride">Bride</option>
                          <option value="Groom">Groom</option>
                          <option value="Bride's Parents">Bride's Parents</option>
                          <option value="Groom's Parents">Groom's Parents</option>
                          <option value="Family">Family</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      {index >= 2 && (
                        <button
                          type="button"
                          className={styles.btnRemove}
                          onClick={() => removeHost(index)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    className={styles.btnAdd}
                    onClick={() => appendHost({ name: "", role: "Other" })}
                  >
                    + Add another host/parent
                  </button>

                  <div className={styles.formActions}>
                    <button type="button" className={styles.btnSecondary} onClick={() => setStep(1)}>
                      ← Back
                    </button>
                    <button type="button" className={styles.btnPrimary} onClick={() => setStep(3)}>
                      Next → Venues & Style
                    </button>
                  </div>
                </>
              )}

              {/* STEP 3: Venues & Style */}
              {step === 3 && (
                <>
                  <div className={styles.formGroup}>
                    <label>Main City *</label>
                    <input
                      {...register("city", { required: "City is required" })}
                      placeholder="Cluj-Napoca"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Reception Venue *</label>
                    <input
                      {...register("receptionVenue", { required: "Reception venue is required" })}
                      placeholder="Hap & Hap Restaurant, Str. Memorandumului 8"
                    />
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>Civil Ceremony (optional)</label>
                      <input {...register("civilCeremony")} placeholder="Cluj-Napoca City Hall" />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Religious Ceremony (optional)</label>
                      <input {...register("religiousCeremony")} placeholder="St. Michael's Church" />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Dress Code (optional)</label>
                    <input {...register("dressCode")} placeholder="Formal • Cocktail • Elegant chic" />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Welcome Message (optional)</label>
                    <textarea
                      {...register("welcomeMessage")}
                      placeholder="We are thrilled to share this special day with you..."
                      rows={3}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>RSVP Deadline (optional)</label>
                    <input type="date" {...register("rsvpDeadline")} />
                  </div>

                  <div className={styles.formActions}>
                    <button type="button" className={styles.btnSecondary} onClick={() => setStep(2)}>
                      ← Back
                    </button>
                    <button type="button" className={styles.btnPrimary} onClick={() => setStep(4)}>
                      Next → Guests & Finish
                    </button>
                  </div>
                </>
              )}

              {/* STEP 4: Initial Guests + Create */}
              {step === 4 && (
                <div className={styles.finalStep}>
                  <h3>Invite Your Loved Ones</h3>
                  <p className={styles.sectionHelp}>
                    Add your first guests here. You can manage more later.
                  </p>

                  {guestFields.map((field, index) => (
                    <div key={field.id} className={styles.guestRow}>
                      <input
                        {...register(`initialGuests.${index}.name` as const)}
                        placeholder="Guest Full Name"
                      />
                      <input
                        {...register(`initialGuests.${index}.phone` as const)}
                        placeholder="Phone (optional)"
                      />
                      <button
                        type="button"
                        className={styles.btnRemove}
                        onClick={() => removeGuest(index)}
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    className={styles.btnAdd}
                    onClick={() => appendGuest({ name: "" })}
                  >
                    + Add Guest
                  </button>

                  <div className={styles.formActions}>
                    <button type="button" className={styles.btnSecondary} onClick={() => setStep(3)}>
                      ← Back
                    </button>

                    <button type="submit" className={styles.btnCreate} disabled={loading}>
                      {loading ? "Creating..." : "✨ Create Wedding & Start Inviting ✨"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT - Live Preview */}
            <div className={styles.previewSection}>
              <div className={styles.previewCard}>
                <div className={styles.previewHeader}>Live Invitation Preview</div>

                <div className={styles.invitationMock}>
                  <div className={styles.namesBig}>
                    {formValues.coupleNames || "Estera ♥ Daniel"}
                  </div>

                  <div className={styles.tagline}>
                    {formValues.tagline ||
                      "We warmly invite you to celebrate our love together"}
                  </div>

                  <div className={styles.dateBlock}>
                    <div className={styles.date}>
                      {formValues.eventDate
                        ? new Date(formValues.eventDate).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })
                        : "23 May 2028"}
                    </div>

                    {formValues.ceremonyTime && (
                      <div className={styles.time}>Ceremony at {formValues.ceremonyTime}</div>
                    )}
                  </div>

                  {formValues.receptionVenue && (
                    <div className={styles.venue}>
                      Reception @ {formValues.receptionVenue}
                    </div>
                  )}

                  {formValues.city && (
                    <div className={styles.city}>{formValues.city}</div>
                  )}

                  {formValues.hosts?.length > 0 && (
                    <div className={styles.hostsPreview}>
                      Hosted by:{" "}
                      {formValues.hosts
                        .map((h) => h.name)
                        .filter(Boolean)
                        .join(" & ") || "The Happy Couple"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateEvent;