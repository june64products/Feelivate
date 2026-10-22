"""
email_service.py — Feelivate Email Service
- OTP verification emails
- The morning email: the mentor's read of last night's voice note + today's task
- The recovery email a missed day earns instead
- Countdown notes before a week that starts later
- One evening note (20:30 local) when the day's journal is still missing
- "Your review is in" the evening a week's review becomes readable
- Schedulers (APScheduler, every minute, each user's own timezone)

Every email that quotes the person uses their exact words (journal_text.py);
nothing here is written in their voice for them.
"""

import asyncio
import html as _html
import os
import json
import re
import secrets
import string
from datetime import datetime, timedelta
from typing import Optional, Tuple
import pytz

import resend
from loguru import logger

from .journal_text import said_verbatim, snippet, strongest_sentence

# ── Resend init ──────────────────────────────────────────────────────────────
resend.api_key = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "onboarding@resend.dev")
APP_URL = os.getenv("APP_URL", "https://emotion-time-travel-brlz.vercel.app")
# The API's own public URL (Northflank) — one-tap check-in links point HERE,
# not at the frontend. Left empty, emails simply ship without the button.
API_BASE_URL = os.getenv("API_BASE_URL", "").rstrip("/")
# Where a reply to the daily email goes. The sending address is a no-reply
# mailbox; replies are the lowest-friction feedback there is, so they are
# pointed at a person. Empty disables the reply line.
FEEDBACK_REPLY_TO = os.getenv("FEEDBACK_REPLY_TO", "info@june64.com").strip()

# Monday=0 ... Sunday=6
DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def generate_otp(length: int = 6) -> str:
    """Cryptographically secure numeric OTP.

    random.choices() draws from the Mersenne Twister, whose internal state is
    recoverable from enough observed output — unsuitable for a value that
    authorises an email address.
    """
    return "".join(secrets.choice(string.digits) for _ in range(length))


def _mask_email(address: str) -> str:
    """'shubham@example.com' -> 's****m@example.com'.

    Enough to correlate a delivery failure with an account during support,
    without writing the full address into retained platform logs.
    """
    address = (address or "").strip()
    if "@" not in address:
        return "[redacted]"
    local, _, domain = address.partition("@")
    if len(local) <= 2:
        masked_local = "*" * len(local)
    else:
        masked_local = f"{local[0]}{'*' * (len(local) - 2)}{local[-1]}"
    return f"{masked_local}@{domain}"


# ╔══════════════════════════════════════════════════════════════╗
# ║  Brand system — mirrors the website theme                    ║
# ╚══════════════════════════════════════════════════════════════╝
# Cream ground, ink text, warm accent, flame gradient for the one action that
# matters. One shared shell (header / card / footer) so every email that leaves
# the product looks like the same product. Fluid tables + a small media query
# keep it aligned on phone, tablet and desktop clients alike.

INK = "#141414"          # site text-primary / black pills
SUB = "#5c5b56"          # secondary text
MUTED = "#8f8e88"        # muted text
CREAM = "#f4f2ee"        # page ground (site background)
CARD = "#ffffff"         # card surface
PANEL = "#faf9f6"        # inner panel surface
BORDER = "#e7e4dd"       # hairline borders
ACCENT = "#d97757"       # site accent-warm
FLAME_A = "#ffb24d"      # streak flame gradient
FLAME_B = "#ff5a36"

FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif"
SERIF = "Georgia,'Times New Roman',serif"

_HEADER = f"""
<table cellpadding="0" cellspacing="0" style="margin:0 auto 26px;">
  <tr>
    <td style="line-height:0;">
      <!-- The dark tile is baked into the PNG rather than set as a CSS
           background. Gmail's dark mode inverts CSS colours but never touches
           images, so a white mark on a styled dark box turned into a white mark
           on a white box — invisible. A self-contained badge cannot be broken
           that way, whatever the client does to the surrounding markup. -->
      <img src="{APP_URL}/logo-email-badge.png" alt="Feelivate" width="40" height="40" style="display:block;width:40px;height:40px;" />
    </td>
    <td style="padding-left:12px;">
      <span style="font-size:19px;font-weight:800;color:{INK};letter-spacing:0.12em;font-family:{FONT};">FEELIVATE</span>
    </td>
  </tr>
</table>
"""


def _footer(manage_label: str = "Manage alerts") -> str:
    return f"""
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;">
  <tr><td align="center" style="padding:0 8px;">
    <p style="margin:0 0 6px;color:{MUTED};font-size:11.5px;font-family:{FONT};line-height:1.6;">
      &#169; 2026 Feelivate &middot; A JUNE64 product
    </p>
    <p style="margin:0;font-size:11.5px;font-family:{FONT};line-height:1.6;">
      <a href="{APP_URL}" style="color:{SUB};text-decoration:none;">feelivate.com</a>
      &nbsp;&middot;&nbsp;
      <a href="{APP_URL}/privacy" style="color:{SUB};text-decoration:none;">Privacy</a>
      &nbsp;&middot;&nbsp;
      <a href="{APP_URL}/app" style="color:{SUB};text-decoration:none;">{manage_label}</a>
    </p>
  </td></tr>
</table>"""


def _shell(preheader: str, card_rows: str, manage_label: str = "Manage alerts") -> str:
    """Wrap card rows in the shared page: cream ground, header, white card, footer."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<style>
  @media only screen and (max-width:480px) {{
    .px {{ padding-left:20px !important; padding-right:20px !important; }}
    .wrap {{ padding:24px 12px !important; }}
    .h1 {{ font-size:24px !important; }}
    .btn a {{ display:block !important; }}
  }}
</style>
</head>
<body style="margin:0;padding:0;background:{CREAM};font-family:{FONT};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">{preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{CREAM};">
  <tr><td align="center" class="wrap" style="padding:44px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
      <tr><td align="center">{_HEADER}</td></tr>
      <tr><td style="background:{CARD};border:1px solid {BORDER};border-radius:20px;overflow:hidden;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          {card_rows}
        </table>
      </td></tr>
      <tr><td>{_footer(manage_label)}</td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""


def _eyebrow(text: str, color: str = ACCENT) -> str:
    return (f'<p style="color:{color};font-size:11px;font-weight:800;text-transform:uppercase;'
            f'letter-spacing:0.14em;margin:0 0 10px;font-family:{FONT};">{text}</p>')


def _btn_dark(label: str, url: str) -> str:
    return (f'<span class="btn"><a href="{url}" style="display:inline-block;background:{INK};color:#ffffff;'
            f'text-decoration:none;font-size:13px;font-weight:800;padding:15px 34px;border-radius:100px;'
            f'letter-spacing:0.06em;text-transform:uppercase;font-family:{FONT};">{label}</a></span>')


def _btn_flame(label: str, url: str) -> str:
    return (f'<span class="btn"><a href="{url}" style="display:inline-block;'
            f'background:{FLAME_B};background-image:linear-gradient(135deg,{FLAME_A},{FLAME_B});color:#ffffff;'
            f'text-decoration:none;font-size:13px;font-weight:800;padding:15px 34px;border-radius:100px;'
            f'letter-spacing:0.06em;text-transform:uppercase;font-family:{FONT};">{label}</a></span>')


# ╔══════════════════════════════════════════════════════════════╗
# ║  OTP Verification Email                                      ║
# ╚══════════════════════════════════════════════════════════════╝

def send_verification_email(to_email: str, otp: str, user_name: str = "there") -> bool:
    if not resend.api_key:
        logger.error("RESEND_API_KEY not set.")
        return False

    rows = f"""
        <tr><td class="px" style="padding:30px 36px 22px;border-bottom:1px solid {BORDER};">
          {_eyebrow('Email verification')}
          <h1 class="h1" style="color:{INK};font-size:26px;font-weight:800;margin:0;line-height:1.2;letter-spacing:-0.02em;font-family:{FONT};">Your verification code</h1>
        </td></tr>
        <tr><td class="px" style="padding:26px 36px 30px;">
          <p style="color:{SUB};font-size:15px;margin:0 0 8px;font-family:{FONT};">Hey <strong style="color:{INK};">{user_name}</strong>,</p>
          <p style="color:{SUB};font-size:14px;margin:0 0 24px;line-height:1.7;font-family:{FONT};">
            You&#39;re one step away from daily task emails from Feelivate.
            Enter this code to switch on your alerts.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
            <tr><td style="background:{PANEL};border:1px solid {BORDER};border-radius:16px;padding:26px;text-align:center;">
              <p style="color:{MUTED};font-size:11px;text-transform:uppercase;letter-spacing:0.14em;margin:0 0 12px;font-family:{FONT};">One-time code</p>
              <p style="color:{INK};font-size:40px;font-weight:800;letter-spacing:12px;margin:0 0 0 12px;font-family:'Courier New',Courier,monospace;">{otp}</p>
            </td></tr>
          </table>
          <p style="color:{MUTED};font-size:12px;margin:0;line-height:1.6;font-family:{FONT};">
            Expires in <strong style="color:{SUB};">10 minutes</strong> &middot; single use.
            Didn&#39;t request this? You can safely ignore this email.
          </p>
        </td></tr>"""

    html = _shell("Your Feelivate verification code", rows)

    try:
        res = resend.Emails.send({
            "from": f"Feelivate <{FROM_EMAIL}>",
            "to": [to_email],
            "subject": f"{otp} — Your Feelivate verification code",
            "html": html,
        })
        logger.info(f"OTP email sent → {_mask_email(to_email)} | id={res}")
        return True
    except Exception as e:
        logger.error(f"OTP email failed → {_mask_email(to_email)}: {type(e).__name__}: {e}")
        return False


# ╔══════════════════════════════════════════════════════════════╗
# ║  AI Content Generator for Daily Email                        ║
# ╚══════════════════════════════════════════════════════════════╝

# Lines that mark a note as written by nobody in particular. A read that
# leans on any of them is thrown away in favour of the plain fallback.
_FILLER = (
    "you've got this", "you got this", "keep going", "proud of you", "you can do it",
    "believe in yourself", "crush it", "rock star", "amazing job", "great job", "every small step",
)


_STOP = {"your", "that", "this", "with", "from", "have", "what", "when", "then", "than", "they", "them",
         "about", "today", "tonight", "morning", "there", "here", "just", "been", "were", "will", "into"}


def _hook_ok(hook: str, transcript: str, name: str) -> bool:
    """
    A subject line earns its place only if it is short, has no filler, and
    carries at least one real word from the person's own note — so it can
    never be the same line for everyone.
    """
    h = " ".join((hook or "").split()).strip().strip('"“”')
    if not (8 <= len(h) <= 48) or "!" in h:
        return False
    low = h.lower()
    if any(f in low for f in _FILLER):
        return False
    from .journal_text import loose
    said = set(loose(transcript).split())
    words = [w for w in loose(h).split() if len(w) >= 4 and w not in _STOP and w != name.lower()]
    return any(w in said for w in words)


def _mentor_read(user_name, goal, journal, task_title, task_description, day_label):
    """
    What the mentor read in last night's entry: two or three plain sentences
    that could only have been written after reading THIS note, the one line
    of theirs worth quoting back, and a subject-line hook drawn from the
    note. Returns {"their_line", "read", "hook"} — hook is None when the
    model's line failed the specificity check.

    The whole transcript goes to the model. When the model is unavailable,
    paraphrases, or writes filler, the fallback is built from the entry's
    stored label, score and one-line summary — flat, but never invented.
    """
    transcript = (journal.get("transcript") or "").strip()
    their_line = strongest_sentence(transcript)
    emotion = (journal.get("emotion_label") or "").strip()
    score = journal.get("emotion_score")
    one_liner = (journal.get("one_liner") or "").strip()
    name = (user_name or "there").split()[0]

    def _fallback():
        felt = f"{emotion} at {score}/10" if emotion and score else (emotion or "logged")
        read = f"Last night read {felt}."
        if one_liner:
            read += f" {one_liner.rstrip('.')}."
        read += f" Today picks up from there: {task_title.rstrip('.')}."
        return {"their_line": their_line, "read": read, "hook": None}

    if not transcript:
        return _fallback()
    try:
        from .llm import call_llm
        prompt = f"""You are {name}'s accountability mentor. Last night they recorded this voice note — complete and verbatim; it may be in English, Hindi or Hinglish:

