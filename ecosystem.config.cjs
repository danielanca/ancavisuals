const path = require("path");
const fs = require("fs");

const serverCwd = "/var/www/vhosts/ancavisuals.ro/httpdocs";
const cwd = fs.existsSync(serverCwd) ? serverCwd : __dirname;

require("dotenv").config({ path: path.join(cwd, ".env") });

module.exports = {
  apps: [
    {
      name: "ancavisuals",
      script: "dist/server.js",
      node_args: "--no-deprecation --require ./scripts/polyfill-slowbuffer.cjs",
      exec_mode: "fork",
      cwd,
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 1994,
        FIREBASE_SERVICE_ACCOUNT_PATH: path.join(cwd, "sa.json"),
        VITE_GOOGLE_MAPS_BROWSER_KEY: process.env.VITE_GOOGLE_MAPS_BROWSER_KEY,
        BUNNY_STORAGE_KEY: process.env.BUNNY_STORAGE_KEY,
        VITE_BUNNY_STORAGE_KEY: process.env.VITE_BUNNY_STORAGE_KEY,
        BUNNY_STORAGE_ZONE: process.env.BUNNY_STORAGE_ZONE,
        BUNNY_CDN_DOMAIN: process.env.BUNNY_CDN_DOMAIN,
        VITE_BUNNY_READ_KEY: process.env.VITE_BUNNY_READ_KEY,
        VITE_BUNNY_STORAGE_ZONE_ID: process.env.VITE_BUNNY_STORAGE_ZONE_ID,
        FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
        IPINFO_TOKEN: process.env.IPINFO_TOKEN,
        BUNNY_STORAGE_PASSWORD: process.env.BUNNY_STORAGE_PASSWORD,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        FIREBASE_SERVICE_ACCOUNT_BASE64: process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
        ADMIN_NOTIFICATION_EMAIL: process.env.ADMIN_NOTIFICATION_EMAIL,
        SMTP_SENDER_EMAIL: process.env.SMTP_SENDER_EMAIL,
        SMTP_APP_PASSWORD: process.env.SMTP_APP_PASSWORD,
      }
    }
  ]
};
