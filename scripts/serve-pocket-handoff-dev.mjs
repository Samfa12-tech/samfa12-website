import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { handleRequest } from "../workers/pocket-audio-handoff/worker.js";

const root = path.resolve(".");
const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 8787);
const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"]
]);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || `127.0.0.1:${port}`}`);
    if (url.pathname.startsWith("/api/pocket-audio-handoff")) {
      await handleRelayRequest(req, res, url);
      return;
    }
    await handleStaticRequest(res, url);
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(error?.stack || String(error));
  }
});

server.listen(port, host, () => {
  const local = `http://127.0.0.1:${port}/apps/pocket-chordsmith/`;
  console.log(`Pocket Audio handoff dev server`);
  console.log(`- Local: ${local}`);
  for (const address of lanAddresses()) {
    console.log(`- Phone/LAN: http://${address}:${port}/apps/pocket-chordsmith/`);
  }
  console.log(`- Handoff page: http://127.0.0.1:${port}/apps/pocket-audio-handoff/`);
});

async function handleRelayRequest(req, res, url) {
  const body = await readRequestBody(req);
  const origin = req.headers.origin || `http://${req.headers.host}`;
  const request = new Request(url.href, {
    method: req.method,
    headers: {
      "content-type": req.headers["content-type"] || "",
      origin
    },
    body: body.length ? body : undefined
  });
  const response = await handleRequest(request, {
    PUBLIC_HANDOFF_BASE_URL: `http://${req.headers.host}/apps/pocket-audio-handoff/`,
    HANDOFF_ALLOWED_ORIGINS: origin
  });
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function handleStaticRequest(res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith("/")) pathname += "index.html";
  const filePath = path.resolve(root, `.${pathname}`);
  if (!filePath.startsWith(root)) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }
  try {
    const file = await fs.readFile(filePath);
    res.writeHead(200, {
      "content-type": mime.get(path.extname(filePath).toLowerCase()) || "application/octet-stream",
      "cache-control": "no-store"
    });
    res.end(file);
  } catch (_error) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function lanAddresses() {
  const out = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) out.push(entry.address);
    }
  }
  return out;
}
