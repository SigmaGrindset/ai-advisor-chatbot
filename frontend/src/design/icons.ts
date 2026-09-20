/**
 * How an icon is drawn, everywhere: two sizes and one stroke weight, chosen
 * once so the interface reads as a design rather than an accumulation.
 *
 * Icons come from Lucide. The sparkle, bot, zap and wand are not used: the
 * advisor is established by how it writes, not by a star beside its name.
 */

/** The interface's ordinary icon: controls, tabs, anything with a target. */
export const icon = { size: 18, strokeWidth: 1.5 } as const;

/** The smaller one, for glyphs set beside metadata rather than beside a label. */
export const smallIcon = { size: 14, strokeWidth: 1.5 } as const;
