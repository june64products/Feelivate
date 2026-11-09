/**
 * The handful of moments that tell us whether a visitor became a user.
 * Names are what the Vercel Analytics dashboard shows; keep them stable.
 *
 *   signup         — account created (method: email | google)
 *   login          — returning sign-in (method)
 *   plan_built     — the mentor produced a week plan
 *   plan_committed — the user locked a week (the real "activation")
 *
 * Never send emails, names or message text — counts only.
 */
import { track as vercelTrack } from '@vercel/analytics';

type Props = Record<string, string | number | boolean>;

export function track(event: 'signup' | 'login' | 'plan_built' | 'plan_committed', props: Props = {}) {
    try {
        vercelTrack(event, props);
    } catch {
        /* analytics must never break the app */
    }
}
