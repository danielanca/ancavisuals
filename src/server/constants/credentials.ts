// Email recipients and sender credentials for lead notifications.
export const adminUser = {
  email: process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SMTP_SENDER_EMAIL || "",
};

export const emailAuth = {
  email: process.env.SMTP_SENDER_EMAIL || "",
  // Google displays app passwords grouped with spaces; SMTP expects the raw value.
  password: (process.env.SMTP_APP_PASSWORD || "").replace(/\s+/g, ""),
};
