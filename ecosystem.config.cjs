module.exports = {
  apps: [
    {
      name: "ancavisuals",
      script: "dist/server.js",
      exec_mode: "fork",
      cwd: "/var/www/vhosts/ancavisuals.ro/httpdocs",
      env: {
        NODE_ENV: "production",
        PORT: 1994
      }
    }
  ]
};