/*
 * Purpose: encapsulates Firestore persistence for print selections, delivery
 * addresses and Swiss links associated with album slugs.
 */
import { firestore } from "../firestore";

const COL = "printSelections";

type DeliveryAddress = {
  fullName: string;
  phone: string;
  street: string;
  county?: string | null;
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
  retentionNotifications?: AlbumRetentionNotificationState;
};

export type AlbumRetentionNotificationState = {
  sevenDaysSentAt?: number;
  oneDaySentAt?: number;
  expiredSentAt?: number;
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
    .set(
      {
        slug,
        deliveryAddress: {
          fullName: address.fullName.trim(),
          phone: address.phone.trim(),
          street: address.street.trim(),
          ...(address.county?.trim() ? { county: address.county.trim() } : {}),
          city: address.city.trim(),
          easybox: address.easybox?.trim() || null,
        },
        deliveryAddressUpdatedAt: Date.now(),
      },
      { merge: true },
    );
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

export async function readRetentionNotifications(slug: string): Promise<AlbumRetentionNotificationState> {
  const snap = await firestore().collection(COL).doc(slug).get();
  if (!snap.exists) return {};
  const data = (snap.data() as PrintSelectionDocument | undefined) ?? {};
  return data.retentionNotifications ?? {};
}

export async function markRetentionNotificationSent(
  slug: string,
  type: keyof AlbumRetentionNotificationState,
  sentAt = Date.now(),
): Promise<void> {
  const current = await readRetentionNotifications(slug);

  await firestore().collection(COL).doc(slug).set(
    {
      slug,
      retentionNotifications: {
        ...current,
        [type]: sentAt,
      },
      updatedAt: sentAt,
    },
    { merge: true },
  );
}
