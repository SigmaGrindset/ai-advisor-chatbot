# 06: Responsive and mobile

**What to build:** The application works properly in a hand, not just in a narrowed desktop
window. A traveler on a phone can hold a full conversation with the keyboard open, reach
every control with a thumb, and add the application to their home screen.

This ticket establishes the responsive primitives. Every UI ticket after it ships its own
mobile behaviour on top of them — 06 does not close mobile on its own.

**Blocked by:** 05.

**Status:** ready-for-agent

- [ ] At 1100px and above, three panes; between 768px and 1100px, chat and the right pane
      with the Conversation list as a sheet; below 768px, chat-first
- [ ] A reusable sheet primitive with snap points exists and is applied to the Conversation
      list as a left sheet; later tickets reuse it rather than writing a second one
- [ ] The composer stays visible and usable when the virtual keyboard opens, with viewport
      units that account for mobile browser chrome
- [ ] The composer clears the device safe area
- [ ] Focusing an input does not trigger zoom
- [ ] No control's only affordance is hover; row actions use a visible overflow control
      rather than a swipe gesture
- [ ] Nested scroll areas do not chain or rubber-band into one another
- [ ] A web application manifest, theme colour and touch icon are present so the
      application installs to a home screen with a proper icon; no service worker is
      registered
- [ ] Verified at 375×812 with touch emulation and on a real phone
