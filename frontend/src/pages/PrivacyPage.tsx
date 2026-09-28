import PageShell from '../components/site/PageShell';
import { PageHero } from '../components/site/ui';
import { useWindowSize } from '../hooks/useWindowSize';
import LegalDoc, { type LegalSection } from '../components/legal/LegalDoc';

/**
 * The published Privacy Policy.
 *
 * Text finalised with counsel's draft of 30 July 2026, corrected against the
 * application as built (see the alignment brief of 19 September 2026) and
 * updated for the changes since (AI routing, memory store location, the
 * feedback form, long-term memory of every chat exchange, the password
 * floor). Processors are named by category, with the named list available
 * on request — a business decision of 28 September 2026.
 *
 * POLICY_VERSION must match CONSENT_POLICY_VERSION in the backend. Bumping it
 * asks every user to accept the new policy on their next sign-in, so change
 * it only when the substance changes.
 *
 * Still to fill when known (wording below is honest in the meantime):
 *   - ICO registration number (section "UK data protection registration")
 *   - EU representative (section "Contact")
 *   - Northflank region: detected as Singapore (Google Cloud) — confirm
 *   - Log retention periods on Northflank and Vercel
 */
const POLICY_VERSION = '2026-09-28';
const LAST_UPDATED = '28 September 2026';

