export function html(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function jsonLd(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

export function safeUrl(value) {
  if (typeof value !== "string" || /[\u0000-\u001f\\]/.test(value)) throw Error(`Unsafe URL: ${JSON.stringify(value)}`);
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("..")) return value;
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw Error(`Unsafe URL protocol: ${value}`);
  return value;
}

export function safeRoute(value) {
  if (typeof value !== "string" || !/^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\/$/.test(value)) throw Error(`Unsafe route: ${JSON.stringify(value)}`);
  const relative = `${value.slice(1)}index.html`;
  if (["apps/pocket-chordsmith/index.html", "apps/pocket-dj/index.html", "apps/what-would-win/index.html", "games/briarhold/play/index.html"].includes(relative)) throw Error(`Protected route: ${value}`);
  return relative;
}
