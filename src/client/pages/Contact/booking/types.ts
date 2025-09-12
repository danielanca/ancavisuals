// src/booking/types.ts
export type Step = 1 | 2 | 3 | 4 | 5;
export type EventType = 'nunta' | 'botez' | 'majorat' | 'cununie' | 'altceva';

export type PlaceLite = { id?: string; formattedAddress?: string; displayName?: string };

export type Errors = Partial<
  Record<'date' | 'eventType' | 'fullName' | 'phone' | 'location' | 'startTime' | 'endTime' | 'package', string>
>;

export type PkgInfo = {
  id: string;
  title: string;
  price: number;
  note?: string;
  recommended?: boolean;
};
