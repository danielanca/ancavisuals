import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";

const CHECKLIST_DEFAULTS = [
  {
    name: "Fotografie & Videografie",
    items: [
      "Alege fotograful și videograful",
      "Semnează contractul",
      "Stabilește pachetul (drone, photo booth, 360)",
      "Trimite lista de momente importante",
      "Confirmă ora și locațiile de filmare",
    ],
  },
  {
    name: "Venue & Locație",
    items: [
      "Vizitează locațiile potențiale",
      "Rezervă restaurantul",
      "Semnează contractul cu venue",
      "Confirmă capacitatea și meniul",
      "Stabilește aranjamentul sălii",
    ],
  },
  {
    name: "Acte & Legal",
    items: [
      "Depune dosarul la Starea Civilă",
      "Alege nașii",
      "Programează cununia religioasă",
      "Verifică actele necesare pentru biserică",
    ],
  },
  {
    name: "Outfit & Beauty",
    items: [
      "Alege rochia de mireasă",
      "Probe rochie (cel puțin 2)",
      "Alege costumul mirelui",
      "Rezervă makeup artist",
      "Rezervă coafor",
      "Test machiaj și coafură",
    ],
  },
  {
    name: "Invitați & Invitații",
    items: [
      "Fă lista de invitați",
      "Comandă invitațiile",
      "Trimite invitațiile",
      "Colectează confirmările de prezență",
      "Finalizează lista de meniuri",
    ],
  },
  {
    name: "Muzică & Entertainment",
    items: [
      "Alege formația sau DJ-ul",
      "Semnează contractul",
      "Stabilește playlist-ul",
      "Confirmă echipamentul sonor",
    ],
  },
  {
    name: "Flori & Decorațiuni",
    items: [
      "Alege florarul",
      "Stabilește buchete și aranjamente",
      "Confirmă culorile și tema",
      "Confirmă livrarea în ziua nunții",
    ],
  },
  {
    name: "Tort & Dulciuri",
    items: [
      "Alege cofetăria",
      "Degustare tort",
      "Comandă tortul",
      "Confirmă livrarea",
    ],
  },
  {
    name: "Transport",
    items: [
      "Rezervă mașina pentru cuplu",
      "Organizează transport pentru nași",
      "Confirmă traseele din ziua nunții",
    ],
  },
  {
    name: "Ziua Nunții",
    items: [
      "Confirmă toți furnizorii cu o săptămână înainte",
      "Pregătește plicurile pentru furnizori",
      "Desemnează un coordonator de zi",
      "Trimite timeline-ul tuturor furnizorilor",
    ],
  },
];

const REMINDER_DEFAULTS = [
  {
    type: "system",
    title: "12 luni înainte — Rezervă locația și fotograful",
    message: "Mai sunt 12 luni până la nuntă. Asigură-te că ai rezervat locația și echipa foto-video.",
    triggerType: "daysBeforeWedding",
    triggerValue: { daysBeforeWedding: 365, specificDate: null, condition: null },
    channels: { email: true, inApp: true },
  },
  {
    type: "system",
    title: "9 luni înainte — Alege rochia și costumul",
    message: "Mai sunt 9 luni. Este momentul să începi probele pentru rochie și costum.",
    triggerType: "daysBeforeWedding",
    triggerValue: { daysBeforeWedding: 270, specificDate: null, condition: null },
    channels: { email: true, inApp: true },
  },
  {
    type: "system",
    title: "6 luni înainte — Trimite invitațiile",
    message: "Mai sunt 6 luni. Invitațiile ar trebui trimise cât mai curând.",
    triggerType: "daysBeforeWedding",
    triggerValue: { daysBeforeWedding: 180, specificDate: null, condition: null },
    channels: { email: true, inApp: true },
  },
  {
    type: "system",
    title: "3 luni înainte — Confirmă toți furnizorii",
    message: "Mai sunt 3 luni. Contactează și confirmă fiecare furnizor.",
    triggerType: "daysBeforeWedding",
    triggerValue: { daysBeforeWedding: 90, specificDate: null, condition: null },
    channels: { email: true, inApp: true },
  },
  {
    type: "system",
    title: "1 lună înainte — Finalizează seating plan-ul",
    message: "Mai este o lună. Asigură-te că planul meselor este finalizat și trimis la restaurant.",
    triggerType: "daysBeforeWedding",
    triggerValue: { daysBeforeWedding: 30, specificDate: null, condition: null },
    channels: { email: true, inApp: true },
  },
  {
    type: "system",
    title: "2 săptămâni înainte — Pregătește plicurile pentru furnizori",
    message: "Mai sunt 2 săptămâni. Pregătește plățile rămase și plicurile pentru ziua nunții.",
    triggerType: "daysBeforeWedding",
    triggerValue: { daysBeforeWedding: 14, specificDate: null, condition: null },
    channels: { email: true, inApp: true },
  },
  {
    type: "system",
    title: "3 zile înainte — Trimite timeline-ul tuturor",
    message: "Mai sunt 3 zile. Trimite timeline-ul final fotografului, formației și restaurantului.",
    triggerType: "daysBeforeWedding",
    triggerValue: { daysBeforeWedding: 3, specificDate: null, condition: null },
    channels: { email: true, inApp: true },
  },
  {
    type: "checklist",
    title: "Task-uri restante",
    message: "Ai task-uri nefinalizate cu dată depășită în checklist-ul tău.",
    triggerType: "onCondition",
    triggerValue: { daysBeforeWedding: null, specificDate: null, condition: "checklistItemOverdue" },
    channels: { email: true, inApp: true },
  },
  {
    type: "system",
    title: "Deadline RSVP aproape",
    message: "Termenul de confirmare pentru invitați se apropie. Contactează persoanele care nu au răspuns.",
    triggerType: "onCondition",
    triggerValue: { daysBeforeWedding: null, specificDate: null, condition: "rsvpDeadline" },
    channels: { email: true, inApp: true },
  },
];

export async function seedReminderDefaults(weddingId: string, coupleEmail: string): Promise<void> {
  const database = firestore();
  const weddingRef = database.collection("wh_weddings").doc(weddingId);
  const batch = database.batch();
  const now = Timestamp.now();

  // Preferences document with special ID "preferences"
  batch.set(weddingRef.collection("reminders").doc("preferences"), {
    emailNotificationsEnabled: true,
    inAppNotificationsEnabled: true,
    emailAddress: coupleEmail,
    updatedAt: now,
  });

  for (const reminder of REMINDER_DEFAULTS) {
    const reminderRef = weddingRef.collection("reminders").doc();
    batch.set(reminderRef, {
      ...reminder,
      status: "pending",
      sentAt: null,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  await batch.commit();
}

export async function seedChecklistDefaults(weddingId: string): Promise<void> {
  const database = firestore();
  const weddingRef = database.collection("wh_weddings").doc(weddingId);
  const batch = database.batch();
  const now = Timestamp.now();

  for (let categoryIndex = 0; categoryIndex < CHECKLIST_DEFAULTS.length; categoryIndex++) {
    const category = CHECKLIST_DEFAULTS[categoryIndex];
    const categoryRef = weddingRef.collection("checklistCategories").doc();

    batch.set(categoryRef, {
      name: category.name,
      order: categoryIndex + 1,
      isDefault: true,
      createdAt: now,
    });

    for (const itemTitle of category.items) {
      const itemRef = weddingRef.collection("checklistItems").doc();
      batch.set(itemRef, {
        categoryId: categoryRef.id,
        title: itemTitle,
        notes: "",
        isCompleted: false,
        isDefault: true,
        completedAt: null,
        dueDate: null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  await batch.commit();
}
