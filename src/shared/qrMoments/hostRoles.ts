export type QrEventType = 'nunta' | 'botez';

export const QR_EVENT_TYPES: { value: QrEventType; label: string }[] = [
  { value: 'nunta', label: 'Nuntă' },
  { value: 'botez', label: 'Botez' },
];

export const HOST_ROLE_LABELS: Record<QrEventType, { bride: string; groom: string }> = {
  nunta: { bride: 'Mireasă', groom: 'Mire' },
  botez: { bride: 'Mama', groom: 'Tata' },
};

export function normalizeQrEventType(value: unknown): QrEventType {
  return value === 'botez' ? 'botez' : 'nunta';
}

export function getHostRoleLabel(eventType: QrEventType | undefined, role: 'bride' | 'groom'): string {
  return HOST_ROLE_LABELS[normalizeQrEventType(eventType)][role];
}

export function getHeadlineText(eventType: QrEventType | undefined): string {
  return normalizeQrEventType(eventType) === 'botez'
    ? 'Ești naș, nașă, părinte sau cunoști pe cineva care pregătește un botez?'
    : 'Ești mireasă, mire sau cunoști pe cineva care își pregătește nunta?';
}

export function getHostsPairLabel(eventType: QrEventType | undefined): string {
  return normalizeQrEventType(eventType) === 'botez' ? 'mama și tata' : 'mire și mireasă';
}

export function getHostsFallbackName(eventType: QrEventType | undefined): string {
  return normalizeQrEventType(eventType) === 'botez' ? 'Familia' : 'Mirii';
}
