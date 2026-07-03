import { Resolver } from "node:dns/promises";
import https from "node:https";

const relayBaseUrl = String(process.env.RELAY_BASE_URL || process.argv[2] || "").replace(/\/+$/g, "");
if (!relayBaseUrl) {
  console.error("Usage: RELAY_BASE_URL=https://.../api/pocket-audio-handoff npm run verify:handoff-live");
  process.exit(1);
}

async function requestJson(path, options = {}) {
  const url = `${relayBaseUrl}${path}`;
  try {
    const response = await fetch(url, options);
    return {
      response,
      body: await response.json().catch(() => ({}))
    };
  } catch (error) {
    if (error?.cause?.code !== "ENOTFOUND") {
      throw error;
    }
    return requestJsonViaCloudflareDns(url, options);
  }
}

function requestJsonViaCloudflareDns(url, options) {
  return new Promise(async (resolve, reject) => {
    const target = new URL(url);
    const resolver = new Resolver();
    resolver.setServers(["1.1.1.1", "1.0.0.1"]);

    let address;
    try {
      [address] = await resolver.resolve4(target.hostname);
    } catch (error) {
      reject(error);
      return;
    }

    const bodyText = options.body || "";
    const headers = {
      ...(options.headers || {}),
      host: target.hostname
    };
    if (bodyText) {
      headers["content-length"] = Buffer.byteLength(bodyText);
    }

    const request = https.request({
      host: address,
      servername: target.hostname,
      method: options.method || "GET",
      path: `${target.pathname}${target.search}`,
      headers
    }, response => {
      let text = "";
      response.on("data", chunk => {
        text += chunk;
      });
      response.on("end", () => {
        resolve({
          response: {
            status: response.statusCode,
            ok: response.statusCode >= 200 && response.statusCode < 300
          },
          body: text ? JSON.parse(text) : {}
        });
      });
    });
    request.on("error", reject);
    if (bodyText) {
      request.write(bodyText);
    }
    request.end();
  });
}

const testCode = `PCS1:live-verify-${Date.now().toString(36)}`;
const createResult = await requestJson("/transfers", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    origin: "https://samfa12.com"
  },
  body: JSON.stringify({
    code: testCode,
    source: "Samfa12 live verifier",
    metadata: { verifier: "verify-pocket-handoff-live" }
  })
});
const create = createResult.response;
const created = createResult.body;
if (create.status !== 201) {
  throw new Error(`Create failed ${create.status}: ${JSON.stringify(created)}`);
}

const readResult = await requestJson(`/transfers/${encodeURIComponent(created.shortCode || created.id)}`, {
  headers: { origin: "https://samfa12.com" },
  cache: "no-store"
});
const read = readResult.response;
const redeemed = readResult.body;
if (read.status !== 200) {
  throw new Error(`Redeem failed ${read.status}: ${JSON.stringify(redeemed)}`);
}
if (redeemed.code !== testCode) {
  throw new Error(`Redeemed code mismatch: ${JSON.stringify(redeemed)}`);
}

console.log(JSON.stringify({
  ok: true,
  relayBaseUrl,
  shortCode: created.shortCode || created.id,
  handoffUrl: created.url,
  expiresAt: created.expiresAt
}, null, 2));