\"\"\"{transcript[:20000]}\"\"\"

Their goal: {goal or 'not recorded'}
Stored read of the note: {emotion or '—'}{f' {score}/10' if score else ''}{f' — {one_liner}' if one_liner else ''}
Today ({day_label}) they are supposed to: {task_title}{f' — {task_description}' if task_description else ''}

Write the two or three sentences you would say to {name} this morning, having actually read the note.
Rules:
- Refer to something specific they said: a detail, a number, a feeling they named. Nothing that could be sent to anyone else.
- Plain words, second person. No praise-filler, no "you've got this", no "keep going", no exclamation marks, no emoji, no questions, no greeting.
- If they named a problem, name the smallest fix for it today. If it went well, say exactly what to repeat.
- The last sentence connects today's task to what they said. 70 words at most.
- Also pick ONE sentence from the note worth quoting back to them — copied exactly, character for character, in their language. Not a paraphrase.
- Also write the subject line of this morning's email: at most 42 characters, one specific thing from the note said plainly — the thing they struggled with, the idea they had, the word they used. It should only make sense to {name}. No praise, no exclamation marks, no emoji, no "Day 3", no "Good morning". Examples of the shape (do not copy): "About your ring finger, {name}" · "The metronome idea — yes, today" · "Sunday's catch-up had a cost".

Respond with ONLY valid JSON: {{"their_line": "<exact sentence from the note>", "read": "<2-3 sentences>", "hook": "<subject line, 42 characters at most>"}}"""
        raw = call_llm(prompt, system="You write short, specific morning notes. Output raw JSON only.", temperature=0.5, max_tokens=400)
        raw = re.sub(r'<think>.*?</think>', '', raw or '', flags=re.DOTALL)
        raw = re.sub(r'```(?:json)?\s*', '', raw).replace('```', '').strip()
        start, end = raw.find("{"), raw.rfind("}") + 1
        data = json.loads(raw[start:end]) if start != -1 and end > start else {}
        read = " ".join(str(data.get("read") or "").split()).replace("!", ".")
        line = str(data.get("their_line") or "").strip()
        if not said_verbatim(line, [transcript]):
            line = their_line
        hook = " ".join(str(data.get("hook") or "").split()).strip().strip('"“”')
        if not _hook_ok(hook, transcript, name):
            if hook:
                logger.info("[Morning] subject hook rejected (generic or too long); using their own words")
            hook = None
        words = read.split()
        if len(words) < 8 or len(words) > 110 or any(f in read.lower() for f in _FILLER):
            logger.info("[Morning] mentor read rejected (length or filler); using the plain fallback")
            fb = _fallback()
            return {"their_line": line, "read": fb["read"], "hook": hook}
        return {"their_line": line, "read": read, "hook": hook}
    except Exception as e:
        logger.warning(f"[Morning] mentor read unavailable, using fallback: {e}")
        return _fallback()


def _bullets_to_html(text, color=SUB, icon="→", icon_color=ACCENT, font_size="14px"):
    """Convert newline/bullet separated text to styled HTML paragraphs."""
    lines = [l.strip().lstrip("•").lstrip("-").strip() for l in text.split("\n") if l.strip()]
    return "".join(
        f'<p style="color:{color};font-size:{font_size};margin:0 0 8px;line-height:1.65;">'
        f'<span style="color:{icon_color};font-weight:700;">{icon}</span>&nbsp;{line}</p>'
        for line in lines
    )


# ╔══════════════════════════════════════════════════════════════╗
# ║  Daily Task Email (Premium Design)                           ║
# ╚══════════════════════════════════════════════════════════════╝

def _esc(text) -> str:
    """User- or model-written text, safe inside the HTML."""
    return _html.escape(str(text or ""), quote=False)


def _week_strip(dots) -> str:
    """
    The week as a row of day pills — done filled, shielded blue, today in
    the accent, missed dashed, upcoming faint. It changes every single day,
    which is the point: the email never looks like yesterday's.
    `dots` is a list of (letter, status).
    """
    cells = []
    for letter, status in dots:
        if status == "done":
            style = f"background:{INK};color:#ffffff;border:1px solid {INK};"
        elif status == "shielded":
            style = "background:#eef4fb;color:#3b6ea5;border:1px solid #cfe0f2;"
        elif status == "today":
            style = f"background:{CARD};color:{ACCENT};border:2px solid {ACCENT};"
        elif status == "missed":
            style = f"background:{CARD};color:{MUTED};border:1px dashed #cfccc4;"
        else:
            style = f"background:{PANEL};color:{MUTED};border:1px solid {BORDER};"
        cells.append(
            f'<td align="center" style="padding:0 3px;"><div style="width:28px;height:28px;line-height:28px;border-radius:50%;'
            f'font-size:11px;font-weight:800;text-align:center;font-family:{FONT};{style}">{letter}</div></td>'
        )
    return (f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>{"".join(cells)}</tr></table>')


def _feedback_rows(rating_urls, reply_to) -> str:
    """One tap, no form: was today's task clear? Plus reply-to-a-person."""
    if not (rating_urls or reply_to):
        return ""
    thumbs = ""
    if rating_urls:
        up, down = rating_urls
        thumbs = (
            f'<p style="margin:0 0 8px;color:{SUB};font-size:13px;font-family:{FONT};">Was today&#8217;s task clear?</p>'
            f'<a href="{up}" style="display:inline-block;padding:9px 16px;margin:0 4px;border:1px solid {BORDER};border-radius:100px;'
            f'color:{INK};text-decoration:none;font-size:13px;font-weight:700;font-family:{FONT};">&#128077; Yes</a>'
            f'<a href="{down}" style="display:inline-block;padding:9px 16px;margin:0 4px;border:1px solid {BORDER};border-radius:100px;'
            f'color:{INK};text-decoration:none;font-size:13px;font-weight:700;font-family:{FONT};">&#128078; Not really</a>'
        )
    reply_line = (
        f'<p style="margin:{"12px" if thumbs else "0"} 0 0;color:{MUTED};font-size:12.5px;line-height:1.6;font-family:{FONT};">'
        f'Too hard, too easy, or something in the way? Just reply to this email &#8212; a person reads every one.</p>'
        if reply_to else ""
    )
    return f"""
        <tr><td class="px" style="padding:0 36px 30px;text-align:center;">
          <div style="border-top:1px solid {BORDER};padding-top:18px;">{thumbs}{reply_line}</div>
        </td></tr>"""


