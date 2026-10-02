/** Forward bounded browser diagnostics to the native debug build. */
export function installDebugDiagnostics({
  windowTarget = globalThis.window,
  consoleTarget = globalThis.console,
} = {}) {
  const plugin = windowTarget?.Capacitor?.Plugins?.DebugDiagnostics;
  if (!plugin || typeof plugin.appendLog !== "function") return () => {};
  const originals = new Map();
  const write = (level, values) => {
    const message = values.map((value) => {
      if (typeof value === "string") return value;
      try { return JSON.stringify(value); } catch { return String(value); }
    }).join(" ").slice(0, 4000);
    Promise.resolve(plugin.appendLog({level, message})).catch(() => {});
  };
  for (const level of ["debug", "info", "warn", "error"]) {
    if (typeof consoleTarget?.[level] !== "function") continue;
    const original = consoleTarget[level].bind(consoleTarget);
    originals.set(level, consoleTarget[level]);
    consoleTarget[level] = (...values) => { original(...values); write(level, values); };
  }
  const onError = (event) => write("error", [`window.error: ${event?.message ?? "unknown"}`, event?.filename ?? ""]);
  const onRejection = (event) => write("error", ["unhandledrejection", event?.reason ?? "unknown"]);
  windowTarget?.addEventListener?.("error", onError);
  windowTarget?.addEventListener?.("unhandledrejection", onRejection);
  write("info", ["debug diagnostics started"]);
  return () => {
    for (const [level, original] of originals) consoleTarget[level] = original;
    windowTarget?.removeEventListener?.("error", onError);
    windowTarget?.removeEventListener?.("unhandledrejection", onRejection);
  };
}
