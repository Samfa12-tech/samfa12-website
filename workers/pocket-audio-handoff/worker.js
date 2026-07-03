const DEFAULT_TTL_SECONDS = 30 * 60;
const DEFAULT_MAX_CHARS = 500000;
const TRANSFER_PREFIX = "SAM";
const TRANSFER_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const memoryTransfers = new Map();

export default {
  fetch(request, env, context) {
    return handleRequest(request, env, context);
  }
};

export async function handleRequest(request, env = {}, context = {}) {
  const url = new URL(request.url);
  const path = normalisePath(url.pathname);

  if (request.method === "OPTIONS") {
    return corsResponse(request, env, null, { status: 204 });
  }

  if (request.method === "GET" && path === "/health") {
    return jsonResponse(request, env, { ok: true, service: "pocket-audio-handoff" });
  }

  if (request.method === "POST" && path === "/transfers") {
    return createTransfer(request, env, context);
  }

  const match = path.match(/^\/transfers\/([A-Za-z0-9-]+)$/);
  if (request.method === "GET" && match) {
    return readTransfer(request, env, match[1]);
  }

  return jsonResponse(request, env, { error: "Not found" }, { status: 404 });
}

async function createTransfer(request, env, context) {
  const body = await readJson(request);
  const code = String(body.code || "").trim();
  const maxChars = positiveInteger(env.HANDOFF_MAX_CHARS, DEFAULT_MAX_CHARS);
  if (!code.startsWith("PCS1:")) {
    return jsonResponse(request, env, { error: "Expected a PCS1 song code." }, { status: 400 });
  }
  if (code.length > maxChars) {
    return jsonResponse(request, env, { error: `PCS1 payload is too large. Max ${maxChars} characters.` }, { status: 413 });
  }

  const ttlSeconds = positiveInteger(env.HANDOFF_TTL_SECONDS, DEFAULT_TTL_SECONDS);
  const now = Date.now();
  const id = await uniqueTransferId(env);
  const record = {
    id,
    code,
    source: safeString(body.source, 80) || "Pocket Chordsmith",
    metadata: safeMetadata(body.metadata),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlSeconds * 1000).toISOString()
  };
  await putTransfer(env, id, record, ttlSeconds);

  const publicBaseUrl = safePublicBaseUrl(env.PUBLIC_HANDOFF_BASE_URL) || "https://samfa12.com/apps/pocket-audio-handoff/";
  const publicUrl = new URL(publicBaseUrl);
  publicUrl.hash = `code=${encodeURIComponent(id)}`;
  const response = {
    id,
    shortCode: id,
    url: publicUrl.href,
    expiresAt: record.expiresAt,
    ttlSeconds
  };

  if (context?.waitUntil) {
    context.waitUntil(Promise.resolve());
  }
  return jsonResponse(request, env, response, { status: 201 });
}

async function readTransfer(request, env, rawId) {
  const id = normaliseTransferId(rawId);
  if (!id) {
    return jsonResponse(request, env, { error: "Invalid transfer code." }, { status: 400 });
  }
  const record = await getTransfer(env, id);
  if (!record) {
    return jsonResponse(request, env, { error: "Transfer code not found or expired." }, { status: 404 });
  }
  if (Date.parse(record.expiresAt) <= Date.now()) {
    await deleteTransfer(env, id);
    return jsonResponse(request, env, { error: "Transfer code expired." }, { status: 410 });
  }
  return jsonResponse(request, env, {
    id: record.id,
    shortCode: record.id,
    code: record.code,
    source: record.source,
    metadata: record.metadata || {},
    createdAt: record.createdAt,
    expiresAt: record.expiresAt
  });
}

function normalisePath(pathname) {
  let path = pathname.replace(/\/+$/g, "") || "/";
  path = path.replace(/^\/api\/pocket-audio-handoff/, "");
  return path || "/";
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (_error) {
    return {};
  }
}

async function uniqueTransferId(env) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const id = `${TRANSFER_PREFIX}-${randomToken(6)}`;
    if (!(await getTransfer(env, id))) return id;
  }
  return `${TRANSFER_PREFIX}-${randomToken(8)}`;
}

function randomToken(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) out += TRANSFER_ALPHABET[byte % TRANSFER_ALPHABET.length];
  return out;
}

function normaliseTransferId(value) {
  const compact = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!compact) return "";
  const withPrefix = compact.startsWith(TRANSFER_PREFIX) ? compact : `${TRANSFER_PREFIX}${compact}`;
  const suffix = withPrefix.slice(TRANSFER_PREFIX.length);
  if (!/^[A-Z0-9]{4,10}$/.test(suffix)) return "";
  return `${TRANSFER_PREFIX}-${suffix}`;
}

async function putTransfer(env, id, record, ttlSeconds) {
  if (env.HANDOFFS?.put) {
    await env.HANDOFFS.put(storageKey(id), JSON.stringify(record), { expirationTtl: ttlSeconds });
    return;
  }
  memoryTransfers.set(storageKey(id), record);
}

async function getTransfer(env, id) {
  if (env.HANDOFFS?.get) {
    const raw = await env.HANDOFFS.get(storageKey(id));
    return raw ? JSON.parse(raw) : null;
  }
  const record = memoryTransfers.get(storageKey(id));
  if (!record) return null;
  if (Date.parse(record.expiresAt) <= Date.now()) {
    memoryTransfers.delete(storageKey(id));
    return null;
  }
  return record;
}

async function deleteTransfer(env, id) {
  if (env.HANDOFFS?.delete) {
    await env.HANDOFFS.delete(storageKey(id));
    return;
  }
  memoryTransfers.delete(storageKey(id));
}

function storageKey(id) {
  return `handoff:${id}`;
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function safeString(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function safeMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const metadata = {};
  Object.entries(value).slice(0, 20).forEach(([key, item]) => {
    if (/^[a-zA-Z0-9_.-]{1,40}$/.test(key)) metadata[key] = safeString(item, 120);
  });
  return metadata;
}

function safePublicBaseUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value));
    if (!["https:", "http:"].includes(url.protocol)) return "";
    return url.href;
  } catch (_error) {
    return "";
  }
}

function jsonResponse(request, env, body, options = {}) {
  return corsResponse(request, env, JSON.stringify(body), {
    status: options.status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...(options.headers || {})
    }
  });
}

function corsResponse(request, env, body, options = {}) {
  const headers = new Headers(options.headers || {});
  const origin = request.headers.get("origin") || "";
  const allowedOrigin = allowedCorsOrigin(origin, env);
  if (allowedOrigin) {
    headers.set("access-control-allow-origin", allowedOrigin);
    headers.set("vary", "Origin");
  }
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set("access-control-allow-headers", "content-type");
  headers.set("access-control-max-age", "600");
  return new Response(body, { status: options.status || 200, headers });
}

function allowedCorsOrigin(origin, env) {
  if (!origin) return "";
  const extra = String(env.HANDOFF_ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const allowed = new Set([
    "https://samfa12.com",
    "https://www.samfa12.com",
    "https://html-classic.itch.zone",
    "https://html.itch.zone",
    "http://127.0.0.1:4174",
    "http://localhost:4174",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://127.0.0.1:8787",
    "http://localhost:8787",
    ...extra
  ]);
  return allowed.has(origin) ? origin : "";
}