def build_daily_email(
    *,
    user_name: str,
    day_label: str,
    task_title: str,
    task_description: str,
    week_number: int,
    today_str: str = "",
    week_theme: str = "",
    week_label: str = "",
    day_index: Optional[int] = None,
    day_count: Optional[int] = None,
    week_dots=None,
    streak: int = 0,
    yesterday: Optional[dict] = None,
    mentor: Optional[dict] = None,
    checkin_url: str = "",
    shield_note: str = "",
    rating_urls: Optional[Tuple[str, str]] = None,
    reply_to: str = "",
) -> Tuple[str, str, str]:
    """
    The morning email: a reply to last night's note, then today's task.
    Pure — returns (subject, preheader, card rows) so it can be read in a
    test without sending anything.

    `yesterday`: {"date", "weekday_label", "transcript", "emotion_label",
    "emotion_score", "one_liner", "checkin"} for the day before, or None on
    the first day of a week. `mentor`: {"their_line", "read"} when there was
    a note to read.
    """
    name = (user_name or "there").split()[0]
    noted = bool(yesterday and (yesterday.get("transcript") or "").strip())
    streak = int(streak or 0)
    progress = f"Day {day_index} of {day_count}" if day_index and day_count else day_label
    week_sub = week_label or week_theme

    # ── Headline: from the data, never from a model ──
    if streak >= 2:
        headline = f"{streak} in a row, {_esc(name)}."
    elif noted and day_index:
        headline = f"Noted, {_esc(name)}. On to day {day_index}."
    elif noted:
        headline = f"Noted, {_esc(name)}. On to today."
    elif day_index and day_count:
        headline = f"Day {day_index} of {day_count}, {_esc(name)}."
    else:
        headline = f"{_esc(day_label)}, {_esc(name)}."

    # ── Subject: the mentor's hook from their note, else their own words,
    #    then the streak, then the day. This is the notification line. ──
    day_up = f"day {day_index} is up" if day_index else "today is up"
    hook = (mentor or {}).get("hook") if noted else None
    if hook:
        subject = hook
    elif noted and mentor and mentor.get("their_line"):
        subject = f"“{snippet(mentor['their_line'], 48)}” — {day_up}"
    elif streak >= 2:
        subject = f"{streak} days in a row, {name} — {day_up}"
    elif day_index and day_count:
        subject = f"Day {day_index} of {day_count}, {name} — today's one thing"
    else:
        subject = f"{day_label}, {name} — today's one thing"
    # The preview line under the subject: the mentor's first sentence when
    # there is one (it is about them), otherwise today's task.
    read_first = ""
    if noted and mentor and mentor.get("read"):
        read_first = re.split(r"(?<=[.!?])\s+", mentor["read"].strip(), maxsplit=1)[0]
    preheader = (read_first or task_title)[:110]

    rows = f"""
        <tr><td class="px" style="padding:30px 36px 22px;border-bottom:1px solid {BORDER};">
          {_eyebrow(f'Week {week_number} &middot; {progress}' + (f' &middot; {today_str}' if today_str else ''))}
          <h1 class="h1" style="color:{INK};font-size:30px;font-weight:800;margin:0;line-height:1.15;letter-spacing:-0.02em;font-family:{FONT};">{headline}</h1>
          {f'<p style="color:{MUTED};font-size:12.5px;margin:8px 0 0;font-family:{FONT};">{_esc(week_sub)}</p>' if week_sub else ''}
        </td></tr>"""

    if shield_note:
        rows += f"""
        <tr><td class="px" style="padding:18px 36px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef4fb;border:1px solid #cfe0f2;border-radius:14px;">
            <tr><td style="padding:14px 18px;">
              <p style="color:#3b6ea5;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 6px;font-family:{FONT};">&#128737;&#65039; Streak shield</p>
              <p style="color:#41597a;font-size:13px;margin:0;line-height:1.6;font-family:{FONT};">{_esc(shield_note)}</p>
            </td></tr>
          </table>
        </td></tr>"""

    # ── Last night, in their words — then what the mentor read in it ──
    if noted:
        line = (mentor or {}).get("their_line") or strongest_sentence(yesterday.get("transcript") or "")
        meta = " &middot; ".join(x for x in (
            _esc(yesterday.get("weekday_label") or "Last night"),
            _esc(yesterday.get("emotion_label") or ""),
            f"{yesterday.get('emotion_score')}/10" if yesterday.get("emotion_score") else "",
        ) if x)
        rows += f"""
        <tr><td class="px" style="padding:22px 36px 0;">
          {_eyebrow('Last night, in your words', INK)}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="border-left:3px solid {INK};padding:4px 0 4px 16px;">
              <p style="color:{INK};font-size:15.5px;font-style:italic;line-height:1.7;margin:0 0 6px;font-family:{SERIF};">&#8220;{_esc(line)}&#8221;</p>
              <p style="color:{MUTED};font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.14em;margin:0;font-family:{FONT};">{meta}</p>
            </td></tr>
          </table>
        </td></tr>"""
        if mentor and mentor.get("read"):
            rows += f"""
        <tr><td class="px" style="padding:18px 36px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{CARD};border:1px solid {BORDER};border-radius:14px;">
            <tr><td style="padding:16px 20px;">
              <p style="color:{INK};font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 8px;font-family:{FONT};">What your mentor read</p>
              <p style="color:{SUB};font-size:14.5px;margin:0;line-height:1.7;font-family:{FONT};">{_esc(mentor['read'])}</p>
            </td></tr>
          </table>
        </td></tr>"""
    elif yesterday and (yesterday.get("checkin") in ("done", "shielded")):
        rows += f"""
        <tr><td class="px" style="padding:22px 36px 0;">
          <p style="color:{SUB};font-size:14px;margin:0;line-height:1.7;font-family:{FONT};">No note last night &#8212; {_esc(yesterday.get('weekday_label') or 'yesterday')} got ticked, but your mentor only knows the box, not the day. Tonight, one minute: how it actually went.</p>
        </td></tr>"""

    # ── Today ──
    rows += f"""
        <tr><td class="px" style="padding:18px 36px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{PANEL};border:1px solid {BORDER};border-left:3px solid {ACCENT};border-radius:14px;">
            <tr><td style="padding:18px 20px;">
              <p style="color:{ACCENT};font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.14em;margin:0 0 8px;font-family:{FONT};">Today &middot; {_esc(day_label)}</p>
              <p style="color:{INK};font-size:17px;font-weight:700;margin:0 0 8px;line-height:1.45;font-family:{FONT};">{_esc(task_title)}</p>
              {f'<p style="color:{SUB};font-size:13.5px;margin:0;line-height:1.7;font-family:{FONT};">{_esc(task_description)}</p>' if task_description else ''}
            </td></tr>
          </table>
        </td></tr>"""

    if week_dots:
        rows += f"""
        <tr><td class="px" style="padding:18px 36px 0;text-align:center;">
          {_week_strip(week_dots)}
          <p style="color:{MUTED};font-size:11px;margin:8px 0 0;letter-spacing:0.06em;text-transform:uppercase;font-family:{FONT};">Your week so far</p>
        </td></tr>"""

    # ── The one action: open the day. Marking done stays one tap away. ──
    done_link = (
        f'<p style="margin:14px 0 0;font-family:{FONT};"><a href="{checkin_url}" style="color:{SUB};font-size:12.5px;text-decoration:underline;">Already did it? Mark today done &#10003;</a></p>'
        if checkin_url else ""
    )
    rows += f"""
        <tr><td class="px" style="padding:26px 36px 24px;text-align:center;">
          {_btn_flame('Open today &#8594;', APP_URL + '/app')}
          {done_link}
        </td></tr>"""

    return subject, preheader, rows + _feedback_rows(rating_urls, reply_to)


def send_daily_task_email(
    to_email: str,
    user_name: str,
    day_label: str,          # "Thursday"
    task_title: str,
    task_description: str,
    week_number: int,        # 0, 1, 2, 3 ...
    session_focus: str,
    week_theme: str = "",
    week_label: str = "",    # e.g. "Jun 5 – Jun 11"
    user_timezone: str = "UTC",
    checkin_url: str = "",   # signed one-tap "Done" link (empty = no link)
    shield_note: str = "",   # set when a streak shield auto-covered yesterday
    rating_urls: Optional[Tuple[str, str]] = None,  # signed (👍, 👎) links: "was today's task clear?"
    reply_to: str = "",      # where a plain reply to this email lands
    day_index: Optional[int] = None,
    day_count: Optional[int] = None,
    week_dots=None,
    streak: int = 0,
    yesterday: Optional[dict] = None,
) -> bool:
    if not resend.api_key:
        logger.error("RESEND_API_KEY not set.")
        return False

    # Date shown in the email = the recipient's local date (not hardcoded IST).
    try:
        _disp_tz = pytz.timezone(user_timezone)
    except Exception:
        _disp_tz = pytz.utc
    today_str = datetime.now(_disp_tz).strftime("%A, %d %B")

    mentor = None
    if yesterday and (yesterday.get("transcript") or "").strip():
        mentor = _mentor_read(user_name, session_focus, yesterday, task_title, task_description, day_label)

    subject, preheader, rows = build_daily_email(
        user_name=user_name, day_label=day_label, task_title=task_title, task_description=task_description,
        week_number=week_number, today_str=today_str, week_theme=week_theme, week_label=week_label,
        day_index=day_index, day_count=day_count, week_dots=week_dots, streak=streak,
        yesterday=yesterday, mentor=mentor, checkin_url=checkin_url, shield_note=shield_note,
        rating_urls=rating_urls, reply_to=reply_to,
    )
    html = _shell(preheader, rows, manage_label="Manage alerts")

    try:
        payload = {
            "from": f"Feelivate <{FROM_EMAIL}>",
            "to": [to_email],
            "subject": subject,
            "html": html,
        }
        if reply_to:
            payload["reply_to"] = reply_to
        res = resend.Emails.send(payload)
        logger.info(f"Daily email sent → {_mask_email(to_email)} (Week {week_number} · {day_label}) | id={res}")
        return True
    except Exception as e:
        logger.error(f"Daily email failed → {_mask_email(to_email)}: {type(e).__name__}: {e}")
        return False


