import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { getMe } from '../../api';
import { getMyFeedbackStatus, type FeedbackTrigger } from './feedbackApi';

/*
 * When the form may open on its own.
 *
 * The rule that matters most: a person is asked automatically at most once,
 * and never at a bad moment. Every trigger below is only an *opportunity*;
 * the first one that finds the user eligible wins and the rest stand down.
 * The side tab is always there for anyone who wants to say more.
 */
const MIN_SESSION_MS = 3 * 60_000;          // nothing automatic in the first 3 minutes
const MILESTONE_MIN_MS = 60_000;            // a milestone can ask after 1 minute
const TIMER_MS = 8 * 60_000;                // the "pulse check" after 8 minutes
const SNOOZE_MS = 3 * 24 * 3_600_000;       // "not now" hides it for 3 days
const MAX_DISMISSALS = 2;                   // after two "not now"s it never asks again
const NEW_ACCOUNT_DAYS = 30;                // only recent sign-ups get the prompt
const HIDDEN_BEFORE_RETURN_MS = 10_000;     // mobile: away this long counts as leaving
const RETRY_AFTER_BUSY_MS = 1_500;          // let a ceremony/modal finish before asking

interface PromptState {
    dismissed: number;
    snoozeUntil: number;
    submitted: boolean;
}

const EMPTY_STATE: PromptState = { dismissed: 0, snoozeUntil: 0, submitted: false };

const storageKey = (userId: string | null) => `feelivate-feedback:${userId ?? 'anon'}`;

function loadState(userId: string | null): PromptState {
    try {
        const raw = localStorage.getItem(storageKey(userId));
        if (raw) return { ...EMPTY_STATE, ...JSON.parse(raw) };
    } catch {
        /* storage unavailable or corrupt: behave as first visit */
    }
    return { ...EMPTY_STATE };
}

function saveState(userId: string | null, state: PromptState) {
    try {
        localStorage.setItem(storageKey(userId), JSON.stringify(state));
    } catch {
        /* ignore */
    }
}

type Milestone = Extract<FeedbackTrigger, 'first_plan' | 'first_chats'>;

/**
 * Moment questions: a tiny form tied to one event, asked once per event
 * (not once per account like the general prompt). Each asks only what that
 * moment can answer — "does this plan feel right?" right after a plan is
 * built, "how was today's task?" right after the evening voice note, "why
 * isn't it landing?" after a second tweak, and the fuller form on the first
 * weekly report. They never stack: one open form at a time, and none while
 * the screen is busy.
 */
export type MomentTrigger = Extract<FeedbackTrigger, 'after_journal' | 'second_tweak' | 'weekly_report'> | 'first_plan';

/** Extra facts a moment hands to the form (shown back to the user, stored with the answer). */
export interface MomentDetails {
    sessionId?: string | null;
    taskLabel?: string;     // after_journal: today's task text
    tweakCount?: number;    // second_tweak
    weekNumber?: number;    // weekly_report / first_plan
}

interface FeedbackContextValue {
    isOpen: boolean;
    trigger: FeedbackTrigger;
    details: MomentDetails;
    isLoggedIn: boolean;
    /** Open the form deliberately (side tab). Always allowed. */
    open: (trigger?: FeedbackTrigger) => void;
    /** Close the form; `submitted` tells the engine whether to count a dismissal. */
    close: (submitted: boolean) => void;
    /** Report a moment the engine may use (first plan approved, first chats done). */
    signal: (milestone: Milestone) => void;
    /**
     * Ask a moment question. `key` makes it once-only: the same key never asks
     * twice (e.g. `after_journal:2026-10-06`, `second_tweak:<sessionId>`,
     * `weekly_report:<sessionId>:1`). Returns false when it was already asked
     * or the screen is busy (then it retries once the screen is free).
     */
    askMoment: (trigger: MomentTrigger, key: string, details?: MomentDetails) => boolean;
    /** While any key is busy (a modal, the mentor typing, the tutorial) nothing opens on its own. */
    setBusy: (key: string, busy: boolean) => void;
    /** Ask before logging out when the prompt is still due; otherwise log out straight away. */
    requestLogout: (proceed: () => void) => void;
    /** Whether the side tab should be visible right now. */
    tabVisible: boolean;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const isTypingSomewhere = (): boolean => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'TEXTAREA' || tag === 'INPUT' || el.isContentEditable;
};

