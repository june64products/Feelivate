import { useLocation } from 'react-router-dom';
import FeedbackModal from './FeedbackModal';
import FeedbackTab from './FeedbackTab';
import { FEEDBACK_INBOX_PATH } from './inboxPath';
import { BLOG_ADMIN_PATH } from '../blog/adminPath';

// Pages where a feedback tab would only be in the way: forms, redirects, admin.
const HIDDEN_PREFIXES = ['/login', '/auth-callback', '/google-callback', FEEDBACK_INBOX_PATH, BLOG_ADMIN_PATH];

/** Mounts the side tab and the form once, above every route. */
export default function FeedbackLayer() {
    const { pathname } = useLocation();
    if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;
    return (
        <>
            <FeedbackTab />
            <FeedbackModal />
        </>
    );
}