# ╔══════════════════════════════════════════════════════════════╗
# ║  Recovery Email — "don't miss twice"                         ║
# ╚══════════════════════════════════════════════════════════════╝

def send_recovery_email(
    to_email: str,
    user_name: str,
    task_title: str,
    commitment_why: str = "",
    checkin_url: str = "",
) -> bool:
    """The email a missed day earns INSTEAD of the normal daily one.

    Failure is where people quit, and it's the moment most apps stay silent or
    guilt-trip. This does neither: state the science (one miss changes nothing),
    point everything at today, and — the part no generic chatbot can do —
    quote the user's own stored "why" back to them.
    """
    if not resend.api_key:
        logger.error("RESEND_API_KEY not set.")
        return False

    name = (user_name or "there").split()[0]

    why_html = ""
    if (commitment_why or "").strip():
        why_html = f"""
        <tr><td class="px" style="padding:0 36px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="border-left:3px solid {INK};padding:4px 0 4px 16px;">
              <p style="color:{INK};font-size:15.5px;font-style:italic;line-height:1.75;margin:0 0 6px;font-family:{SERIF};">&#8220;{commitment_why.strip()}&#8221;</p>
              <p style="color:{MUTED};font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.14em;margin:0;font-family:{FONT};">You, when you started</p>
            </td></tr>
          </table>
        </td></tr>"""

    if checkin_url:
        cta_html = f"""
          {_btn_flame('Done &#8212; I&#39;m back &#10003;', checkin_url)}
          <p style="margin:14px 0 0;font-family:{FONT};"><a href="{APP_URL}/app" style="color:{MUTED};font-size:12.5px;text-decoration:none;">What got in the way? Tell your mentor &#8594;</a></p>"""
    else:
        cta_html = _btn_dark('I&#39;m back &#8212; open Feelivate &#8594;', f"{APP_URL}/app")

    rows = f"""
        <tr><td class="px" style="padding:30px 36px 22px;border-bottom:1px solid {BORDER};">
          {_eyebrow('Recovery &middot; don&#39;t miss twice')}
          <h1 class="h1" style="color:{INK};font-size:27px;font-weight:800;margin:0;line-height:1.2;letter-spacing:-0.02em;font-family:{FONT};">One missed day changes nothing.</h1>
        </td></tr>

        <tr><td class="px" style="padding:24px 36px 18px;">
          <p style="color:{SUB};font-size:15px;margin:0 0 12px;line-height:1.7;font-family:{FONT};">Hey <strong style="color:{INK};">{name}</strong> &#8212; yesterday didn&#39;t happen. That&#39;s fine. Really.</p>
          <p style="color:{SUB};font-size:14px;margin:0;line-height:1.7;font-family:{FONT};">The research is clear: missing a <strong style="color:{INK};">single day does not break a habit</strong> (Lally et&nbsp;al., 2010). What starts a new, worse habit is missing <em>twice</em>. So there&#39;s exactly one day that matters now &#8212; today.</p>
        </td></tr>

        {why_html}

        <tr><td class="px" style="padding:0 36px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{PANEL};border:1px solid {BORDER};border-left:3px solid {ACCENT};border-radius:14px;">
            <tr><td style="padding:18px 20px;">
              <p style="color:{ACCENT};font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.14em;margin:0 0 8px;font-family:{FONT};">Today&#39;s task &#8212; smaller counts too</p>
              <p style="color:{INK};font-size:16px;font-weight:700;margin:0 0 6px;line-height:1.45;font-family:{FONT};">{task_title}</p>
              <p style="color:{SUB};font-size:13.5px;margin:0;line-height:1.7;font-family:{FONT};">Bad day? Do the 2-minute version. A small win keeps the chain alive &#8212; perfection was never the deal.</p>
            </td></tr>
          </table>
        </td></tr>

        <tr><td class="px" style="padding:22px 36px 32px;text-align:center;">
          {cta_html}
        </td></tr>"""

    html = _shell("One missed day changes nothing — today's the one that matters", rows)

    try:
        resend.Emails.send({
            "from": f"Feelivate <{FROM_EMAIL}>",
            "to": [to_email],
            "subject": "One missed day changes nothing — today's the one that matters",
            "html": html,
        })
        logger.info(f"Recovery email sent → {_mask_email(to_email)}")
        return True
    except Exception as e:
        logger.error(f"Recovery email failed → {_mask_email(to_email)}: {type(e).__name__}: {e}")
        return False


# ╔══════════════════════════════════════════════════════════════╗
# ║  Plan Date Parser (helper)                                   ║
# ╚══════════════════════════════════════════════════════════════╝

# ╔══════════════════════════════════════════════════════════════╗
# ║  Countdown emails — the days between locking a week and      ║
# ║  its start. Nothing is due yet; these build up to Day 1.     ║
# ╚══════════════════════════════════════════════════════════════╝

# At most this many build-up emails before a start; a longer runway stays
# quiet until the last three days so the channel isn't spent before Day 1.
COUNTDOWN_DAYS = 3


def _countdown_fallback(plan, start_iso):
    """Three honest notes when the model is unavailable."""
    days = (plan or {}).get("days") or []
    first = (days[0].get("action") if days else "") or "your first task"
    return [
        {"days_before": 3, "subject": "3 days to go — here's what Day 1 looks like",
         "intro": "Your week is locked. Nothing is due yet — today is just a look ahead.",
         "focus": f"Day 1 will be: {first[:220]}",
         "prep": ["Read Day 1 once, so there are no surprises.", "Decide the time of day you'll do it."]},
        {"days_before": 2, "subject": "2 days to go — one thing to set up today",
         "intro": "Still nothing to do. One small bit of setup today makes Day 1 easy.",
         "focus": "Clear the space, gear or time slot your first task needs.",
         "prep": ["Put the first task in your calendar.", "Tell one person when you start."]},
        {"days_before": 1, "subject": "Tomorrow it starts",
         "intro": "Last quiet day. Tomorrow your first task lands at this time.",
         "focus": f"Tomorrow: {first[:220]}",
         "prep": ["Set the alarm tonight.", "Lay out whatever Day 1 needs before you sleep."]},
    ]


def build_countdown_notes(plan, session_focus, start_iso, today_iso):
    """Write the build-up notes once, at approval, so the countdown days cost
    no model calls later and read as one arc. Returns a list of
    {days_before, subject, intro, focus, prep[]}; only the entries whose
    days_before fits the runway are kept."""
    from datetime import date as _d
    runway = (_d.fromisoformat(start_iso) - _d.fromisoformat(today_iso)).days
    wanted = [n for n in (3, 2, 1) if n <= runway]
    if not wanted:
        return []
    notes = None
    try:
        from .llm import call_llm
        days = (plan or {}).get("days") or []
        day_lines = "\n".join(f"- {d.get('day', '')}: {str(d.get('action', ''))[:220]}" for d in days[:7])
        prompt = f"""You are a warm, practical behavioural coach. A user has locked their first weekly plan but chose to START it on {start_iso}, {runway} days from now, so they can get ready.

Their goal: {session_focus or 'not stated'}
Week theme: {(plan or {}).get('theme', '')}
The week's tasks:
{day_lines}

Write the short build-up emails for the days before the start. Return ONLY a JSON array with one object for each of these days_before values: {wanted}. Each object:
{{"days_before": N, "subject": "under 60 chars, plain, no emoji", "intro": "1-2 sentences: nothing is due yet; what today's note is for", "focus": "1-2 sentences: the single most useful thing to know or prepare for Day 1, specific to THESE tasks", "prep": ["2-3 concrete 5-minute preparation steps, each under 90 chars"]}}

Rules: never ask them to do a task early; never mention streaks or missing days; be specific to their tasks (gear, space, time, mindset); the days_before=1 note must mention that the first task arrives tomorrow. No markdown, no text outside the JSON."""
        raw = call_llm(prompt, temperature=0.6, max_tokens=900)
        raw = re.sub(r'```(?:json)?\s*', '', raw).replace('```', '').strip()
        parsed = json.loads(raw[raw.find("["):raw.rfind("]") + 1])
        notes = []
        for item in parsed:
            if not isinstance(item, dict):
                continue
            try:
                n = int(item.get("days_before"))
            except (TypeError, ValueError):
                continue
            if n not in wanted:
                continue
            prep = [str(p).strip() for p in (item.get("prep") or []) if str(p).strip()][:3]
            notes.append({
                "days_before": n,
                "subject": str(item.get("subject") or "").strip()[:80] or f"{n} day{'s' if n != 1 else ''} to go",
                "intro": str(item.get("intro") or "").strip()[:400],
                "focus": str(item.get("focus") or "").strip()[:400],
                "prep": prep,
            })
        if not notes:
            raise ValueError("model returned no usable notes")
    except Exception as e:
        logger.warning(f"Countdown notes fallback: {e}")
        notes = [n for n in _countdown_fallback(plan, start_iso) if n["days_before"] in wanted]
    return sorted(notes, key=lambda n: -n["days_before"])


