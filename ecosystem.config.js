module.exports = {
  apps : [{
    name   : "ancavisuals",
    script : "./dist/server.js",          // entry point-ul tău
    env: {
      NODE_ENV: "production",
      PORT: 1994
    },
    // Restart automat la crash
    restart_delay: 1000,                  // 1 sec pauză între restart-uri
    max_restarts: 10,                     // max 10 restart-uri în 10 min (evită loop infinit)
    min_uptime: 5000,                     // consideră crash dacă sub 5 sec
    // Dacă vrei și la consum mare de memorie
    // max_memory_restart: "300M",
  }]
};