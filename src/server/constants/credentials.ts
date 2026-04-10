// Email recipients and sender credentials for lead notifications.
const DEFAULT_ADMIN_NOTIFICATION_EMAIL = "ancadaniel1994@gmail.com";
const DEFAULT_SMTP_SENDER_EMAIL = "diniubire.ro@gmail.com";
const DEFAULT_SMTP_APP_PASSWORD = "jrffukuelpyknzks";

export const adminUser = {
  email: process.env.ADMIN_NOTIFICATION_EMAIL || DEFAULT_ADMIN_NOTIFICATION_EMAIL,
};

export const emailAuth = {
  email: process.env.SMTP_SENDER_EMAIL || DEFAULT_SMTP_SENDER_EMAIL,
  password: process.env.SMTP_APP_PASSWORD || DEFAULT_SMTP_APP_PASSWORD,
};