def send_countdown_email(to_email, user_name, note, start_iso, week_number, session_focus, user_timezone="UTC"):
    """One build-up email for a day before the week starts."""
    if not resend.api_key:
        logger.error("RESEND_API_KEY not set.")
        return False
    from datetime import date as _d
    n = int(note.get("days_before", 1))
    start_label = _d.fromisoformat(start_iso).strftime("%A %d %B")
    eyebrow = "Tomorrow it starts" if n == 1 else f"{n} days to go"
    prep_html = _bullets_to_html("\n".join(note.get("prep") or []), SUB, "&#8594;", ACCENT, "14px")
    rows = f"""
        <tr><td class="px" style="padding:34px 36px 8px;">
          {_eyebrow(f'Week {week_number} &middot; starts {start_label}')}
          <h1 class="h1" style="color:{INK};font-size:28px;font-weight:800;line-height:1.15;letter-spacing:-0.03em;margin:0 0 12px;font-family:{FONT};">{eyebrow}</h1>
          <p style="color:{SUB};font-size:15px;line-height:1.65;margin:0;font-family:{FONT};">Hi {user_name}. {note.get('intro', '')}</p>
        </td></tr>
        <tr><td class="px" style="padding:18px 36px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{CREAM};border-radius:14px;">
            <tr><td style="padding:16px 18px;">
              {_eyebrow('Get ready for Day 1', INK)}
              <p style="color:{INK};font-size:14.5px;line-height:1.6;margin:0;font-family:{FONT};">{note.get('focus', '')}</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td class="px" style="padding:18px 36px 0;">
          {_eyebrow('Five minutes today')}
          {prep_html}
        </td></tr>
        <tr><td class="px" align="center" style="padding:26px 36px 34px;">
          {_btn_dark('See your week &#8594;', APP_URL + '/app')}
          <p style="margin:14px 0 0;color:{MUTED};font-size:12.5px;line-height:1.6;font-family:{FONT};">Nothing is due until {start_label}. Your first task arrives then, at this time.</p>
        </td></tr>"""
    html = _shell(f"{eyebrow} — your week starts {start_label}.", rows)
    try:
        resend.Emails.send({
            "from": f"Feelivate <{FROM_EMAIL}>",
            "to": [to_email],
            "subject": note.get("subject") or eyebrow,
            "html": html,
        })
        logger.info(f"[Countdown] sent ({n} days before) to {_mask_email(to_email)}")
        return True
    except Exception as e:
        logger.error(f"[Countdown] send failed for {_mask_email(to_email)}: {type(e).__name__}: {e}")
        return False


def get_countdown_for_user(user, db, today_iso):
    """The countdown note due today, if the user's locked week hasn't started.

    Returns (note, session) or None. Only the last COUNTDOWN_DAYS before the
    start send anything; a longer runway stays quiet before that."""
    from .models import Session as SessionModel
    from datetime import date as _d
    session = (
        db.query(SessionModel)
        .filter(
            SessionModel.user_id == user.id,
            SessionModel.is_completed == 0,
            SessionModel.phase == "active",
            SessionModel.plan_starts_on.isnot(None),
        )
        .order_by(SessionModel.created_at.desc())
        .first()
    )
    if not session or not session.plan_starts_on or session.plan_starts_on <= today_iso:
        return None
    days_before = (_d.fromisoformat(session.plan_starts_on) - _d.fromisoformat(today_iso)).days
    if days_before > COUNTDOWN_DAYS:
        return None
    try:
        notes = json.loads(session.countdown_json or "[]")
    except ValueError:
        notes = []
    note = next((n for n in notes if int(n.get("days_before", -1)) == days_before), None)
    if note is None:
        try:
            plan = json.loads(session.week_plan_json or "{}")
        except ValueError:
            plan = {}
        note = next((n for n in _countdown_fallback(plan, session.plan_starts_on) if n["days_before"] == days_before), None)
    return (note, session) if note else None


def _parse_plan_date(day_str, reference_year):
    """
    Parse a date from plan day strings like 'Jun 5 (Thu)', 'May 28 (Wed)'.
    Returns datetime.date or None.
    """
    from datetime import date as DateObj
    MONTHS = {
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
        'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
    }
    m = re.search(r'([A-Za-z]+)\s+(\d{1,2})', str(day_str))
    if not m:
        return None
    month_num = MONTHS.get(m.group(1).lower()[:3])
    if not month_num:
        return None
    try:
        return DateObj(reference_year, month_num, int(m.group(2)))
    except ValueError:
        return None


# ╔══════════════════════════════════════════════════════════════╗
# ║  Get Today's Task (with Week-Pause logic)                    ║
# ╚══════════════════════════════════════════════════════════════╝

def get_today_task_for_user(user, db):
    """
    Finds the user's active (locked) session and returns today's task.

    PAUSE LOGIC:
    - Email sends ONLY while the current plan's dates are still active.
    - When the last day of the plan passes (e.g. Week 0 ends on Sunday):
      → emails PAUSE automatically.
    - Emails RESUME the moment the next plan is approved & locked
      (phase='active'), starting from whatever day that happens.

    Returns a dict or None (None = skip email this tick).
    """
    try:
        from datetime import date as DateObj
        from .models import Session as SessionModel

        # Only query locked/approved plans
        session = (
            db.query(SessionModel)
            .filter(
                SessionModel.user_id == user.id,
                SessionModel.is_completed == 0,
                SessionModel.phase == "active",
                SessionModel.week_plan_json.isnot(None),
            )
            .order_by(SessionModel.created_at.desc())
            .first()
        )
        if not session or not session.week_plan_json:
            return None

        plan = json.loads(session.week_plan_json)
        days = plan.get("days", [])
        if not days:
            return None

        # Use the user's OWN timezone so the correct day's task is picked
        # worldwide (was hardcoded to IST). Falls back to UTC, not India.
        _tz_str = getattr(user, "preferred_notification_timezone", None) or "UTC"
        try:
            _user_tz = pytz.timezone(_tz_str)
        except Exception:
            _user_tz = pytz.utc
        now_local     = datetime.now(_user_tz)
        today         = now_local.date()
        today_idx     = now_local.weekday()
        today_name    = now_local.strftime("%A").lower()   # "thursday"
        today_short   = now_local.strftime("%a").lower()   # "thu"
        ref_year      = today.year

        # ── PAUSE logic: check if today is within plan date range ────────────
        first_date = _parse_plan_date(days[0].get("day", ""), ref_year)
        last_date  = _parse_plan_date(days[-1].get("day", ""), ref_year)

        # A week scheduled to start later: no task until that day, whatever the
        # day labels say. (Labels are also checked below for older plans.)
        if session.plan_starts_on and today.isoformat() < session.plan_starts_on:
            logger.info(f"[Task] Week starts {session.plan_starts_on} for user {user.id}. Skipping.")
            return None

        if first_date and last_date:
            if today < first_date:
                logger.info(f"[Task] Plan not started yet for user {user.id}. Skipping.")
                return None
            if today > last_date:
                # Week finished, next plan not locked yet → PAUSE emails
                logger.info(
                    f"[Task] Week {session.current_week} ended on {last_date} for user {user.id}. "
                    "Emails paused until next plan is locked."
                )
                return None
        # ────────────────────────────────────────────────────────────────────

        # ── Find today's day entry by text matching ──────────────────────────
        day_entry = None
        for d in days:
            dstr = str(d.get("day", "")).lower()
            if today_name in dstr or today_short in dstr:
                day_entry = d
                break

        # Fallback: array index
        if not day_entry and len(days) == 7 and today_idx < len(days):
            day_entry = days[today_idx]

        if not day_entry:
            logger.warning(f"[Task] No task for {today_name} in user {user.id}'s plan. Skipping.")
            return None

        week_num    = session.current_week or 1
        week_lbl    = plan.get("week_label") or ""
        week_theme  = plan.get("theme") or ""

        # Where today sits in the week (the Journey's own bounds), for the
        # "Day 3 of 7" line and the week strip. Best effort: an older session
        # without stamped bounds simply goes without.
        week_start = week_end = None
        day_index = day_count = None
        try:
            from .weeks import _week_bounds_for
            week_start, week_end, day_count = _week_bounds_for(session, week_num)
            day_index = (today - DateObj.fromisoformat(week_start)).days + 1
            if not (1 <= day_index <= day_count):
                day_index = None
        except Exception:
            pass

        return {
            "task_title":       day_entry.get("action") or day_entry.get("title") or "Today's Task",
            "task_description": day_entry.get("description") or day_entry.get("details") or "",
            "week_number":      week_num,
            "week_label":       week_lbl,
            "week_theme":       week_theme,
            "day_label":        DAY_LABELS[today_idx],
            "session_focus":    session.focus or "personal transformation",
            # The user's stored "why" — quoted back in the recovery email.
            "commitment_why":   getattr(session, "commitment_why", None) or "",
            "session_id":       session.id,
            "week_start":       week_start,
            "week_end":         week_end,
            "day_index":        day_index,
            "day_count":        day_count,
        }
    except Exception as e:
        logger.error(f"get_today_task_for_user failed for user {user.id}: {e}")
        return None


# ╔══════════════════════════════════════════════════════════════╗
# ║  APScheduler Job (runs every minute)                         ║
# ╚══════════════════════════════════════════════════════════════╝

# ╔══════════════════════════════════════════════════════════════╗
# ║  Evening reminders                                           ║
# ╚══════════════════════════════════════════════════════════════╝

