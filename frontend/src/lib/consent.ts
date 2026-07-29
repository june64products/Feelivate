import type { ConsentItem } from '../api';

/**
 * True when every required item in the catalogue has been ticked.
 *
 * Lives outside the component file so both the signup form and the consent gate
 * share one definition of "has this person actually agreed" — and so neither
 * file mixes component and non-component exports.
 */
export function allRequiredGranted(
    catalogue: ConsentItem[],
    decisions: Record<string, boolean>,
): boolean {
    return catalogue.filter((c) => c.required).every((c) => decisions[c.key] === true);
}
