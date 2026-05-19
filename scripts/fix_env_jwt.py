#!/usr/bin/env python3
"""Repair /etc/logic-nexus/markets-worker.env where the JWT got
newline-split during a terminal paste. Joins any line that doesn't
look like a fresh KEY= assignment back onto the previous line, then
writes the file back."""
import re
import sys

env_path = sys.argv[1] if len(sys.argv) > 1 else "/etc/logic-nexus/markets-worker.env"
content = open(env_path).read()
# Remove any newline NOT followed by an UPPERCASE_KEY= pattern (so
# continuation chunks of a value get glued back to the previous line).
fixed = re.sub(r"\n(?![A-Z][A-Z0-9_]*=)", "", content).rstrip() + "\n"
open(env_path, "w").write(fixed)
# Show the repaired file with secrets masked.
for line in fixed.splitlines():
    if "=" in line:
        k, v = line.split("=", 1)
        masked = v if len(v) < 12 or k.endswith("_URL") else f"{v[:8]}…({len(v)} chars)"
        print(f"{k}={masked}")
    else:
        print(line)
