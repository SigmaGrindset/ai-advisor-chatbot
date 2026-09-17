# 15: README, audit and verification

**What to build:** Someone who has never seen this project can run it, understand how it
fits together, and see which decisions were deliberate — and the interface holds up to being
looked at closely.

**Blocked by:** 06, 10, 13, 14.

**Status:** ready-for-agent

- [ ] The README carries all seven sections: setup and run, architecture overview, key
      decisions, ambiguities, AI usage, known limitations, and what was built beyond the
      specification
- [ ] The setup command has been followed literally on a clean machine and works, including
      how the evaluator supplies their own OpenRouter key
- [ ] Ambiguities records at least: Conversation-versus-Trip ownership of the plan, what
      "changes take effect immediately" was taken to mean, and how far deleting a
      Conversation reaches
- [ ] Known limitations records at least: no dark mode, plaintext storage of personal data,
      no redaction on the way to the model, no frontend or end-to-end tests, and no touch
      gestures
- [ ] AI usage describes the techniques actually used while building, not a generic account
- [ ] The `redesign-existing-projects` audit pass has been applied, with its findings either
      fixed or recorded
- [ ] Contrast is verified on the clay accent and the four semantic tints
- [ ] A keyboard-only pass and a screen-reader pass have both been done
- [ ] A real-device pass on a phone has been done
- [ ] The full test suite is green
