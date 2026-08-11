# Project notes for Claude

This assignment records the development process. Two hooks in `.claude/settings.json`
append to `PROMPTS.jsonl` at the repo root: every user prompt (`UserPromptSubmit` →
`.claude/hooks/log_prompt.py`) and a truncated copy of each of your responses
(`Stop` → `.claude/hooks/log_response.py`).

Rules for this project:

- The log is a required part of the submission. **Logging must stay enabled at all
  times.**
- If logging is not working (`PROMPTS.jsonl` is not growing), diagnose and repair the
  hook setup for this machine — e.g. `python` vs `python3` on PATH, path or shell
  syntax differences on this OS. Repair the *mechanism* only.
- Never disable or bypass the hooks, and never modify, rewrite, or delete existing
  content of `PROMPTS.jsonl`.
- **Committing is the candidate's decision — do not run `git add`, `git commit`, or any
  other git write on your own.** Only commit when the candidate explicitly asks. When they
  do (or ask you to), include `PROMPTS.jsonl` in the same commit as the code so the history
  and the log stay in sync; if they commit code without the log, remind them to add it.
