import { useForm, useFieldArray } from "react-hook-form";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../../../firebase";
import styles from "./CreateEvent.module.scss";

interface Host {
  name: string;
  role?: string;
  phone?: string;
  email?: string;
}

interface Guest {
  name: string;
  phone?: string;
  email?: string;
  relation?: string;
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

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return "Eroare necunoscută";
};

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
      weddingTitle: "Nunta Noastră",
      tagline: "Am decis să spunem «Da» și vrem să fii alături de noi",
      hosts: [
        { name: "", role: "Mireasă" },
        { name: "", role: "Mire" },
      ],
      initialGuests: [],
    },
    mode: "onChange",
  });

  const formValues = watch();

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
      alert("Te rugăm să te autentifici pentru a crea evenimentul");
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
        throw new Error(errorText || "Evenimentul nu a putut fi creat");
      }

      const result = await res.json();
      navigate(`/invitatie/${result.slug}`);
    } catch (error: unknown) {
      console.error("Eroare creare eveniment:", error);
      alert("Evenimentul nu a putut fi creat\n" + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1>Creează Invitația de Nuntă</h1>
          <p>Pasul {step} din 4 • Să o facem perfectă împreună</p>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <div className={styles.contentGrid}>
            {/* STÂNGA - Formular */}
            <div className={styles.formSection}>

              {/* PAS 1: Cuplu & Info de bază */}
              {step === 1 && (
                <>
                  <div className={styles.formGroup}>
                    <label>Numele cuplului (cum apare pe invitație) *</label>
                    <input
                      {...register("coupleNames", { required: "Numele cuplului este obligatoriu" })}
                      placeholder="Estera & Daniel"
                      className={errors.coupleNames ? styles.inputError : ""}
                    />
                    {errors.coupleNames && (
                      <span className={styles.errorText}>{errors.coupleNames.message}</span>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label>Titlul evenimentului</label>
                    <input {...register("weddingTitle")} placeholder="Nunta Noastră" />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Mesaj romantic</label>
                    <input {...register("tagline")} placeholder="Două inimi, o promisiune..." />
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>Data *</label>
                      <input
                        type="date"
                        {...register("eventDate", { required: "Data este obligatorie" })}
                        className={errors.eventDate ? styles.inputError : ""}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Ora ceremoniei *</label>
                      <input
                        type="time"
                        {...register("ceremonyTime", { required: "Ora este obligatorie" })}
                        className={errors.ceremonyTime ? styles.inputError : ""}
                      />
                    </div>
                  </div>

                  <button type="button" className={styles.btnPrimary} onClick={() => setStep(2)}>
                    Înainte → Gazde & Detalii
                  </button>
                </>
              )}

              {/* PAS 2: Gazde */}
              {step === 2 && (
                <>
                  <h3 className={styles.sectionTitle}>Cine organizează evenimentul?</h3>
                  <p className={styles.sectionHelp}>De obicei cuplul, uneori și părinții</p>

                  {hostFields.map((field, index) => (
                    <div key={field.id} className={styles.hostRow}>
                      <div className={styles.formGroup}>
                        <label>Nume *</label>
                        <input
                          {...register(`hosts.${index}.name` as const, { required: "Numele este obligatoriu" })}
                          placeholder="Estera Popescu"
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label>Rol</label>
                        <select {...register(`hosts.${index}.role` as const)}>
                          <option value="Mireasă">Mireasă</option>
                          <option value="Mire">Mire</option>
                          <option value="Părinții miresei">Părinții miresei</option>
                          <option value="Părinții mirelui">Părinții mirelui</option>
                          <option value="Familie">Familie</option>
                          <option value="Altul">Altul</option>
                        </select>
                      </div>

                      {index >= 2 && (
                        <button
                          type="button"
                          className={styles.btnRemove}
                          onClick={() => removeHost(index)}
                        >
                          Șterge
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    className={styles.btnAdd}
                    onClick={() => appendHost({ name: "", role: "Altul" })}
                  >
                    + Adaugă gazdă / părinte
                  </button>

                  <div className={styles.formActions}>
                    <button type="button" className={styles.btnSecondary} onClick={() => setStep(1)}>
                      ← Înapoi
                    </button>
                    <button type="button" className={styles.btnPrimary} onClick={() => setStep(3)}>
                      Înainte → Locații & Stil
                    </button>
                  </div>
                </>
              )}

              {/* PAS 3: Locații & Stil */}
              {step === 3 && (
                <>
                  <div className={styles.formGroup}>
                    <label>Orașul principal *</label>
                    <input
                      {...register("city", { required: "Orașul este obligatoriu" })}
                      placeholder="Cluj-Napoca"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Locația recepției *</label>
                    <input
                      {...register("receptionVenue", { required: "Locația recepției este obligatorie" })}
                      placeholder="Restaurant Hap & Hap, Str. Memorandumului 8"
                    />
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>Cununie civilă (opțional)</label>
                      <input {...register("civilCeremony")} placeholder="Primăria Cluj-Napoca" />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Cununie religioasă (opțional)</label>
                      <input {...register("religiousCeremony")} placeholder="Biserica Sf. Mihail" />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Cod vestimentar (opțional)</label>
                    <input {...register("dressCode")} placeholder="Formal • Cocktail • Elegant" />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Mesaj de bun venit (opțional)</label>
                    <textarea
                      {...register("welcomeMessage")}
                      placeholder="Suntem încântați să împărțim această zi specială cu voi..."
                      rows={3}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Termen confirmare prezență (opțional)</label>
                    <input type="date" {...register("rsvpDeadline")} />
                  </div>

                  <div className={styles.formActions}>
                    <button type="button" className={styles.btnSecondary} onClick={() => setStep(2)}>
                      ← Înapoi
                    </button>
                    <button type="button" className={styles.btnPrimary} onClick={() => setStep(4)}>
                      Înainte → Invitați & Finalizare
                    </button>
                  </div>
                </>
              )}

              {/* PAS 4: Invitați & Creare */}
              {step === 4 && (
                <div className={styles.finalStep}>
                  <h3>Invită-ți Cei Dragi</h3>
                  <p className={styles.sectionHelp}>
                    Adaugă primii invitați aici. Poți gestiona mai mulți ulterior.
                  </p>

                  {guestFields.map((field, index) => (
                    <div key={field.id} className={styles.guestRow}>
                      <input
                        {...register(`initialGuests.${index}.name` as const)}
                        placeholder="Numele complet al invitatului"
                      />
                      <input
                        {...register(`initialGuests.${index}.phone` as const)}
                        placeholder="Telefon (opțional)"
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
                    + Adaugă invitat
                  </button>

                  <div className={styles.formActions}>
                    <button type="button" className={styles.btnSecondary} onClick={() => setStep(3)}>
                      ← Înapoi
                    </button>
                    <button type="submit" className={styles.btnCreate} disabled={loading}>
                      {loading ? "Se creează..." : "✨ Creează Nunta & Trimite Invitații ✨"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* DREAPTA - Previzualizare live */}
            <div className={styles.previewSection}>
              <div className={styles.previewCard}>
                <div className={styles.previewHeader}>Previzualizare Invitație</div>

                <div className={styles.invitationMock}>
                  <div className={styles.namesBig}>
                    {formValues.coupleNames || "Estera ♥ Daniel"}
                  </div>

                  <div className={styles.tagline}>
                    {formValues.tagline || "Vă invităm cu drag să celebrați iubirea noastră împreună"}
                  </div>

                  <div className={styles.dateBlock}>
                    <div className={styles.date}>
                      {formValues.eventDate
                        ? new Date(formValues.eventDate).toLocaleDateString("ro-RO", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })
                        : "23 Mai 2028"}
                    </div>

                    {formValues.ceremonyTime && (
                      <div className={styles.time}>Ceremonie la ora {formValues.ceremonyTime}</div>
                    )}
                  </div>

                  {formValues.receptionVenue && (
                    <div className={styles.venue}>
                      Recepție @ {formValues.receptionVenue}
                    </div>
                  )}

                  {formValues.city && (
                    <div className={styles.city}>{formValues.city}</div>
                  )}

                  {formValues.hosts?.length > 0 && (
                    <div className={styles.hostsPreview}>
                      Organizat de:{" "}
                      {formValues.hosts
                        .map((h) => h.name)
                        .filter(Boolean)
                        .join(" & ") || "Cuplul Fericit"}
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
