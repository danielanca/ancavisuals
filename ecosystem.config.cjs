module.exports = {
  apps: [
    {
      name: "ancavisuals",
      script: "server.ts",
      interpreter: "node",
      interpreter_args: "--loader tsx",
      env: {
        NODE_ENV: "production",
        PORT: 1994
      }
    }
  ]
}
