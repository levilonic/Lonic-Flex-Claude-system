const { systemStartup } = require("./src/core/system-startup");

const withTimeout = (p, ms, label) =>
  Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(label + " timed out after " + ms + "ms")), ms))
  ]);

(async () => {
  console.log("[health] starting initialize()");
  await withTimeout(systemStartup.initialize(), 30000, "initialize");
  console.log("[health] initialize() ok");

  const container = systemStartup.getServiceContainer();
  console.log("[health] fetching system health");
  const health = await withTimeout(container.getSystemHealth(), 15000, "getSystemHealth");

  console.log(JSON.stringify({ health }, null, 2));
  console.log("[health] shutting down");
  await withTimeout(systemStartup.shutdown(), 15000, "shutdown");
  console.log("[health] shutdown-ok");
})().catch(err => { console.error("[health] ERROR", err.message); process.exitCode = 1; });
