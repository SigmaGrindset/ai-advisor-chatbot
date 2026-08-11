"""Appends every prompt submitted in Claude Code to PROMPTS.jsonl.

Part of the assignment harness — leave enabled. The log is a required
part of your submission.
"""
import datetime
import json
import os
import sys

entry = {
    "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
    "role": "user",
    "prompt": json.load(sys.stdin).get("prompt", ""),
}

root = os.environ.get("CLAUDE_PROJECT_DIR", ".")
with open(os.path.join(root, "PROMPTS.jsonl"), "a", encoding="utf-8") as f:
    f.write(json.dumps(entry, ensure_ascii=False) + "\n")