# Local clock time the evening note goes out at — checked per user, in that
# user's own timezone, so 20:30 means 20:30 wherever they are. One note a
# night: the journal nudge and the streak warning used to be two emails an
# hour apart, which made three a day with the morning one.
EVENING_REMINDER_TIME = os.getenv("EVENING_REMINDER_TIME", "20:30")
# The evening a week's review becomes readable: "your review is in".
REVIEW_EMAIL_TIME = os.getenv("REVIEW_EMAIL_TIME", "21:30")
# A week that ended longer ago than this is never announced (first deploy,
# long-dormant accounts): the review is still in the archive, just not mailed.
REVIEW_EMAIL_MAX_AGE_DAYS = 2


def _reminder_email(
    to_email: str,
    subject: str,
    eyebrow: str,
    heading: str,
    body_lines: list,
    cta_label: str,
    accent: str = "#a855f7",
    footer_note: str = "",
) -> bool:
    """One template for both evening nudges.

    Deliberately short. This lands in the evening, when the point is to get
    someone back into the app in one tap — not to be read.
    """
    if not resend.api_key:
        logger.error("RESEND_API_KEY not set.")
        return False

    paragraphs = "".join(
        f'<p style="margin:0 0 14px;color:{SUB};font-size:14.5px;line-height:1.7;font-family:{FONT};">{line}</p>'
        for line in body_lines
    )

    note_html = ""
    if footer_note:
        note_html = (f'<p style="margin:18px 0 0;color:{MUTED};font-size:12px;'
                     f'line-height:1.6;font-family:{FONT};">{footer_note}</p>')

    rows = f"""
        <tr><td class="px" style="padding:32px 36px 34px;">
          {_eyebrow(eyebrow, accent)}
          <h1 class="h1" style="margin:0 0 16px;color:{INK};font-size:24px;line-height:1.25;
                     font-weight:800;letter-spacing:-0.02em;font-family:{FONT};">{heading}</h1>
          {paragraphs}
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 0;">
            <tr><td>{_btn_dark(cta_label, f"{APP_URL}/app")}</td></tr>
          </table>
          {note_html}
          <p style="margin:14px 0 0;color:{MUTED};font-size:12px;line-height:1.6;font-family:{FONT};">
            You can turn these reminders off any time from Alerts in the app.
          </p>
        </td></tr>"""

    html = _shell(heading, rows, manage_label="Manage alerts")

    try:
        resend.Emails.send({
            "from": f"Feelivate <{FROM_EMAIL}>",
            "to": [to_email],
            "subject": subject,
            "html": html,
        })
        logger.info(f"Reminder sent → {_mask_email(to_email)} | {eyebrow}")
        return True
    except Exception as e:
        logger.error(f"Reminder failed → {_mask_email(to_email)}: {type(e).__name__}: {e}")
        return False


def build_evening_email(user_name: str, task_title: str, streak: int = 0, streak_at_risk: bool = False) -> dict:
    """
    The one evening note. Asks how the day went, names the day's task, and —
    only when a live streak would end tonight — says so in one line.
    Returns {"subject", "eyebrow", "heading", "body_lines", "cta_label",
    "accent", "footer_note"} for `_reminder_email`.
    """
    name = (user_name or "there").split()[0]
    streak = int(streak or 0)
    body = []
    if task_title:
        body.append(f"Today was: <strong style=\"color:{INK};\">{_esc(task_title.strip().rstrip('.'))}</strong>.")
    body.append(
        "Say how it actually went &#8212; done, half-done, or not at all. One minute, out loud. "
        "Your mentor reads every word before tomorrow morning&#8217;s note."
    )
    footer = ""
    if streak_at_risk and streak >= 1:
        day_word = "day" if streak == 1 else "days"
        body.append(f"{streak} {day_word} in a row. Tonight&#8217;s note keeps it.")
        footer = "Streaks are a motivational feature, nothing more &mdash; nothing is lost if one breaks."
    if streak_at_risk and streak >= 2:
        subject = f"{streak} days in a row — one minute keeps it"
    else:
        subject = f"How did today go, {name}?"
    return {
        "subject": subject,
        "eyebrow": "Tonight &middot; one minute",
        "heading": f"{_esc(name)}, how did today actually go?",
        "body_lines": body,
        "cta_label": "Record tonight's note",
        "accent": ACCENT,
        "footer_note": footer,
    }


def send_evening_email(to_email: str, user_name: str, task_title: str, streak: int = 0, streak_at_risk: bool = False) -> bool:
    """20:30 local — today's voice note hasn't been recorded."""
    e = build_evening_email(user_name, task_title, streak, streak_at_risk)
    return _reminder_email(
        to_email=to_email,
        subject=e["subject"],
        eyebrow=e["eyebrow"],
        heading=e["heading"],
        body_lines=e["body_lines"],
        cta_label=e["cta_label"],
        accent=e["accent"],
        footer_note=e["footer_note"],
    )


def _recipient_for(user) -> str:
    """Where a user's mail actually goes.

    Falls back to the address the account was created with. `notification_email`
    only exists because alerts can be pointed at a different inbox, and it is
    null for anyone who never did that — which was silently excluding them from
    every scheduled email even though we hold a perfectly good address for them.
    """
    return (user.notification_email or user.email or "").strip()


def _has_journal_today(db, user_id: str, local_date: str) -> bool:
    from .models import VoiceJournal
    return (
        db.query(VoiceJournal)
        .filter(VoiceJournal.user_id == user_id, VoiceJournal.date == local_date)
        .first()
        is not None
    )


def _has_active_plan(db, user_id: str) -> bool:
    """Only nudge people who are actually mid-plan.

    Someone with no locked week has nothing to be reminded about, and emailing
    them anyway is the fastest way to get the whole channel muted.
    """
    from .models import Session as SessionModel
    from datetime import date as _d
    session = (
        db.query(SessionModel)
        .filter(SessionModel.user_id == user_id, SessionModel.phase == "active")
        .order_by(SessionModel.created_at.desc())
        .first()
    )
    if session is None:
        return False
    # A week scheduled for later is locked but not running: no journal or
    # streak reminders until it begins.
    starts_on = getattr(session, "plan_starts_on", None)
    return not (starts_on and starts_on > _d.today().isoformat())


def _streak_at_risk(db, user_id: str, now_local) -> int:
    """
    The streak that ends tonight if today stays unchecked, else 0: a run of
    at least one day, alive through yesterday (a shielded yesterday counts —
    that user is exactly the at-risk one), and today not yet done.
    """
    from .models import DailyCheckin, UserStreak

    streak = db.query(UserStreak).filter(UserStreak.user_id == user_id).first()
    if not streak or (streak.current_streak or 0) < 1:
        return 0
    today = now_local.strftime("%Y-%m-%d")
    yesterday = (now_local.date() - timedelta(days=1)).isoformat()
    chain_yesterday = (
        db.query(DailyCheckin)
        .filter(DailyCheckin.user_id == user_id, DailyCheckin.date == yesterday, DailyCheckin.status.in_(("done", "shielded")))
        .first()
    )
    if not chain_yesterday:
        return 0
    done_today = (
        db.query(DailyCheckin)
        .filter(DailyCheckin.user_id == user_id, DailyCheckin.date == today, DailyCheckin.status == "done")
        .first()
    )
    return 0 if done_today else int(streak.current_streak)


def run_evening_reminders(now_utc: Optional[datetime] = None):
    """Called every minute by APScheduler, alongside the daily task email.

    Same timezone handling as the morning email: for each user we ask what time
    it is where THEY are, and match against EVENING_REMINDER_TIME. 20:30 in
    Delhi and 20:30 in Chicago are different UTC instants, and both get hit.

    One note a night, only when the day's voice journal is still missing. If
    a live streak would end tonight, the same note says so — it is not a
    second email any more.

    Only users who enabled email notifications are contacted — that switch is
    the consent record for this channel, so it gates every message here.
    """
    from .database import SessionLocal
    from .models import User

    now_utc = now_utc or datetime.now(pytz.utc)
    db = SessionLocal()
    try:
        users = (
            db.query(User)
            .filter(User.email_notifications_enabled == 1)
            .all()
        )
        if not users:
            return

        for user in users:
            try:
                tz_str = user.preferred_notification_timezone or "UTC"
                try:
                    user_tz = pytz.timezone(tz_str)
                except Exception:
                    user_tz, tz_str = pytz.utc, "UTC"

                now_local = now_utc.astimezone(user_tz)
                today = now_local.strftime("%Y-%m-%d")

                since = _minutes_since(now_local, EVENING_REMINDER_TIME)
                if since is None or not (0 <= since < SEND_GRACE_MINUTES):
                    continue
                if user.last_journal_reminder_date == today:
                    continue
                recipient = _recipient_for(user)
                if not recipient:
                    continue
                if not _has_active_plan(db, user.id):
                    continue
                if _has_journal_today(db, user.id, today):
                    continue
                task_info = get_today_task_for_user(user, db)
                if not task_info:
                    continue  # between weeks: the journal is locked, nothing to record

                streak = _streak_at_risk(db, user.id, now_local)
                if send_evening_email(recipient, user.name, task_info["task_title"], streak=streak, streak_at_risk=streak > 0):
                    user.last_journal_reminder_date = today
                    db.commit()

            except Exception as e:
                logger.error(f"[Reminders] failed for user {user.id}: {e}")
                db.rollback()
    finally:
        db.close()


# ╔══════════════════════════════════════════════════════════════╗
# ║  "Your review is in" — the evening a week's review is ready  ║
# ╚══════════════════════════════════════════════════════════════╝

