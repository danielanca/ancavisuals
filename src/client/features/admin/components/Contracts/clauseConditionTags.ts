/** Default-check conditions a library or template clause can carry (see isClauseApplicable on the server). */
export const CONDITION_TAGS: { value: string; label: string }[] = [
  { value: "", label: "Fără condiție (mereu bifat implicit)" },
  { value: "hasFoto", label: "Doar dacă are serviciu Foto" },
  { value: "hasVideo", label: "Doar dacă are serviciu Video" },
  { value: "hasPhotobooth", label: "Doar dacă are Fotocabină / Photo Booth" },
  { value: "hasVideobooth", label: "Doar dacă are VideoBooth 360°" },
  { value: "hasPhotoVideo", label: "Doar dacă are Foto sau Video" },
  { value: "privateClient", label: "Doar dacă e client privat (confidențialitate)" },
  { value: "notPrivateClient", label: "Doar dacă NU e client privat" },
  { value: "hasPhotoVideoAndPrivate", label: "Foto/Video + client privat" },
  { value: "hasPhotoVideoAndNotPrivate", label: "Foto/Video + NU e client privat" },
];
