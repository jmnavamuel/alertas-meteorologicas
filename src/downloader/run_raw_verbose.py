#!/usr/bin/env python3
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[0]))
import importlib
fetch_json = importlib.reload(__import__('alert_downloader'))
from alert_downloader import extract_entries_from_xml, detect_level, detect_province, detect_phenomenon

p = Path('data/alertas/tmp')
subs = sorted([d for d in p.iterdir() if d.is_dir()], reverse=True)
print('subs:', subs[:5])
if not subs:
    print('no tmp')
    sys.exit(1)
latest = subs[0]
print('latest:', latest)
files = list(latest.rglob('*.xml'))
print('xml files count:', len(files))
rows = 0
for f in files[:50]:
    text = f.read_text(errors='ignore')
    entries = extract_entries_from_xml(text)
    for e in entries:
        nivel = detect_level(e)
        if nivel=='verde':
            continue
        rows += 1
print('found rows (sample first 50 files):', rows)
# run the real function
fetch_json.parse_tmp_and_write_raw_csv(latest)
print('done')