def _review_headline(report: dict) -> str:
    """The same one-line summary the dashboard opens with."""
    from datetime import date as _d
    if report.get("quiet_week"):
        return "This week went quiet."
    days = [d for d in (report.get("days") or []) if isinstance(d, dict)]
    done = report.get("days_done") or 0
    total = report.get("past_days_count") or len(days) or 7
    noted = [d for d in days if d.get("has_journal") and isinstance(d.get("score"), (int, float))]
    best = max(noted, key=lambda d: d["score"]) if noted else None
    line = f"{done} of {total} days."
    if best and best.get("date"):
        try:
            line += f" {_d.fromisoformat(best['date']).strftime('%A')} was the high point."
        except ValueError:
            pass
    return line


def build_review_email(user_name: str, report: dict, week_number: int, week_start: str, week_end: str, has_next_plan: bool = False) -> Tuple[str, str, str]:
    """
    The announcement, not the review: the headline, the badge, three numbers,
    one of their own lines, and the door. Everything else is in the app.
    Returns (subject, preheader, card rows).
    """
    from datetime import date as _d
    name = (user_name or "there").split()[0]
    quiet = bool(report.get("quiet_week"))
    badge = (report.get("week_badge") or {}).get("name") if isinstance(report.get("week_badge"), dict) else ""
    headline = _review_headline(report)
    try:
        span = f"{_d.fromisoformat(week_start).strftime('%-d %b')} &ndash; {_d.fromisoformat(week_end).strftime('%-d %b')}"
    except (ValueError, TypeError):
        span = ""
    cs = report.get("consistency_score") or 0
    done = report.get("days_done") or 0
    total = report.get("past_days_count") or 7
    avg = report.get("avg_score") or 0
    quote = (report.get("best_quote") or "").strip() if not quiet else ""
    insight = bool((report.get("hidden_insight") or "").strip()) and not quiet

    # The notification line: a reason to look, with the badge as the tag.
    if quiet:
        subject = f"Week {week_number} went quiet — your review is in"
    elif insight:
        subject = f"{name}, your week had a pattern" + (f" · {badge}" if badge else "")
    elif badge:
        subject = f"Week {week_number}: {badge}. Here's why."
    else:
        subject = f"Your Week {week_number} review is in"
    preheader = headline

    kpi = "".join(
        f'<td width="33%" style="padding:12px 10px;border:1px solid {BORDER};border-radius:12px;background:{PANEL};text-align:center;">'
        f'<p style="margin:0 0 4px;color:{SUB};font-size:10px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;font-family:{FONT};">{k}</p>'
        f'<p style="margin:0;color:{INK};font-size:22px;font-weight:800;letter-spacing:-0.02em;font-family:{FONT};">{v}</p></td>'
        for k, v in (("Consistency", f"{cs}%"), ("Days done", f"{done}/{total}"), ("Avg mood", f"{avg}/10"))
    )

    rows = f"""
        <tr><td class="px" style="padding:30px 36px 22px;border-bottom:1px solid {BORDER};">
          {_eyebrow(f'Week {week_number} review' + (f' &middot; {span}' if span else ''))}
          <h1 class="h1" style="color:{INK};font-size:28px;font-weight:800;margin:0 0 10px;line-height:1.15;letter-spacing:-0.02em;font-family:{FONT};">{_esc(headline)}</h1>
          {f'<span style="display:inline-block;padding:5px 11px;border:1.5px solid {ACCENT};border-radius:6px;color:{ACCENT};font-size:10.5px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;font-family:{FONT};">&#9733; {_esc(badge)}</span>' if badge else ''}
        </td></tr>
        <tr><td class="px" style="padding:20px 36px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="6"><tr>{kpi}</tr></table>
        </td></tr>"""

    if quiet:
        rows += f"""
        <tr><td class="px" style="padding:18px 36px 0;">
          <p style="color:{SUB};font-size:14.5px;margin:0;line-height:1.7;font-family:{FONT};">No notes, no ticked days. That&#8217;s data, {_esc(name)}, not a verdict &#8212; the review says so, and the next week starts from the same place, not further on.</p>
        </td></tr>"""
    else:
        if quote:
            rows += f"""
        <tr><td class="px" style="padding:20px 36px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="border-left:3px solid {INK};padding:4px 0 4px 16px;">
              <p style="color:{INK};font-size:15.5px;font-style:italic;line-height:1.7;margin:0 0 6px;font-family:{SERIF};">&#8220;{_esc(quote)}&#8221;</p>
              <p style="color:{MUTED};font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.14em;margin:0;font-family:{FONT};">You, this week</p>
            </td></tr>
          </table>
        </td></tr>"""
        rows += f"""
        <tr><td class="px" style="padding:18px 36px 0;">
          <p style="color:{SUB};font-size:14.5px;margin:0;line-height:1.7;font-family:{FONT};">Your mentor read every note from the week and wrote it up day by day{' &#8212; including one pattern you probably haven&#8217;t noticed' if insight else ''}. It&#8217;s in the app, in full.</p>
        </td></tr>"""

    next_line = ""
    if not has_next_plan:
        next_line = (f'<p style="margin:14px 0 0;color:{MUTED};font-size:12.5px;line-height:1.6;font-family:{FONT};">'
                     f'Week {week_number + 1} gets built from this review &#8212; plan it when you&#8217;re ready.</p>')
    rows += f"""
        <tr><td class="px" style="padding:26px 36px 32px;text-align:center;">
          {_btn_dark(f'Read your Week {week_number} review &#8594;', APP_URL + '/app?open=archive')}
          {next_line}
        </td></tr>"""
    return subject, preheader, rows


def send_week_review_email(to_email: str, user_name: str, report: dict, week_number: int, week_start: str, week_end: str, has_next_plan: bool = False) -> bool:
    if not resend.api_key:
        logger.error("RESEND_API_KEY not set.")
        return False
    subject, preheader, rows = build_review_email(user_name, report, week_number, week_start, week_end, has_next_plan)
    html = _shell(preheader, rows, manage_label="Manage alerts")
    try:
        resend.Emails.send({
            "from": f"Feelivate <{FROM_EMAIL}>",
            "to": [to_email],
            "subject": subject,
            "html": html,
        })
        logger.info(f"[Review] sent Week {week_number} to {_mask_email(to_email)}")
        return True
    except Exception as e:
        logger.error(f"[Review] send failed for {_mask_email(to_email)}: {type(e).__name__}: {e}")
        return False


def _review_keys(user) -> list:
    return [k for k in (user.last_review_email_key or "").split(",") if k]


def run_week_review_emails(now_utc: Optional[datetime] = None):
    """Called every minute by APScheduler.

    At REVIEW_EMAIL_TIME in each user's own timezone: for every goal whose
    locked week has ended, make sure its review exists (the same code path
    the Journey page uses — generated once, then cached) and announce it. A
    week ending Sunday is announced Sunday night if Sunday's note is in, else
    Monday night once the week is over. Each week is announced once; the
    last few announced weeks are kept on the user row.
    """
    from .database import SessionLocal
    from .models import Session as SessionModel, User
    from .weeks import _week_bounds_for
    from datetime import date as _d

    now_utc = now_utc or datetime.now(pytz.utc)
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.email_notifications_enabled == 1).all()
        for user in users:
            try:
                tz_str = user.preferred_notification_timezone or "UTC"
                try:
                    user_tz = pytz.timezone(tz_str)
                except Exception:
                    user_tz = pytz.utc
                now_local = now_utc.astimezone(user_tz)
                since = _minutes_since(now_local, REVIEW_EMAIL_TIME)
                if since is None or not (0 <= since < SEND_GRACE_MINUTES):
                    continue
                recipient = _recipient_for(user)
                if not recipient:
                    continue
                today = now_local.date()
                today_iso = today.isoformat()
                sent_keys = _review_keys(user)

                sessions = (
                    db.query(SessionModel)
                    .filter(
                        SessionModel.user_id == user.id,
                        SessionModel.is_completed == 0,
                        SessionModel.phase.in_(("active", "planning")),
                        SessionModel.plan_start_date.isnot(None),
                    )
                    .order_by(SessionModel.created_at.desc())
                    .all()
                )
                announced = False
                for session in sessions:
                    cur = session.current_week if session.current_week is not None else 1
                    for wk in sorted({cur, cur - 1}, reverse=True):
                        if wk < 0:
                            continue
                        try:
                            ws, we, _n = _week_bounds_for(session, wk)
                        except Exception:
                            continue
                        if we > today_iso:
                            continue  # still running
                        if (today - _d.fromisoformat(we)).days > REVIEW_EMAIL_MAX_AGE_DAYS:
                            continue  # old news
                        key = f"{session.id}:{ws}"
                        if key in sent_keys:
                            continue

                        from .main import get_weekly_report
                        res = asyncio.run(get_weekly_report(
                            user_id=user.id, session_id=session.id, week_number=wk,
                            force_refresh=False, client_date=today_iso, db=db, current_user=user,
                        ))
                        report = res.get("report") if isinstance(res, dict) else None
                        if res.get("status") not in ("generated", "cached") or not report:
                            continue  # not complete yet (Sunday's note still possible) → tomorrow
                        has_next = (session.current_week or 0) > wk
                        if send_week_review_email(recipient, user.name, report, wk, ws, we, has_next_plan=has_next):
                            sent_keys = (sent_keys + [key])[-12:]
                            user.last_review_email_key = ",".join(sent_keys)
                            db.commit()
                            announced = True
                            break
                    if announced:
                        break  # one announcement per evening
            except Exception as e:
                logger.error(f"[Review] failed for user {user.id}: {e}")
                db.rollback()
    finally:
        db.close()