export function FeedbackProvider({ children }: { children: ReactNode }) {
    const { pathname } = useLocation();
    const inWorkspace = pathname.startsWith('/app');

    const [isOpen, setIsOpen] = useState(false);
    const [trigger, setTrigger] = useState<FeedbackTrigger>('side_tab');
    const [details, setDetails] = useState<MomentDetails>({});
    const [busyKeys, setBusyKeys] = useState<Set<string>>(() => new Set());
    const [authTick, setAuthTick] = useState(0);
    // A moment that found the screen busy waits here for it to clear.
    const pendingMomentRef = useRef<{ trigger: MomentTrigger; key: string; details: MomentDetails } | null>(null);

    const userIdRef = useRef<string | null>(null);
    const accountAgeDaysRef = useRef<number | null>(null);
    const serverCountRef = useRef<number | null>(null);
    const stateRef = useRef<PromptState>(loadState(null));
    const busyRef = useRef<Set<string>>(new Set());
    const startedAtRef = useRef<number>(Date.now());
    const pendingRef = useRef<FeedbackTrigger | null>(null);
    const afterCloseRef = useRef<(() => void) | null>(null);
    const triggerRef = useRef<FeedbackTrigger>('side_tab');
    const openRef = useRef(false);

    const isLoggedIn = Boolean(typeof window !== 'undefined' && localStorage.getItem('access_token'));

    // Re-read the account whenever the route changes: login and logout both navigate.
    useEffect(() => {
        const userId = localStorage.getItem('access_token') ? localStorage.getItem('user_id') : null;
        if (userId !== userIdRef.current) {
            userIdRef.current = userId;
            stateRef.current = loadState(userId);
            accountAgeDaysRef.current = null;
            serverCountRef.current = null;
            startedAtRef.current = Date.now();
            setAuthTick((t) => t + 1);
        }
    }, [pathname]);

    // The prompt is only for people using the app; fetch what eligibility needs there.
    useEffect(() => {
        if (!inWorkspace || !userIdRef.current) return;
        // Already known for this account: the workspace re-renders often, the
        // answer does not change within a visit.
        if (accountAgeDaysRef.current !== null && serverCountRef.current !== null) return;
        let cancelled = false;
        (async () => {
            try {
                const [me, status] = await Promise.all([getMe(), getMyFeedbackStatus()]);
                if (cancelled) return;
                const created = me.created_at ? new Date(me.created_at).getTime() : NaN;
                accountAgeDaysRef.current = Number.isFinite(created)
                    ? Math.floor((Date.now() - created) / 86_400_000)
                    : null;
                serverCountRef.current = status ? status.count : null;
            } catch {
                /* stays unknown: the engine treats unknown as "not eligible" */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [inWorkspace, authTick]);

    /** Is the one-time prompt still due for this person, regardless of timing? */
    const promptDue = useCallback((): boolean => {
        if (!userIdRef.current) return false;
        const state = stateRef.current;
        if (state.submitted || state.dismissed >= MAX_DISMISSALS) return false;
        if (Date.now() < state.snoozeUntil) return false;
        if (serverCountRef.current === null || serverCountRef.current > 0) return false;
        const age = accountAgeDaysRef.current;
        return age !== null && age <= NEW_ACCOUNT_DAYS;
    }, []);

    const openNow = useCallback((t: FeedbackTrigger, d: MomentDetails = {}) => {
        triggerRef.current = t;
        openRef.current = true;
        pendingRef.current = null;
        setTrigger(t);
        setDetails(d);
        setIsOpen(true);
    }, []);

    // Once-only bookkeeping for moment questions, per account, in the browser.
    const momentKey = (userId: string | null) => `feelivate-feedback-moments:${userId ?? 'anon'}`;
    const momentAsked = (userId: string | null, key: string): boolean => {
        try {
            const raw = localStorage.getItem(momentKey(userId));
            return raw ? (JSON.parse(raw) as string[]).includes(key) : false;
        } catch {
            return false;
        }
    };
    const markMoment = (userId: string | null, key: string) => {
        try {
            const raw = localStorage.getItem(momentKey(userId));
            const list = raw ? (JSON.parse(raw) as string[]) : [];
            if (!list.includes(key)) localStorage.setItem(momentKey(userId), JSON.stringify([...list, key].slice(-200)));
        } catch {
            /* ignore */
        }
    };

    const askMoment = useCallback(
        (t: MomentTrigger, key: string, d: MomentDetails = {}): boolean => {
            const userId = userIdRef.current;
            if (!userId || !inWorkspace) return false;
            if (momentAsked(userId, key)) return false;
            if (openRef.current || busyRef.current.size > 0 || isTypingSomewhere()) {
                pendingMomentRef.current = { trigger: t, key, details: d };
                return false;
            }
            markMoment(userId, key);
            openNow(t, d);
            return true;
        },
        [inWorkspace, openNow],
    );

    // A queued moment fires once the screen is quiet again.
    useEffect(() => {
        if (busyKeys.size > 0 || isOpen || !pendingMomentRef.current) return;
        const p = pendingMomentRef.current;
        const id = window.setTimeout(() => {
            if (pendingMomentRef.current === p) {
                pendingMomentRef.current = null;
                askMoment(p.trigger, p.key, p.details);
            }
        }, RETRY_AFTER_BUSY_MS);
        return () => window.clearTimeout(id);
    }, [busyKeys, isOpen, askMoment]);

    /** Try an automatic trigger. Returns false (and may queue a retry) when the moment is wrong. */
    const tryOpen = useCallback(
        (t: FeedbackTrigger, minMs: number, retryWhenFree: boolean): boolean => {
            if (openRef.current || !inWorkspace || !promptDue()) return false;
            if (Date.now() - startedAtRef.current < minMs) return false;
            if (busyRef.current.size > 0 || isTypingSomewhere()) {
                if (retryWhenFree) pendingRef.current = t;
                return false;
            }
            openNow(t);
            return true;
        },
        [inWorkspace, promptDue, openNow],
    );

    // A queued trigger fires once the app is quiet again.
    useEffect(() => {
        if (busyKeys.size > 0 || !pendingRef.current) return;
        const t = pendingRef.current;
        const id = window.setTimeout(() => {
            if (pendingRef.current === t) tryOpen(t, 0, true);
        }, RETRY_AFTER_BUSY_MS);
        return () => window.clearTimeout(id);
    }, [busyKeys, tryOpen]);

    // Pulse check after a few minutes of use.
    useEffect(() => {
        if (!inWorkspace) return;
        const elapsed = Date.now() - startedAtRef.current;
        const id = window.setTimeout(() => tryOpen('timer', TIMER_MS, true), Math.max(0, TIMER_MS - elapsed));
        return () => window.clearTimeout(id);
    }, [inWorkspace, authTick, tryOpen]);

    // Desktop exit intent: the pointer leaves through the top edge, heading for the tab bar.
    useEffect(() => {
        if (!inWorkspace) return;
        if (!window.matchMedia('(pointer: fine)').matches) return;
        const onLeave = (e: MouseEvent) => {
            if (e.relatedTarget === null && e.clientY <= 0) tryOpen('exit_intent', MIN_SESSION_MS, false);
        };
        document.addEventListener('mouseout', onLeave);
        return () => document.removeEventListener('mouseout', onLeave);
    }, [inWorkspace, tryOpen]);

    // Mobile: no pointer to read, so "left and came back" stands in for exit intent.
    useEffect(() => {
        if (!inWorkspace) return;
        if (window.matchMedia('(pointer: fine)').matches) return;
        let hiddenAt = 0;
        const onVisibility = () => {
            if (document.visibilityState === 'hidden') {
                hiddenAt = Date.now();
            } else if (hiddenAt && Date.now() - hiddenAt >= HIDDEN_BEFORE_RETURN_MS) {
                hiddenAt = 0;
                tryOpen('tab_return', MIN_SESSION_MS, true);
            }
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, [inWorkspace, tryOpen]);

    const signal = useCallback(
        (milestone: Milestone) => {
            // The first plan now gets its own one-question form (plan_fit)
            // instead of the general prompt; see askMoment.
            if (milestone === 'first_plan') return;
            tryOpen(milestone, MILESTONE_MIN_MS, true);
        },
        [tryOpen],
    );

    const setBusy = useCallback((key: string, busy: boolean) => {
        const next = new Set(busyRef.current);
        if (busy) next.add(key);
        else next.delete(key);
        if (next.size === busyRef.current.size && [...next].every((k) => busyRef.current.has(k))) return;
        busyRef.current = next;
        setBusyKeys(next);
    }, []);

    const open = useCallback(
        (t: FeedbackTrigger = 'side_tab') => {
            openNow(t);
        },
        [openNow],
    );

    const close = useCallback((submitted: boolean) => {
        const userId = userIdRef.current;
        const t = triggerRef.current;
        const wasMoment = t === 'first_plan' || t === 'after_journal' || t === 'second_tweak' || t === 'weekly_report';
        const wasAutomatic = t !== 'side_tab' && !wasMoment;
        const state = { ...stateRef.current };
        if (submitted) {
            // Only the fuller forms count as "they've given feedback"; a one-tap
            // moment answer shouldn't silence the general prompt for good.
            if (!wasMoment || t === 'weekly_report') state.submitted = true;
            serverCountRef.current = (serverCountRef.current ?? 0) + 1;
        } else if (wasAutomatic) {
            state.dismissed += 1;
            state.snoozeUntil = Date.now() + SNOOZE_MS;
        }
        stateRef.current = state;
        saveState(userId, state);

        openRef.current = false;
        setIsOpen(false);

        const after = afterCloseRef.current;
        afterCloseRef.current = null;
        if (after) {
            // Logging out clears storage; keep this person's prompt history so a
            // second "not now" is remembered when they sign back in.
            after();
            saveState(userId, state);
        }
    }, []);

    const requestLogout = useCallback(
        (proceed: () => void) => {
            if (openRef.current || !promptDue()) {
                proceed();
                return;
            }
            afterCloseRef.current = proceed;
            openNow('logout');
        },
        [promptDue, openNow],
    );

    const value = useMemo<FeedbackContextValue>(
        () => ({
            isOpen,
            trigger,
            details,
            isLoggedIn,
            open,
            close,
            signal,
            askMoment,
            setBusy,
            requestLogout,
            tabVisible: !isOpen && busyKeys.size === 0,
        }),
        [isOpen, trigger, details, isLoggedIn, open, close, signal, askMoment, setBusy, requestLogout, busyKeys],
    );

    return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>;
}

export function useFeedback(): FeedbackContextValue {
    const ctx = useContext(FeedbackContext);
    if (!ctx) throw new Error('useFeedback must be used inside <FeedbackProvider>');
    return ctx;
}
