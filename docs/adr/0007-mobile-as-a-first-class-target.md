# Mobile is a first-class target, and the layout is built mobile-first

The brief requires no mobile support. We support it properly anyway: the shell is built
mobile-first, phones get a chat-first navigation model with a left sheet for conversations
and a snap-point bottom sheet for the plan, and a pass on real hardware is part of the
definition of done.

## Considered Options

- **Desktop only.** Cheapest, and defensible given the brief.
- **Responsive reflow only** — the same components rearranged so nothing overflows when
  the window narrows. This looks correct in a screenshot and is still broken in a hand:
  the virtual keyboard displaces a `vh`-sized composer, hover-revealed controls become
  unreachable, and iOS zooms on inputs under 16px. None of those are visible from a
  resized desktop browser.

## Consequences

Roughly double the frontend QA surface, and real-device verification becomes a step that
cannot be automated from this machine. Retrofitting mobile onto a desktop-first layout is
the expensive direction, so the ordering is a structural commitment rather than a
preference: `min-width` queries upward, `dvh` units, `env(safe-area-inset-bottom)` on the
composer, and no control whose only affordance is hover — which is why editable plan
fields carry a permanent dotted underline on every breakpoint, and why row actions are an
overflow menu rather than a swipe.
