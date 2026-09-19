# Mobile is a first-class target, and the layout is built mobile-first

The brief requires no mobile support. We support it properly anyway: the shell is built
mobile-first, phones get a chat-first navigation model with a left sheet for conversations
and a snap-point bottom sheet for the plan, and a pass on real hardware is part of the
definition of done.

Responsive reflow alone — the same components rearranged so nothing overflows — looks
correct in a screenshot and is still broken in a hand: the virtual keyboard displaces a
`vh`-sized composer, hover-revealed controls become unreachable, and iOS zooms on inputs
under 16px. None of that is visible from a resized desktop browser, and retrofitting is
the expensive direction, so the ordering is a structural commitment: `min-width` queries
upward, `dvh` units, `env(safe-area-inset-bottom)` on the composer, and no control whose
only affordance is hover — hence the permanent dotted underline on editable plan fields,
and row actions as an overflow menu rather than a swipe.
