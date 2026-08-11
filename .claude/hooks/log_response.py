"""Appends a truncated snippet of each Claude Code response to PROMPTS.jsonl.

Part of the assignment harness — leave enabled. The log is a required
part of your submission.
"""
import datetime
import json
import os
import sys

CAP = 800

data = json.load(sys.stdin)
text = ""
try:
    with open(data.get("transcript_path", ""), encoding="utf-8") as f:
        for line in f:
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if obj.get("type") != "assistant":
                continue
            parts = [b.get("text", "")
                     for b in obj.get("message", {}).get("content", [])
                     if isinstance(b, dict) and b.get("type") == "text"]
            joined = "\n".join(p for p in parts if p).strip()
            if joined:
                text = joined  # keep the last assistant message
except OSError:
    pass

if text:
    if len(text) > CAP:
        marker = " …[truncated]"
        text = text[:CAP - len(marker)] + marker  # keep the stored field within CAP total
    entry = {
        "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "role": "assistant",
        "text": text,
    }
    root = os.environ.get("CLAUDE_PROJECT_DIR", ".")
    with open(os.path.join(root, "PROMPTS.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