# Send windows are a few minutes wide rather than one exact minute. The
# scheduler ticks once a minute, and a deploy, restart or slow tick landing on
# a user's chosen minute used to skip that user for the whole day — there was
# no catch-up. The per-day "already sent" markers stop a wider window from
# sending twice.
SEND_GRACE_MINUTES = int(os.getenv("EMAIL_SEND_GRACE_MINUTES", "10"))


def _minutes_since(now_local, hhmm):
    """Minutes elapsed since HH:MM today in now_local's zone; None if malformed."""
    try:
        hh, mm = (int(x) for x in (hhmm or "").split(":"))
        target = now_local.replace(hour=hh, minute=mm, second=0, microsecond=0)
    except (ValueError, TypeError, AttributeError):
        return None
    return (now_local - target).total_seconds() / 60.0


def _morning_context(db, user, task_info: dict, now_local):
    """
    (yesterday, streak, week_dots) for the morning note.

    yesterday — that day's voice journal as a dict (complete transcript),
    or a journal-less stub carrying its check-in status; None on the first
    day of the week. streak — the current run. week_dots — one (letter,
    status) per day of the week: done / shielded / missed / today / upcoming.
    """
    from datetime import date as _d
    from .models import DailyCheckin, UserStreak, VoiceJournal

    today = now_local.date()
    ws, we = task_info.get("week_start"), task_info.get("week_end")
    sid = task_info.get("session_id")

    yesterday = None
    y_iso = (today - timedelta(days=1)).isoformat()
    if not ws or y_iso >= ws:
        jq = db.query(VoiceJournal).filter(VoiceJournal.user_id == user.id, VoiceJournal.date == y_iso)
        if sid:
            jq = jq.filter(VoiceJournal.session_id == sid)
        j = jq.first()
        y_check = db.query(DailyCheckin).filter(DailyCheckin.user_id == user.id, DailyCheckin.date == y_iso).first()
        yesterday = {
            "date": y_iso,
            "weekday_label": (today - timedelta(days=1)).strftime("%A"),
            "transcript": (j.transcript or "") if j else "",
            "emotion_label": j.emotion_label if j else None,
            "emotion_score": j.emotion_score if j else None,
            "one_liner": j.one_liner if j else None,
            "checkin": (y_check.status if y_check else None) if not j else "done",
        }

    streak_row = db.query(UserStreak).filter(UserStreak.user_id == user.id).first()
    streak_n = int(streak_row.current_streak or 0) if streak_row else 0

    week_dots = None
    if ws and we:
        try:
            d0, d1 = _d.fromisoformat(ws), _d.fromisoformat(we)
            rows = db.query(DailyCheckin).filter(DailyCheckin.user_id == user.id, DailyCheckin.date >= ws, DailyCheckin.date <= we).all()
            status_of = {r.date: r.status for r in rows}
            dots = []
            for i in range((d1 - d0).days + 1):
                day = d0 + timedelta(days=i)
                iso = day.isoformat()
                if iso == today.isoformat():
                    st = "today"
                elif day > today:
                    st = "upcoming"
                elif status_of.get(iso) in ("done", "shielded"):
                    st = status_of[iso]
                else:
                    st = "missed"
                dots.append((day.strftime("%a")[0], st))
            week_dots = dots
        except Exception:
            week_dots = None
    return yesterday, streak_n, week_dots


def run_daily_email_scheduler():
    """
    Called every minute by APScheduler.

    TIMEZONE-AWARE: For each subscribed user, checks the current time
    in THEIR OWN timezone (preferred_notification_timezone). Sends email
    if HH:MM in their local timezone matches preferred_notification_time.

    Works for users worldwide — India, Europe, US, anywhere.
    """
    from .database import SessionLocal
    from .models import User

    now_utc = datetime.now(pytz.utc)

    db = SessionLocal()
    try:
        # Fetch ALL notification-enabled users (we check per-user timezone below)
        users = (
            db.query(User)
            .filter(
                User.email_notifications_enabled == 1,
                User.preferred_notification_time.isnot(None),
            )
            .all()
        )

        if not users:
            return

        sent_count = 0
        for user in users:
            try:
                # Resolve user's timezone (neutral fallback: UTC, not India)
                tz_str = user.preferred_notification_timezone or "UTC"
                try:
                    user_tz = pytz.timezone(tz_str)
                except Exception:
                    user_tz = pytz.utc
                    tz_str = "UTC"

                # Current HH:MM in user's local timezone
                now_local      = now_utc.astimezone(user_tz)
                user_time_str  = now_local.strftime("%H:%M")
                today_date_str = now_local.strftime("%Y-%m-%d")

                # Inside the send window for their chosen time? (See
                # SEND_GRACE_MINUTES — an exact-minute match was fragile.)
                since = _minutes_since(now_local, user.preferred_notification_time)
                if since is None or not (0 <= since < SEND_GRACE_MINUTES):
                    continue

                recipient = _recipient_for(user)
                if not recipient:
                    continue

                # Already sent today (in user's local date)?
                if user.last_daily_email_date == today_date_str:
                    logger.info(f"[Scheduler] Already sent today ({today_date_str}) to {_mask_email(recipient)}")
                    continue

                logger.info(
                    f"[Scheduler] Sending to {_mask_email(recipient)} "
                    f"at {user_time_str} {tz_str}"
                )

                # A locked week that hasn't started yet: a short build-up note
                # in place of a task, on the last few days before the start.
                countdown = get_countdown_for_user(user, db, today_date_str)
                if countdown:
                    note, cd_session = countdown
                    if send_countdown_email(
                        to_email=recipient,
                        user_name=user.name or "there",
                        note=note,
                        start_iso=cd_session.plan_starts_on,
                        week_number=cd_session.current_week or 1,
                        session_focus=cd_session.focus or "",
                        user_timezone=tz_str,
                    ):
                        user.last_daily_email_date = today_date_str
                        db.commit()
                        sent_count += 1
                    continue

                task_info = get_today_task_for_user(user, db)
                if not task_info:
                    continue  # week finished, not started, or no active plan

                # ── Accountability layer ─────────────────────────────────────
                # 1) Shield first: a miss that can be covered is covered
                #    silently, and the daily email carries the shield note.
                # 2) No shield + real miss → the RECOVERY email replaces the
                #    normal one ("don't miss twice", their own why quoted back).
                from .streaks import apply_streak_shield, yesterday_missed

                shield_info = apply_streak_shield(db, user, today_date_str)
                shield_note = ""
                if shield_info:
                    _dw = "day" if shield_info["streak"] == 1 else "days"
                    _sl = shield_info["shields_left"]
                    shield_note = (
                        f"Yesterday slipped — your streak shield covered it, automatically. "
                        f"{shield_info['streak']} {_dw} safe, {_sl} shield{'s' if _sl != 1 else ''} left in the bank"
                        f"{' — a 7-day run earns you another' if _sl < 2 else ''}. "
                        f"Today's the day that matters."
                    )

                checkin_url = ""
                rating_urls = None
                if API_BASE_URL:
                    try:
                        from .security import create_email_action_token
                        _tok = create_email_action_token(user.id, "checkin", today_date_str)
                        checkin_url = f"{API_BASE_URL}/checkin/email?token={_tok}"
                        _rtok = create_email_action_token(user.id, "task_rating", today_date_str)
                        rating_urls = (
                            f"{API_BASE_URL}/feedback/email?token={_rtok}&clear=yes",
                            f"{API_BASE_URL}/feedback/email?token={_rtok}&clear=no",
                        )
                    except Exception as _tok_err:
                        logger.warning(f"[Scheduler] one-tap token failed (non-fatal): {_tok_err}")

                if (
                    not shield_info
                    and yesterday_missed(db, user.id, today_date_str)
                    and user.last_recovery_email_date != today_date_str
                ):
                    success = send_recovery_email(
                        to_email=recipient,
                        user_name=user.name or "there",
                        task_title=task_info["task_title"],
                        commitment_why=task_info.get("commitment_why", ""),
                        checkin_url=checkin_url,
                    )
                    if success:
                        user.last_recovery_email_date = today_date_str
                        user.last_daily_email_date = today_date_str
                        db.commit()
                        sent_count += 1
                    continue

                # ── Last night, the streak, and the week so far ──────────────
                # The morning note replies to yesterday's voice journal and
                # shows the week as it stands; both come from this user's
                # own rows, nothing is written for them.
                yesterday, streak_n, week_dots = _morning_context(db, user, task_info, now_local)

                success = send_daily_task_email(
                    to_email=recipient,
                    user_name=user.name or "there",
                    day_label=task_info["day_label"],
                    task_title=task_info["task_title"],
                    task_description=task_info["task_description"],
                    week_number=task_info["week_number"],
                    week_label=task_info.get("week_label", ""),
                    session_focus=task_info["session_focus"],
                    week_theme=task_info["week_theme"],
                    user_timezone=tz_str,
                    checkin_url=checkin_url,
                    shield_note=shield_note,
                    rating_urls=rating_urls,
                    reply_to=FEEDBACK_REPLY_TO,
                    day_index=task_info.get("day_index"),
                    day_count=task_info.get("day_count"),
                    week_dots=week_dots,
                    streak=streak_n,
                    yesterday=yesterday,
                )

                if success:
                    user.last_daily_email_date = today_date_str
                    db.commit()
                    sent_count += 1

            except Exception as user_err:
                logger.error(f"[Scheduler] Error for user {user.id}: {user_err}")
                continue

        if sent_count:
            logger.info(f"[Scheduler] Done — {sent_count} email(s) sent this minute")

    except Exception as e:
        logger.error(f"[Scheduler] Fatal error: {e}")
    finally:
        db.close()
