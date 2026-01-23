#!/usr/bin/env python3
"""Run raw alert parser (moved to src/downloader).

Usage:
  python3 src/downloader/run_raw_parser.py [--tmpdir PATH] [--verbose]

If --tmpdir is not provided, the script uses `data/alertas/tmp` and selects
the most recent subdirectory. --verbose prints a short sample analysis before
writing the full raw CSV.
"""
from pathlib import Path
import sys
import argparse
sys.path.insert(0, str(Path(__file__).resolve().parents[0]))
import importlib


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--tmpdir', help='Path to tmp directory containing extracted XMLs', default='data/alertas/tmp')
    parser.add_argument('--verbose', action='store_true', help='Show sample counts before producing CSV')
    args = parser.parse_args()

    fetch_json = importlib.reload(__import__('alert_downloader'))

    data_tmp = Path(args.tmpdir)
    if not data_tmp.exists():
        print('No tmp directory found at', data_tmp)
        return 2

    subs = sorted([p for p in data_tmp.iterdir() if p.is_dir()], reverse=True)
    if not subs:
        print('No subdirectories in', data_tmp)
        return 1
    latest = subs[0]
    print('Using tmp:', latest)

    if args.verbose:
        from alert_downloader import extract_entries_from_xml, detect_level
        files = list(latest.rglob('*.xml'))
        print('XML files count:', len(files))
        rows = 0
        for f in files[:50]:
            try:
                text = f.read_text(errors='ignore')
            except Exception:
                continue
            entries = extract_entries_from_xml(text)
            for e in entries:
                nivel = detect_level(e)
                if nivel == 'verde':
                    continue
                rows += 1
        print('Found rows (sample first 50 files):', rows)

    fetch_json.parse_tmp_and_write_raw_csv(latest)
    print('done')


if __name__ == '__main__':
    sys.exit(main())
