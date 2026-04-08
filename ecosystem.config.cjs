const path = require("path");
const fs = require("fs");

const serverCwd = "/var/www/vhosts/ancavisuals.ro/httpdocs";
const cwd = fs.existsSync(serverCwd) ? serverCwd : __dirname;

module.exports = {
  apps: [
    {
      name: "ancavisuals",
      script: "dist/server.js",
      exec_mode: "fork",
      cwd,
      env: {
        NODE_ENV: "production",
        VITE_GOOGLE_MAPS_BROWSER_KEY: "AIzaSyBAd_AGvtxO0ULtSbPeTMcyZ2csARrSgXU",
        BUNNY_STORAGE_KEY: "0ce832c7-6666-4cd6-a6a2d9ebe38b-319e-4998",
        VITE_BUNNY_STORAGE_KEY: "0ce832c7-6666-4cd6-a6a2d9ebe38b-319e-4998",
        BUNNY_STORAGE_ZONE: "ancavisuals-romania",
        BUNNY_CDN_DOMAIN: "https://ancavisuals.b-cdn.net",
        VITE_BUNNY_READ_KEY: "b4a5bdb6-a828-413d-96830c9bcee1-8d36-4161",
        FIREBASE_PROJECT_ID: "joculdetectivului",
        IPINFO_TOKEN: "f8c1bf7eef0517",
        BUNNY_STORAGE_PASSWORD: "0ce832c7-6666-4cd6-a6a2d9ebe38b-319e-4998",
        ANTHROPIC_API_KEY: "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",
        FIREBASE_SERVICE_ACCOUNT_PATH: path.join(cwd, "sa.json"),
        PORT: 1994
      }
    }
  ]
};
