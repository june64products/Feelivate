import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
import { useFeedback } from './FeedbackContext';

/*
 * The always-available way in. A slim vertical tab on the right edge on
 * desktop, a small pill in the bottom-right corner on phones. It carries a
 * slow light sweep so it reads as alive without shouting; both animations
 * switch off under prefers-reduced-motion.
 */
const KEYFRAMES = `
@keyframes fbTabSweep {
  0%   { transform: translateY(-120%); opacity: 0; }
  15%  { opacity: 0.9; }
  50%  { transform: translateY(120%); opacity: 0; }
  100% { transform: translateY(120%); opacity: 0; }
}
@keyframes fbPillSweep {
  0%   { transform: translateX(-140%) skewX(-18deg); opacity: 0; }
  15%  { opacity: 0.9; }
  50%  { transform: translateX(160%) skewX(-18deg); opacity: 0; }
  100% { transform: translateX(160%) skewX(-18deg); opacity: 0; }
}
@keyframes fbTabGlow {
  0%, 100% { box-shadow: 0 0 0 1px var(--border-medium), 0 6px 22px var(--accent-glow), 0 0 0 0 var(--accent-glow); }
  50%      { box-shadow: 0 0 0 1px var(--border-medium), 0 8px 28px var(--accent-glow), 0 0 0 6px var(--accent-glow); }
}
.fb-tab { animation: fbTabGlow 3.6s ease-in-out infinite; }
.fb-tab .fb-sweep { animation: fbTabSweep 4.2s ease-in-out infinite; }
.fb-pill .fb-sweep { animation: fbPillSweep 4.2s ease-in-out infinite; }
.fb-tab:hover, .fb-pill:hover { border-color: var(--accent-warm) !important; }
@media (prefers-reduced-motion: reduce) {
  .fb-tab, .fb-tab .fb-sweep, .fb-pill .fb-sweep { animation: none !important; }
}
`;

const useIsNarrow = () => {
    const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
    useEffect(() => {
        const onResize = () => setNarrow(window.innerWidth < 640);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    return narrow;
};

export default function FeedbackTab() {
    const { tabVisible, open } = useFeedback();
    const narrow = useIsNarrow();

    const sweep = (
        <span
            aria-hidden
            className="fb-sweep"
            style={{
                position: 'absolute',
                inset: narrow ? '0 auto 0 0' : '0 0 auto 0',
                width: narrow ? '40%' : '100%',
                height: narrow ? '100%' : '45%',
                background: narrow
                    ? 'linear-gradient(90deg, transparent, var(--accent-glow), transparent)'
                    : 'linear-gradient(180deg, transparent, var(--accent-glow), transparent)',
                pointerEvents: 'none',
            }}
        />
    );

    return (
        <>
            <style>{KEYFRAMES}</style>
            <AnimatePresence>
                {tabVisible && (
                    narrow ? (
                        <motion.button
                            key="feedback-pill"
                            type="button"
                            className="fb-pill"
                            aria-label="Give feedback"
                            onClick={() => open('side_tab')}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 12 }}
                            whileTap={{ scale: 0.95 }}
                            style={{
                                position: 'fixed',
                                right: '14px',
                                bottom: 'calc(14px + env(safe-area-inset-bottom))',
                                zIndex: 290,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '7px',
                                padding: '10px 14px',
                                borderRadius: '999px',
                                border: '1px solid var(--border-medium)',
                                background: 'var(--bg-surface)',
                                color: 'var(--text-primary)',
                                boxShadow: 'var(--shadow-md)',
                                fontSize: '13px',
                                fontWeight: 600,
                                fontFamily: 'var(--font-sans)',
                                cursor: 'pointer',
                                overflow: 'hidden',
                            }}
                        >
                            {sweep}
                            <MessageSquare size={15} />
                            Feedback
                        </motion.button>
                    ) : (
                        <motion.button
                            key="feedback-tab"
                            type="button"
                            className="fb-tab"
                            aria-label="Give feedback"
                            onClick={() => open('side_tab')}
                            // framer-motion owns `transform`, so the vertical centring
                            // rides along as `y` instead of a style rule it would overwrite.
                            initial={{ opacity: 0, x: 16, y: '-50%' }}
                            animate={{ opacity: 1, x: 0, y: '-50%' }}
                            exit={{ opacity: 0, x: 16, y: '-50%' }}
                            whileHover={{ x: -3, y: '-50%' }}
                            whileTap={{ scale: 0.97, y: '-50%' }}
                            style={{
                                position: 'fixed',
                                right: 0,
                                top: '50%',
                                zIndex: 290,
                                writingMode: 'vertical-rl',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '14px 9px',
                                borderRadius: '12px 0 0 12px',
                                border: '1px solid var(--border-medium)',
                                borderRight: 'none',
                                background: 'var(--bg-surface)',
                                color: 'var(--text-primary)',
                                fontSize: '12px',
                                fontWeight: 600,
                                letterSpacing: '0.14em',
                                textTransform: 'uppercase',
                                fontFamily: 'var(--font-sans)',
                                cursor: 'pointer',
                                overflow: 'hidden',
                            }}
                        >
                            {sweep}
                            <MessageSquare size={14} style={{ transform: 'rotate(90deg)' }} />
                            Feedback
                        </motion.button>
                    )
                )}
            </AnimatePresence>
        </>
    );
}
