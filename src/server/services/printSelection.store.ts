/*
 * Purpose: encapsulates Firestore persistence for print selections, delivery
 * addresses and Swiss links associated with album slugs.
 */
import { firestore } from "../firestoreInit";

const COL = "printSelections";

type DeliveryAddress = {
  fullName: string;
  phone: string;
  street: string;
  city: string;
  easybox?: string | null;
};

type PrintSelectionDocument = {
  slug?: string;
  items?: string[];
  deliveryAddress?: DeliveryAddress;
  deliveryAddressUpdatedAt?: number;
  updatedAt?: number;
  swissLink?: string;
};

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
  const data = (snap.data() as PrintSelectionDocument | undefined) ?? {};
  return Array.isArray(data?.items) ? data.items.map(String) : [];
}

export async function saveDeliveryAddress(
  slug: string,
  address: DeliveryAddress,
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

export async function readDeliveryAddress(slug: string): Promise<PrintSelectionDocument | null> {
  const snap = await firestore().collection(COL).doc(slug).get();
  if (!snap.exists) return null;
  const data = (snap.data() as PrintSelectionDocument | undefined) ?? null;
  return data ?? null;
}



export async function addLink(slug: string,link: string): Promise<void> {
  await firestore()
    .collection(COL)
    .doc(slug)
    .update({
      swissLink: link
})
    .catch((err) => {
      throw err;
    });
}
