# 07: Clerk's screens fit the application seamlessly

**What to build:** Clerk's sign-in and sign-up modal and its user button look like part of the application, not like Clerk. Every element Clerk's appearance options expose is styled with the application's own tokens. That includes the card, headers, inputs, buttons, social buttons, dividers, footer links, error text, verification-code steps and the user button menu. They follow light and dark exactly as the rest of the application does. On a phone the modal behaves like the application's own sheets. Clerk's styles sit in a cascade layer so the application's utilities win. The development-mode notice is switched off.

**Blocked by:** 05.

**Status:** ready-for-agent

- [ ] No Clerk default colour, font, radius or shadow is visible anywhere in the sign-up, sign-in, verification or password-reset flows, or in the user button menu.
- [ ] Switching theme restyles an open modal the same way it restyles the rest of the application.
- [ ] On a phone-sized viewport the modal presents like the application's sheets, and inputs don't trigger the browser zooming in.
- [ ] Error and focus states use the application's error and focus treatments.
- [ ] Checked by hand in light and dark, on desktop and phone, through every flow listed above.
