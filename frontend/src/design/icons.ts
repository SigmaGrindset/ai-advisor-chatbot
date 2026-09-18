/**
 * How an icon is drawn, everywhere.
 *
 * Two sizes and one stroke weight. An interface that draws icons at five
 * weights and seven sizes reads as an accumulation rather than a design, so
 * the choice is made once here and spread onto every glyph.
 *
 * Icons come from Lucide. The sparkle, bot, zap and wand are not used: the
 * advisor is established by how it writes, not by a star beside its name.
 */

/** The interface's ordinary icon: controls, tabs, anything with a target. */
export const icon = { size: 18, strokeWidth: 1.5 } as const;

/** The smaller one, for glyphs set beside metadata rather than beside a label. */
export const smallIcon = { size: 14, strokeWidth: 1.5 } as const;
