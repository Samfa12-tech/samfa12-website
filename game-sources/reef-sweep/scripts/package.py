"""Package an already-built Reef Sweep distribution using only the Python standard library.
Run npm run test:package first, then python scripts/package.py [output_directory].
"""
from pathlib import Path
import hashlib
import json
import shutil
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / 'release'
OUT.mkdir(parents=True, exist_ok=True)
VERSION = 'v0.3-preview.1'
STAMP = (2026, 10, 14, 0, 0, 0)


def write_zip(destination: Path, paths: list[tuple[Path, str]]) -> None:
    with zipfile.ZipFile(destination, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path, name in sorted(paths, key=lambda item: item[1]):
            info = zipfile.ZipInfo(name, STAMP)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    with zipfile.ZipFile(destination) as archive:
        if archive.testzip() is not None:
            raise RuntimeError(f'ZIP integrity check failed: {destination}')


for required in ['dist/index.html', 'dist/game.js', 'dist/babylon.js', 'Reef-Sweep.html', 'docs/CODEX_HANDOFF.md']:
    if not (ROOT / required).is_file():
        raise SystemExit(f'Missing {required}; run npm run build and check the handoff documents.')

web = OUT / f'reef-sweep-{VERSION}-web.zip'
write_zip(web, [(p, p.relative_to(ROOT / 'dist').as_posix()) for p in (ROOT / 'dist').rglob('*') if p.is_file()])

base_files = ['README.md', 'START-HERE.html', 'AGENTS.md', 'package.json', 'package-lock.json', 'tsconfig.json', '.gitignore',
              'index.html', 'style.css', 'THIRD_PARTY_NOTICES.md', 'LICENSE-BABYLON.txt', 'Reef-Sweep.html']
paths = [ROOT / name for name in base_files]
for directory in ['src', 'scripts', 'tests', 'docs', 'public', 'vendor', 'reference', 'screenshots', 'dist']:
    paths.extend(p for p in (ROOT / directory).rglob('*') if p.is_file() and '__pycache__' not in p.parts
                 and p.name != 'modules.generated.json')
handoff = OUT / f'reef-sweep-{VERSION}-handoff.zip'
write_zip(handoff, [(p, 'reef-sweep/' + p.relative_to(ROOT).as_posix()) for p in paths])
standalone = OUT / f'Reef-Sweep-{VERSION}.html'
shutil.copy2(ROOT / 'Reef-Sweep.html', standalone)
manifest = {}
for path in [standalone, web, handoff]:
    manifest[path.name] = {'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
(OUT / f'reef-sweep-{VERSION}-downloads.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(manifest, indent=2))
