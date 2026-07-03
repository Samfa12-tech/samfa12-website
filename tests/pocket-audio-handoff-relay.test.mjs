import assert from "node:assert/strict";
import test from "node:test";
import { handleRequest } from "../workers/pocket-audio-handoff/worker.js";

const env = {
  PUBLIC_HANDOFF_BASE_URL: "https://samfa12.com/apps/pocket-audio-handoff/",
  HANDOFF_TTL_SECONDS: "60",
  HANDOFF_MAX_CHARS: "1000"
};

test("creates and redeems a short Pocket Audio handoff code", async () => {
  const create = await handleRequest(new Request("https://relay.test/api/pocket-audio-handoff/transfers", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://samfa12.com"
    },
    body: JSON.stringify({
      code: "PCS1:relay-test",
      source: "Pocket Chordsmith",
      metadata: { bpm: 96, key: "C" }
    })
  }), env);

  assert.equal(create.status, 201);
  assert.equal(create.headers.get("access-control-allow-origin"), "https://samfa12.com");
  const created = await create.json();
  assert.match(created.shortCode, /^SAM-[A-Z0-9]{6}$/);
  assert.equal(created.url, `https://samfa12.com/apps/pocket-audio-handoff/#code=${created.shortCode}`);

  const read = await handleRequest(new Request(`https://relay.test/api/pocket-audio-handoff/transfers/${created.shortCode}`), env);
  assert.equal(read.status, 200);
  const redeemed = await read.json();
  assert.equal(redeemed.code, "PCS1:relay-test");
  assert.equal(redeemed.metadata.bpm, "96");
  assert.equal(redeemed.metadata.key, "C");
});

test("rejects non-PCS1 payloads and oversized songs", async () => {
  const bad = await handleRequest(new Request("https://relay.test/transfers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: "{\"not\":\"pcs1\"}" })
  }), env);
  assert.equal(bad.status, 400);

  const huge = await handleRequest(new Request("https://relay.test/transfers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: `PCS1:${"x".repeat(1200)}` })
  }), env);
  assert.equal(huge.status, 413);
});
