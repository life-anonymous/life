"""Reconstruct and verify the unchanged static website for GitHub Pages."""
from pathlib import Path
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / 'dist'
manifest = json.loads((ROOT / 'site-manifest.json').read_text(encoding='utf-8'))
OUTPUT.mkdir(exist_ok=True)
for record in manifest:
    target = OUTPUT / record['path']
    target.parent.mkdir(parents=True, exist_ok=True)
    if 'parts' in record:
        with target.open('wb') as destination:
            for part in record['parts']:
                with (ROOT / part).open('rb') as source:
                    shutil.copyfileobj(source, destination)
    else:
        shutil.copyfile(ROOT / 'site' / record['path'], target)
    digest = hashlib.sha256()
    with target.open('rb') as source:
        while data := source.read(1024 * 1024):
            digest.update(data)
    if target.stat().st_size != record['size'] or digest.hexdigest() != record['sha256']:
        raise SystemExit(f'Integrity check failed: {record["path"]}')
print(f'PASS: all {len(manifest)} published files match their original SHA-256 checksums.')
