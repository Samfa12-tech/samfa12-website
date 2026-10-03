import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const sourceSha256 = 'a2b61eed4248a4daafa6b6012073ea83c46cc5959e064e9038eade837d9ac5d9';
export const hostingMetadata = '<!-- Samfa12 hosting metadata:start --><meta name="robots" content="noindex,follow"><link rel="canonical" href="https://samfa12.com/games/breakfast-beat-down/"><link rel="icon" type="image/png" href="/assets/favicon.png"><!-- Samfa12 hosting metadata:end -->';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function hostedRelease(source) {
  if (hash(source) !== sourceSha256) throw new Error('Breakfast Beat-down source does not match the reviewed v0.2 release');
  const marker = Buffer.from('</head>');
  const offset = source.indexOf(marker);
  if (offset < 0) throw new Error('Breakfast Beat-down release head is missing');
  return Buffer.concat([source.subarray(0, offset), Buffer.from(hostingMetadata), source.subarray(offset)]);
}

export function verifyRelease(hosted) {
  const metadata = Buffer.from(hostingMetadata);
  const offset = hosted.indexOf(metadata);
  if (offset < 0 || hosted.indexOf(metadata, offset + metadata.length) >= 0) throw new Error('Breakfast Beat-down hosting metadata missing or duplicated');
  const source = Buffer.concat([hosted.subarray(0, offset), hosted.subarray(offset + metadata.length)]);
  if (!hosted.equals(hostedRelease(source))) throw new Error('Breakfast Beat-down metadata placement changed');
  return { sourceSha256, hostedSha256: hash(hosted), sourceBytes: source.length, hostedBytes: hosted.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.env.BREAKFAST_BEAT_DOWN_SITE_ROOT || fileURLToPath(new URL('../', import.meta.url)));
  const target = path.join(root, 'games/breakfast-beat-down/play/index.html');
  if (process.argv[2] !== '--verify') {
    if (!process.argv[2]) throw new Error('Pass the verified owner-supplied v0.2 HTML path, or --verify');
    const release = hostedRelease(fs.readFileSync(path.resolve(process.argv[2])));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, release);
  }
  console.log('Breakfast Beat-down release verified:', JSON.stringify(verifyRelease(fs.readFileSync(target))));
}
