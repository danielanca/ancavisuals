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

export async function saveDeliveryAddress(
  slug: string,
  address: {
    fullName: string;
    phone: string;
    street: string;
    city: string;
    easybox?: string;
  }
): Promise<void> {
  await firestore()
    .collection(COL)
    .doc(slug)
    .update({
      deliveryAddress: {
      'fullName': address.fullName.trim(),
      'phone': address.phone.trim(),
      'street': address.street.trim(),
      'city': address.city.trim(),
      'easybox': address.easybox?.trim() || null,
      deliveryAddressUpdatedAt: Date.now(),
      updatedAt: Date.now(),
    }
})
    .catch((err) => {
      // If document doesn't exist yet → fallback to set + merge
      if (err.code === 'not-found') {
        return firestore()
          .collection(COL)
          .doc(slug)
          .set(
            {
              slug,
              deliveryAddress: {
                fullName: address.fullName.trim(),
                phone: address.phone.trim(),
                street: address.street.trim(),
                city: address.city.trim(),
                easybox: address.easybox?.trim() || null,
              },
              deliveryAddressUpdatedAt: Date.now(),
              updatedAt: Date.now(),
            },
            { merge: true }
          );
      }
      throw err;
    });
}