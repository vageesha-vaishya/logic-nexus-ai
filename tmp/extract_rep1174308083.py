import re
import csv
from pathlib import Path
import pdfplumber

pdf_path = Path('/Users/vims/Downloads/Development Projects/Trae/SOS Logistics Pro/logic-nexus-ai/tmp/Rep1174308083 copy.PDF')
out_path = pdf_path.with_suffix('.csv')

header = [
    'Aircraft',
    'Pilot',
    'Co-Pilot',
    'Log No./Log Page No./Flight No.',
    'Classification',
    'Departure From',
    'Arrival To',
    'Departure Time (UTC)',
    'Arrival Time (UTC)',
    'Block Time',
    'In Air',
    'Ground',
    'Cycle/Landing',
]

record_re = re.compile(
    r'^(?P<prefix>.+?)\s(?P<log>[A-Z0-9-]+(?:/\d+)*)\s(?P<dep>[A-Z0-9]{4,6})\s(?P<arr>[A-Z0-9]{4,6})\s'
    r'(?P<dd>\d{2}-[A-Za-z]{3}-\d{4})\s(?P<dt>\d{2}:\d{2})\s(?P<ad>\d{2}-[A-Za-z]{3}-\d{4})\s(?P<at>\d{2}:\d{2})\s'
    r'(?P<block>\d+:\d{2})\s(?P<air>\d+:\d{2})\s(?P<ground>\d+:\d{2})(?:\s(?P<cycle>\d+))?$'
)

skip_prefixes = (
    'Deccan Charters Private Limited',
    'Pilot Log Register Report Date',
    'From Date:',
    'Aircraft: (All)',
    'Flight Log Classification',
    'RUN,',
    'For C of A Renewal',
    'Engine Ground Run,',
    'Flight for VIBREX',
    'Pilot Co-Pilot',
    'No./Flight No.',
    'Classification',
)

rows = []
current_aircraft = ''
pending = None


def split_pilot(prefix: str):
    tokens = prefix.split()
    if not tokens:
        return '', ''
    if len(tokens) == 1:
        return tokens[0], ''
    if len(tokens) == 2:
        return tokens[0], tokens[1]
    mid = len(tokens) // 2
    return ' '.join(tokens[:mid]), ' '.join(tokens[mid:])


def flush_pending():
    global pending
    if pending is not None:
        pending['Classification'] = pending['Classification'].strip() or ''
        rows.append([pending.get(col, '') for col in header])
        pending = None


with pdfplumber.open(str(pdf_path)) as pdf:
    for page in pdf.pages:
        text = page.extract_text() or ''
        for raw_line in text.splitlines():
            line = ' '.join(raw_line.split()).strip()
            if not line:
                continue
            if line.startswith('Aircraft : '):
                flush_pending()
                current_aircraft = line.replace('Aircraft : ', '').strip()
                continue
            if any(line.startswith(p) for p in skip_prefixes):
                continue

            m = record_re.match(line)
            if m:
                flush_pending()
                pilot, copilot = split_pilot(m.group('prefix').strip())
                pending = {
                    'Aircraft': current_aircraft,
                    'Pilot': pilot,
                    'Co-Pilot': copilot,
                    'Log No./Log Page No./Flight No.': m.group('log').strip(),
                    'Classification': '',
                    'Departure From': m.group('dep').strip(),
                    'Arrival To': m.group('arr').strip(),
                    'Departure Time (UTC)': f"{m.group('dd')} {m.group('dt')}",
                    'Arrival Time (UTC)': f"{m.group('ad')} {m.group('at')}",
                    'Block Time': m.group('block').strip(),
                    'In Air': m.group('air').strip(),
                    'Ground': m.group('ground').strip(),
                    'Cycle/Landing': (m.group('cycle') or '').strip(),
                }
            else:
                if pending is not None:
                    if pending['Classification']:
                        pending['Classification'] += ' '
                    pending['Classification'] += line

flush_pending()

with out_path.open('w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(header)
    writer.writerows(rows)

print(out_path)
print(f'rows={len(rows)}')
