import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// The original owner package remains private. Protect the reviewed hosting copy.
export const sourceSha256 = '56c4f1c04ce505aed5dfcf6351360a9320dcb9c3bdfc734ef6eda2574d1325b7';
export const hostedSha256 = '76b0a38337ca25a6e7bd2bbe413e501db806739e293ccafe0ab56f20b6892a6a';
export function verifyRelease(bytes) {
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== hostedSha256) throw new Error('Banana Banana Ducky! differs from the reviewed v1.1 hosting copy');
  return { sourceSha256, hostedSha256: actual, hostedBytes: bytes.length };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.env.BANANA_DUCKY_SITE_ROOT || fileURLToPath(new URL('../', import.meta.url)));
  console.log('Banana Banana Ducky! release verified:', JSON.stringify(verifyRelease(fs.readFileSync(path.join(root, 'games/banana-banana-ducky/play/index.html')))));
}