const SECTIONS: LegalSection[] = [
  { id: 'introduction', h: 'Introduction', blocks: [
    { t: 'p', text: 'This Privacy Policy explains how JUNE64 Ltd ("we", "our", "us") collects, uses and protects personal data when you use Feelivate at feelivate.com (the "Service"). "You" means the person using the Service.' },
    { t: 'p', text: 'Feelivate is an AI accountability mentor: you tell it what you want to achieve, it builds you a locked 7-day plan, and it keeps you to it with daily emails, check-ins, streaks and weekly reports.' },
    { t: 'p', text: 'Some of what you write here — your journal entries, your voice notes, the emotion labels we derive from them — says something about your mental wellbeing. Under EU and UK law that is special category data, and it gets the highest level of protection. This policy explains exactly what we collect, why we are legally allowed to, who else sees it, and what you can make us do about it.' },
    { t: 'p', text: 'If you do not agree with this policy, please do not use the Service. If you have any questions or concerns, contact us at [info@june64.com](mailto:info@june64.com).' },
  ] },

  { id: 'who-we-are', h: 'Who we are (data controller)', blocks: [
    { t: 'table', head: ['', ''], rows: [
      ['Controller', 'JUNE64 Limited'],
      ['Registered address', '124–128 City Road, London, England'],
      ['Company number', '16436481'],
      ['Product', 'Feelivate (feelivate.com)'],
      ['Privacy contact', '[info@june64.com](mailto:info@june64.com)'],
    ] },
    { t: 'h3', text: 'Data Protection Officer' },
    { t: 'p', text: 'We have not appointed a Data Protection Officer, as we are not currently required to do so under Article 37 of the GDPR. We will appoint a DPO and update this policy if that changes.' },
  ] },

  { id: 'what-we-collect', h: 'What we collect', blocks: [
    { t: 'h3', text: 'Information you give us' },
    { t: 'table', head: ['Data', 'Where it comes from', 'Legal basis'], rows: [
      ['Email address and password (stored only as an Argon2 hash); your name, if you choose to add one', 'Sign-up form, or Google sign-in (which gives us your email address and basic profile)', 'Art 6(1)(b) – contract performance'],
      ['Your goals, focus and vision', 'Chat with the mentor', 'Art 6(1)(b) – contract performance'],
      ['Chat messages with the AI mentor', 'Chat', 'Art 6(1)(b) – contract performance'],
      ['Weekly plans, tasks and completion status', 'Generated from your chat, updated by you', 'Art 6(1)(b) – contract performance'],
      ['Daily check-ins (done / skipped) and any note you add; the reason you choose when a day is missed', 'Check-in; the recovery card after a missed day', 'Art 6(1)(a) – consent'],
      ['The reason you give for your goal (your "why"), which the mentor may quote back to you at weak moments', 'Chat with the mentor', 'Art 6(1)(a) + Art 9(2)(a) – explicit consent'],
      ['Voice notes and the text transcripts made from them; mood check-ins recorded between weeks', 'Voice journal', 'Art 6(1)(a) + Art 9(2)(a) – explicit consent'],
      ['Notification email address, preferred send time and timezone', 'Notification settings', 'Art 6(1)(a) – consent'],
      ['Feedback: a 1–5 rating, what worked and what was confusing, a comment, and whether we may email you about it. Visitors without an account may leave an email address if they want a reply', 'Feedback form (the side tab, or the one-time prompt for new accounts)', 'Art 6(1)(f) – legitimate interests (improving the service); an email address you choose to leave – Art 6(1)(a) consent'],
      ['Anything you write to us', 'Contact form, support email', 'Art 6(1)(b) / Art 6(1)(f) – responding to you'],
    ] },
    { t: 'h3', text: 'Information the Service derives from what you give it' },
    { t: 'ul', items: [
      'An emotion label and a 1–10 score, with a one-line summary, for each journal entry and mood check-in — produced by our AI from the transcript text only.',
      'Weekly reports: a per-day breakdown, a mood timeline and coaching text, generated by our AI.',
      'Your streak and "shield" counts.',
      'Long-term memory: each exchange with the mentor (your message and its reply) is stored together with an AI-generated numerical representation ("embedding") so the mentor can recall what you told it in earlier weeks.',
      'Step-by-step guides for a day\'s task, generated when you tap "How do I do this?" and kept so they open instantly next time.',
    ] },
    { t: 'p', text: 'Derived data shares the legal basis of the data it is derived from.' },
    { t: 'h3', text: 'Special category data (GDPR Art 9 / UK GDPR Art 9)' },
    { t: 'p', text: 'Your journal entries, voice transcripts, mood check-ins, and the emotion label and score (for example "stressed", 4/10) that our AI derives from them can reveal information about your mental and emotional health. We treat all of this as data concerning health – a special category of personal data under Article 9 of the GDPR and UK GDPR. We treat the reason you give for your goal and the reason a day was missed with the same care.' },
    { t: 'p', text: 'We only process this data with your explicit consent:' },
    { t: 'ul', items: [
      'collected as its own separate, unticked checkbox at sign-up;',
      'never bundled with any other consent or terms;',
      'withdrawable at any time (see "Your rights").',
    ] },
    { t: 'p', text: '**What we do with your voice.** Your recording is converted to text and the audio is immediately discarded. Only the text transcript is analysed for emotion. We do not extract or process tone, pitch, prosody, voiceprints or any other acoustic characteristic, and we never use your voice to identify you.' },
    { t: 'h3', text: 'Information we collect automatically' },
    { t: 'table', head: ['Data', 'Purpose', 'Legal basis'], rows: [
      ['IP address', 'Security and abuse prevention, and as evidence of when you gave consent', 'Art 6(1)(f) – legitimate interests (security)'],
      ['Browser and device information (a shortened "user agent" string)', 'Evidence of consent; context for feedback you send; troubleshooting', 'Art 6(1)(f) – legitimate interests (security and service improvement)'],
      ['Your timezone (read from your browser)', 'Sending your daily email at the right local time', 'Art 6(1)(b) – contract performance'],
      ['Service logs (timestamps, endpoints, error traces)', 'Keeping the service running', 'Art 6(1)(f) – legitimate interests (service reliability)'],
    ] },
    { t: 'p', text: '**About our logs.** We redact known identifiers (such as email addresses) from our logs, and we do not write your chat messages or journal text into them. Logs are held on our hosting platforms for a limited period set by those platforms and then deleted.' },
    { t: 'h3', text: 'What we do not collect' },
    { t: 'ul', items: [
      '**Voice recordings.** We do not store your voice recordings. The audio is transcribed and discarded in the same request; only the transcript is saved.',
      '**Analytics or tracking.** We have no analytics, advertising, tracking or profiling third parties on our site. No Google Analytics, no pixels, no session recorders, no fingerprinting.',
      '**Payment details.** Feelivate is free; we hold no card or payment information.',
      '**Purchased data.** We do not buy personal data from anyone, anywhere.',
      '**Children\'s data.** We do not knowingly collect data from anyone under 18 (see "Children").',
    ] },
    { t: 'h3', text: 'Lawful basis summary (GDPR Art 6 / UK GDPR Art 6)' },
    { t: 'table', head: ['Purpose', 'Legal basis'], rows: [
      ['Creating and running your account, authenticating you', 'Art 6(1)(b) – contract performance'],
      ['Generating weekly plans, tasks, streaks and weekly reports', 'Art 6(1)(b) – contract performance'],
      ['Remembering your conversations across weeks (long-term memory)', 'Art 6(1)(b) – contract performance'],
      ['Sending your daily task email at your chosen time, and the related reminder and recovery emails', 'Art 6(1)(a) – consent (withdrawable any time)'],
      ['Syncing your plan to Google Calendar (optional)', 'Art 6(1)(a) – consent'],
      ['Processing journals, voice transcripts, mood check-ins and emotion logs', 'Art 6(1)(a) + Art 9(2)(a) – explicit consent'],
      ['Screening messages for safety (crisis language) and misuse', 'Art 6(1)(f) – legitimate interests (safety)'],
      ['Keeping the service secure, preventing abuse', 'Art 6(1)(f) – legitimate interests'],
      ['Fixing bugs, improving the product, and reading your feedback', 'Art 6(1)(f) – legitimate interests'],
      ['Responding to your emails and support requests', 'Art 6(1)(b) / Art 6(1)(f)'],
      ['Keeping records of consent', 'Art 6(1)(c) – legal obligation'],
    ] },
    { t: 'h3', text: 'Legitimate interests assessment (Art 6(1)(f))' },
    { t: 'p', text: 'Where we rely on legitimate interests, we have conducted a balancing test and concluded that our interests do not override your rights and freedoms:' },
    { t: 'table', head: ['Interest', 'Why we need it', 'Why it does not override your rights'], rows: [
      ['Security and abuse prevention', 'To protect your account and our systems', 'Logs are redacted, data is minimised, and we use the least intrusive means'],
      ['Safety screening', 'To pause coaching and show help when a message suggests you may be at risk, and to refuse misuse', 'Only the message being sent is checked; no risk flag or profile is stored'],
      ['Service improvement', 'To fix bugs, keep the service running and act on feedback', 'We do not use your personal content for this beyond the feedback you chose to send'],
      ['Responding to support requests', 'To answer your questions', 'We only use your data for the specific request you made'],
    ] },
    { t: 'p', text: 'You have the right to object to processing based on legitimate interests (see "Your rights").' },
  ] },

  { id: 'why-we-process', h: 'Why we process it, and our legal basis', blocks: [
    { t: 'p', text: 'We have set out the specific legal basis for each processing activity in "What we collect" above. In short:' },
    { t: 'ul', items: [
      '**Contract (Art 6(1)(b)).** We process your data to provide the service you signed up for – creating your account, generating plans, remembering your conversations, and sending your notifications.',
      '**Consent (Art 6(1)(a) / Art 9(2)(a)).** We process your journal entries, voice transcripts, mood check-ins and emotion scores only with your explicit consent, collected separately at sign-up. You can withdraw this at any time – see "Your rights".',
      '**Legitimate interests (Art 6(1)(f)).** We process certain data for security, abuse prevention, safety screening and service improvement. We have balanced these interests against your rights – see the assessment above.',
      '**Legal obligation (Art 6(1)(c)).** We retain records of consent as required by law.',
    ] },
    { t: 'h3', text: 'Your rights in relation to our legal bases' },
    { t: 'p', text: 'If we rely on your consent: you can withdraw it at any time; withdrawal is as easy as it was to give; and withdrawal does not make our earlier processing unlawful, but it stops us from processing your data for that purpose going forward.' },
    { t: 'p', text: 'If we rely on legitimate interests: we have weighed our interests against your rights and concluded they do not override them, and you have the right to object to this processing at any time.' },
    { t: 'h3', text: 'What we never do' },
    { t: 'p', text: 'We never sell your personal data, and we never use it for advertising.' },
  ] },

  { id: 'ai-processing', h: 'AI processing', blocks: [
    { t: 'p', text: 'Feelivate is an AI product. Here is what that means for you.' },
    { t: 'h3', text: 'You are talking to an AI, not a person' },
    { t: 'p', text: 'The mentor is a large language model. It will tell you so if you ask.' },
    { t: 'h3', text: 'Your data is sent to AI providers outside the EU and UK' },
    { t: 'p', text: 'When you chat, record a voice note, or we generate your plan, report or daily email, your content is sent to our AI providers for processing:' },
    { t: 'ul', items: [
      '**Our AI model providers (United States)** – generate the mentor\'s chat replies, your plans, your weekly reports and the text of your daily emails. Each request is routed to the provider best placed to serve it at that moment, and the provider handling a request sees its content.',
      '**Our speech-to-text and analysis provider (United States)** – transcribes your voice notes, analyses the transcripts for emotion, screens your messages for safety, and generates the short titles shown in your session list.',
      '**Our embedding provider (United States)** – creates the numerical representations ("embeddings") that let the mentor remember your conversations across weeks. One is created for every chat message.',
    ] },
    { t: 'p', text: 'Switching between providers is automatic and seamless. See "Who else sees your data" for what each category of provider receives and where it processes it; the named list is available on request.' },
    { t: 'h3', text: 'How we protect your data with AI providers' },
    { t: 'p', text: 'Each provider\'s API terms state that content sent through their API is not used to train or improve their models. We are in the process of finalising formal data processing agreements with these providers that include the same prohibition in contractual form, and we will update this policy once they are executed. If you have any concerns about this interim arrangement, please contact us at [info@june64.com](mailto:info@june64.com) before using the service.' },
    { t: 'h3', text: 'Safety screening' },
    { t: 'p', text: 'Every message you send is checked for language suggesting you may be at risk (a keyword check on our own server) and for misuse (an AI classifier). If risk language is found, the mentor pauses coaching for that message and shows helpline resources instead. No risk flag or profile is stored, and no one is alerted.' },
    { t: 'h3', text: 'The AI gets things wrong' },
    { t: 'p', text: 'AI-generated plans, reports and advice are not always accurate, complete or reliable; may be confidently wrong or produce inappropriate content; and are never medical, psychological or professional advice. Always use your own judgment before acting on AI-generated content.' },
    { t: 'h3', text: 'No automated decision-making' },
    { t: 'p', text: 'No decision with legal or similarly significant effects is made about you automatically. Plans and reports are suggestions only. Nothing here decides anything about your rights, money, employment or access to services. The Article 22 restrictions on automated decision-making do not apply.' },
  ] },

  { id: 'who-else-sees-your-data', h: 'Who else sees your data', blocks: [
    { t: 'p', text: 'We use a small number of service providers ("processors") to run Feelivate. Each processor acts only on our instructions and may not use your data for its own purposes. They are bound either by a data processing agreement or, where noted above for AI providers, by their published API and data processing terms while formal agreements are finalised.' },
    { t: 'h3', text: 'Our processors' },
    { t: 'p', text: 'These are the categories of processor we use, what each receives and where it processes your data. We update this whenever a processor changes. The named list of our current processors is available on request – email [info@june64.com](mailto:info@june64.com).' },
    { t: 'table', head: ['Processor', 'What it receives', 'Where'], rows: [
      ['Hosting and database provider', 'Hosts our API and database: all account data listed above. Also serves the one-tap "Done" page linked from daily emails.', 'Singapore'],
      ['Website hosting provider', 'Hosts the website and app front end; receives visitor IP addresses and request logs.', 'United States (global edge network)'],
      ['AI model providers', 'Chat messages and context, plan and report generation, daily-email text.', 'United States'],
      ['Speech-to-text and analysis provider', 'Voice audio for speech-to-text (discarded after transcription); transcripts for emotion analysis; messages for safety screening; first messages for session titles.', 'United States'],
      ['Embedding provider', 'Every chat message, to create the embeddings used for long-term memory.', 'United States'],
      ['Vector-memory provider', 'Long-term memory: the text of each chat exchange with its embedding, keyed to your account.', 'Frankfurt, Germany'],
      ['Email delivery provider', 'Email address, name, today\'s task text, verification codes, reminder and recovery emails, contact-form forwards.', 'United States company; messages are dispatched from Tokyo, Japan'],
      ['Google LLC', 'Only if you sign in with Google or connect Google Calendar: identity data; calendar events created from your plan.', 'United States'],
    ] },
    { t: 'h3', text: 'When we share your data' },
    { t: 'p', text: 'Apart from our processors, we share your personal data with no one, except where we are legally compelled to (e.g. a valid court order or binding legal obligation), or where it is necessary to establish or defend legal claims.' },
    { t: 'h3', text: 'If Feelivate is ever sold or merged' },
    { t: 'p', text: 'If Feelivate is ever sold or merged, your data may transfer to the buyer. We will tell you before that happens, and you will be able to delete your account first.' },
  ] },

  { id: 'international-transfers', h: 'Sending data outside the EU and UK', blocks: [
    { t: 'p', text: 'Feelivate\'s servers and several of our processors are located outside the European Economic Area and the United Kingdom. Your data is processed in Singapore (our API and database), the United States (website hosting, AI providers, email provider), Japan (email dispatch) and Germany (long-term memory).' },
    { t: 'h3', text: 'Safeguards for international transfers' },
    { t: 'p', text: 'Transfers outside the EEA and the UK are covered by one of the following safeguards under Chapter V of the GDPR and the UK GDPR:' },
    { t: 'ul', items: [
      'an adequacy decision (Japan holds an EU adequacy decision, and providers certified under the EU–US Data Privacy Framework and its UK extension are covered by one); or',
      'the European Commission\'s Standard Contractual Clauses, with the UK Addendum or International Data Transfer Agreement where UK law applies, together with a transfer impact assessment and supplementary measures where needed.',
    ] },
    { t: 'p', text: 'The safeguard relied on for each provider depends on that provider\'s certification status at the time; you can ask us which applies, and for a copy of the safeguards we rely on, by emailing [info@june64.com](mailto:info@june64.com).' },
  ] },

  { id: 'retention', h: 'How long we keep it', blocks: [
    { t: 'p', text: 'We keep your personal data only for as long as necessary to provide the service or as required by law.' },
    { t: 'table', head: ['Data', 'Retention period'], rows: [
      ['Account, plans, chats, journals, emotion logs, reports, long-term memory', 'For as long as your account remains open'],
      ['Everything – on account deletion', 'Erased immediately and permanently'],
      ['Consent records', 'For the life of your account, then deleted with it'],
      ['Email verification codes', '10 minutes, then cleared automatically'],
      ['Feedback you send us', 'For as long as it is useful for improving the service; you can ask us to delete yours at any time'],
      ['Service logs', 'A limited period set by our hosting platforms, then deleted'],
      ['Inactive accounts', 'Not deleted automatically. Your account and data stay until you delete them (Profile → Delete account). If we introduce automatic deletion of inactive accounts, we will update this policy and email you first'],
      ['Records we must keep by law (e.g. tax)', 'For the statutory period'],
    ] },
    { t: 'h3', text: 'Real deletion' },
    { t: 'p', text: 'Deletion is permanent deletion. We do not keep a hidden "deleted" copy of your account. Once deleted, your data cannot be recovered.' },
  ] },

  { id: 'your-rights', h: 'Your rights', blocks: [
    { t: 'p', text: 'Under the GDPR and UK GDPR you have the following rights, free of charge. Two of them work instantly inside the app:' },
    { t: 'table', head: ['Right', 'What it means', 'How to use it'], rows: [
      ['Access (Art 15)', 'Get a copy of everything we hold about you', 'Profile → Download my data – an instant JSON file'],
      ['Portability (Art 20)', 'Take your data elsewhere', 'The same export – machine-readable JSON'],
      ['Erasure (Art 17)', 'Delete everything', 'Profile → Delete account – immediate and permanent'],
      ['Rectification (Art 16)', 'Correct wrong or incomplete data', 'Edit it in the app, or email us'],
      ['Restriction (Art 18)', 'Freeze processing of your data', 'Email [info@june64.com](mailto:info@june64.com)'],
      ['Objection (Art 21)', 'Object to processing based on legitimate interests', 'Email [info@june64.com](mailto:info@june64.com)'],
      ['Withdraw consent (Art 7(3))', 'Withdraw any consent you have given', 'Turn off daily emails or disconnect Calendar in the app. To withdraw consent for wellbeing-data processing, email us – this stops the journal and emotion features, since we would no longer have a basis to run them'],
    ] },
    { t: 'h3', text: 'How we respond' },
    { t: 'p', text: 'For anything handled by email, we will respond within one month. If a request is complex, we may extend this by up to two further months and will tell you why within the first month.' },
    { t: 'h3', text: 'Identity verification' },
    { t: 'p', text: 'We may ask you to confirm your identity before acting on an emailed request. This is only so that we do not hand your journal to someone else.' },
    { t: 'h3', text: 'Withdrawal of consent' },
    { t: 'p', text: 'Where we rely on your consent, withdrawal is as easy as it was to give. Withdrawal does not make our earlier processing unlawful, but it stops us from processing your data for that purpose going forward.' },
    { t: 'h3', text: 'Complaints' },
    { t: 'p', text: 'If you think we have handled your data wrongly, please tell us first – we would like the chance to fix it. You also have the right to complain directly to a data protection supervisory authority:' },
    { t: 'table', head: ['Region', 'Authority'], rows: [
      ['EU / EEA', 'The authority in the country where you live, work, or where you think the problem happened. A list is published by the [European Data Protection Board](https://edpb.europa.eu/about-edpb/about-edpb/members_en).'],
      ['UK', 'The Information Commissioner\'s Office (ICO) – [ico.org.uk](https://ico.org.uk) or 0303 123 1113.'],
    ] },
  ] },

  { id: 'security', h: 'Security', blocks: [
    { t: 'p', text: 'We take the security of your data seriously and have implemented appropriate technical and organisational measures to protect it.' },
    { t: 'table', head: ['Measure', 'What we do'], rows: [
      ['Password protection', 'Passwords are hashed with Argon2 – we cannot see your password. Passwords must be at least 8 characters'],
      ['Encryption in transit', 'All traffic is encrypted with HTTPS/TLS'],
      ['Encryption at rest', 'Google Calendar refresh tokens are encrypted at rest with a key held separately from the database'],
      ['Access control', 'Access to your data is scoped to your own account and enforced server-side on every request'],
      ['Rate limiting', 'Login, sign-up, verification-code, contact-form, feedback, data-export and account-deletion endpoints are rate-limited against brute force and abuse'],
      ['Log redaction', 'Known identifiers (such as email addresses) are redacted from our logs; message and journal content is never logged'],
      ['Consent ledger', 'Every consent decision is recorded as its own dated entry, so we can show what you agreed to and when'],
    ] },
    { t: 'h3', text: 'Our commitment' },
    { t: 'p', text: 'No system is perfectly secure. If a breach occurs, we will notify the relevant supervisory authority within 72 hours of becoming aware of it, where required; and if the breach is likely to result in a high risk to your rights and freedoms, we will notify you directly and without undue delay.' },
  ] },

  { id: 'cookies', h: 'Cookies and local storage', blocks: [
    { t: 'p', text: 'Feelivate does not use tracking cookies. There is no cookie banner because there is nothing to consent to.' },
    { t: 'h3', text: 'Local storage' },
    { t: 'p', text: 'We store a small amount of data in your browser\'s local storage. All of it is strictly necessary to provide the service you asked for, which is why it is exempt from the consent requirement under the ePrivacy Directive and PECR:' },
    { t: 'table', head: ['Key', 'Purpose'], rows: [
      ['access_token', 'Keeps you signed in (30-day token)'],
      ['user_id, user_name', 'Shows your name and loads your data'],
      ['active_session_id', 'Remembers which goal you had open'],
      ['feelivate-theme', 'Your light/dark choice, only if you set one manually (otherwise the device setting is followed and nothing is stored)'],
      ['feelivate_onboarding_<id>', 'Whether you have completed the guided tour'],
      ['last_journal_date_…', 'Whether today\'s journal has been recorded (locks the mic for the day)'],
      ['slip_reason_…, recovery_line_…', 'The reason you chose for a missed day and the recovery line shown afterwards'],
      ['feelivate-feedback:<id>', 'Whether we have already asked you for feedback, so we do not ask again'],
    ] },
    { t: 'h3', text: 'Logging out' },
    { t: 'p', text: 'Logging out clears the authentication entries (sign-in token, user id and name, open goal) from your local storage. The remaining functional keys contain no content beyond dates and short labels and are cleared when you clear your browser data.' },
    { t: 'h3', text: 'Future changes' },
    { t: 'p', text: 'If we ever add analytics or any non-essential cookies, we will ask for your consent before loading them, and update this section to reflect what we use and why.' },
  ] },

  { id: 'children', h: 'Children', blocks: [
    { t: 'p', text: 'Feelivate is for adults. You must be 18 or over to use it.' },
    { t: 'h3', text: 'Age verification' },
    { t: 'p', text: 'We ask you to confirm your age at sign-up. By creating an account, you confirm that you are at least 18 years old.' },
    { t: 'h3', text: 'What we do if we learn otherwise' },
    { t: 'p', text: 'We do not knowingly collect data from anyone under 18. If we learn that an account belongs to someone under 18, we will close the account immediately, delete all associated data, and notify you at the email address provided.' },
    { t: 'h3', text: 'Reporting' },
    { t: 'p', text: 'If you believe a minor has created an account, please email us at [info@june64.com](mailto:info@june64.com) and we will investigate and delete it.' },
  ] },

  { id: 'changes', h: 'Changes to this policy', blocks: [
    { t: 'p', text: 'We may update this Privacy Policy from time to time.' },
    { t: 'h3', text: 'Material changes' },
    { t: 'p', text: 'If we change this policy in a way that materially affects you, we will update the version number and date at the top of this document, and ask you to review and accept the change the next time you sign in. You will have the opportunity to review the changes before continuing to use the service.' },
    { t: 'h3', text: 'No silent changes' },
    { t: 'p', text: 'You will not be silently opted into anything new. Whenever this policy is updated, you will be notified. If you do not accept the updated policy you will not be able to continue using the application; access is restored once you accept the revised policy.' },
    { t: 'h3', text: 'Previous versions' },
    { t: 'p', text: 'Previous versions of this policy are available on request – email [info@june64.com](mailto:info@june64.com).' },
  ] },

  { id: 'confidentiality', h: 'Confidentiality', blocks: [
    { t: 'p', text: 'You acknowledge that the Service may contain information that is designated confidential by us, and that you shall not disclose such information without our prior written consent. Your information is confidential and will not be divulged to any third party unless we are legally required to do so to the appropriate authorities. We will not sell, share or rent your personal information to any third party, or use your email address for unsolicited mail. Any emails sent by us will only be in connection with the provision of the agreed services, and you may ask us to stop such communications at any time.' },
  ] },

  { id: 'ico-registration', h: 'UK data protection registration', blocks: [
    { t: 'p', text: 'Our registration with the Information Commissioner\'s Office (ICO) is in progress. We will publish the registration number here as soon as it is issued; registrations can be verified at [ico.org.uk/register](https://ico.org.uk/ESDWebPages/Search).' },
  ] },

  { id: 'contact', h: 'Contact', blocks: [
    { t: 'p', text: 'If you have any questions or concerns, or would like to exercise your rights, please contact us.' },
    { t: 'table', head: ['', ''], rows: [
      ['Email', '[info@june64.com](mailto:info@june64.com)'],
      ['Post', 'JUNE64 Limited, 124–128 City Road, London, England'],
    ] },
    { t: 'h3', text: 'EU representative (GDPR Art 27)' },
    { t: 'p', text: 'We are in the process of appointing a representative in the European Union under Article 27 of the GDPR, and will publish their details here once appointed. Until then, please contact us directly at [info@june64.com](mailto:info@june64.com) on any data protection matter – you may write in your own language.' },
  ] },
];

export default function PrivacyPage() {
  const { isMobile } = useWindowSize();
  return (
    <PageShell
      seo={{
        title: 'Privacy Policy | Feelivate',
        description:
          "How Feelivate collects, uses and protects your data — including plans, voice notes and emotion logs. We don't sell your personal data and we don't track you.",
        path: '/privacy',
      }}
    >
      <PageHero
        kicker="Legal"
        title="Privacy Policy"
        subtitle="How we collect, use, and protect your information."
        isMobile={isMobile}
      />
      <LegalDoc lastUpdated={LAST_UPDATED} version={POLICY_VERSION} sections={SECTIONS} />
    </PageShell>
  );
}
