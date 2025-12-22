import { firestore } from "../firestoreInit";

const COL = "printSelections";

export async function savePrintSelection(slug: string, items: string[]) {
  await firestore().collection(COL).doc(slug).set(
    {
      slug,
      items,
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}

export async function readPrintSelection(slug: string): Promise<string[]> {
  const snap = await firestore().collection(COL).doc(slug).get();
  if (!snap.exists) return [];
  const data = snap.data() as any;
  return Array.isArray(data?.items) ? data.items.map(String) : [];
}
