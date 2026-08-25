export type QrEventType = 'nunta' | 'botez' | 'corporate';

export const QR_EVENT_TYPES: { value: QrEventType; label: string }[] = [
  { value: 'nunta', label: 'Nuntă' },
  { value: 'botez', label: 'Botez' },
  { value: 'corporate', label: 'Corporate' },
];

export const HOST_ROLE_LABELS: Record<QrEventType, { bride: string; groom: string }> = {
  nunta: { bride: 'Mireasă', groom: 'Mire' },
  botez: { bride: 'Mama', groom: 'Tata' },
  corporate: { bride: 'Organizator', groom: 'Contact' },
};

export function normalizeQrEventType(value: unknown): QrEventType {
  if (value === 'corporate') return 'corporate';
  return value === 'botez' ? 'botez' : 'nunta';
}

export function getHostRoleLabel(eventType: QrEventType | undefined, role: 'bride' | 'groom'): string {
  return HOST_ROLE_LABELS[normalizeQrEventType(eventType)][role];
}

export function getHeadlineText(eventType: QrEventType | undefined): string {
  const normalizedType = normalizeQrEventType(eventType);
  if (normalizedType === 'botez') {
    return 'Ești naș, nașă, părinte sau cunoști pe cineva care pregătește un botez?';
  }
  if (normalizedType === 'corporate') {
    return 'Ai un eveniment corporate și vrei să strângi toate amintirile într-un singur loc?';
  }
  return 'Ești mireasă, mire sau cunoști pe cineva care își pregătește nunta?';
}

export function getHostsPairLabel(eventType: QrEventType | undefined): string {
  const normalizedType = normalizeQrEventType(eventType);
  if (normalizedType === 'botez') return 'mama și tata';
  if (normalizedType === 'corporate') return 'organizator';
  return 'mire și mireasă';
}

export function getHostsFallbackName(eventType: QrEventType | undefined): string {
  const normalizedType = normalizeQrEventType(eventType);
  if (normalizedType === 'botez') return 'Familia';
  if (normalizedType === 'corporate') return 'ORGANIZATORUL';
  return 'Mirii';
}
