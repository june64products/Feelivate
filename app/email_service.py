"""
email_service.py — Feelivate Email Service
- OTP verification emails
- AI-generated personalized daily task emails (startup quality design)
- Daily scheduler (APScheduler, every minute, sends at each user's preferred time in THEIR timezone)
"""

import os
import json
import re
import secrets
import string
from datetime import datetime, timedelta
import pytz

import resend
from loguru import logger

# ── Resend init ──────────────────────────────────────────────────────────────
resend.api_key = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "onboarding@resend.dev")
APP_URL = os.getenv("APP_URL", "https://emotion-time-travel-brlz.vercel.app")
# The API's own public URL (Northflank) — one-tap check-in links point HERE,
# not at the frontend. Left empty, emails simply ship without the button.
API_BASE_URL = os.getenv("API_BASE_URL", "").rstrip("/")

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

def _generate_ai_daily_content(user_name, day_label, task_title, task_description, session_focus):
    """Generate personalized AI content: how-to, avoid, motivational thought."""
    try:
        from .llm import call_llm
        prompt = f"""You are a world-class behavioural coach writing a personal daily email to {user_name}.

User's transformation goal: {session_focus}
Today ({day_label})'s task: {task_title}
Task details: {task_description}

Write a JSON object with exactly these 3 keys:
{{
  "how_to": "2-3 concise, actionable bullet tips (use bullet character) on HOW to do this task well. Be specific.",
  "what_not_to_do": "1-2 bullet warnings on what mistakes to avoid today. Be direct.",
  "motivational_thought": "2-3 sentences of a deeply personal, warm motivational thought written ONLY for {user_name}. Make it feel handwritten, not generic."
}}

Respond ONLY with valid JSON. No markdown fences. No extra text."""

        raw = call_llm(prompt, temperature=0.85, max_tokens=400)
        raw = re.sub(r'```(?:json)?\s*', '', raw).replace('```', '').strip()
        start = raw.find("{")
        end = raw.rfind("}") + 1
        return json.loads(raw[start:end])
    except Exception as e:
        logger.warning(f"AI content generation failed, using fallback: {e}")
        return {
            "how_to": (
                f"Start with a 5-minute intention-setting ritual for this task\n"
                f"Break it into smaller micro-steps and tackle one at a time\n"
                f"Track your progress at the end of the day"
            ),
            "what_not_to_do": (
                f"Don't skip this — consistency is your superpower\n"
                f"Avoid multitasking while doing this task"
            ),
            "motivational_thought": (
                f"Every small step you take today is building the person you want to become. "
                f"{user_name}, you've already made the decision to change — now all you have to do is show up. "
                f"One day at a time."
            ),
        }


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
    checkin_url: str = "",   # signed one-tap "Done" link (empty = no button)
    shield_note: str = "",   # set when a streak shield auto-covered yesterday
) -> bool:
    if not resend.api_key:
        logger.error("RESEND_API_KEY not set.")
        return False

    # Date shown in the email = the recipient's local date (not hardcoded IST).
    try:
        _disp_tz = pytz.timezone(user_timezone)
    except Exception:
        _disp_tz = pytz.utc
    today_str = datetime.now(_disp_tz).strftime("%A, %B %d, %Y")
    ai = _generate_ai_daily_content(user_name, day_label, task_title, task_description, session_focus)

    how_to_html = _bullets_to_html(ai["how_to"], SUB, "&#8594;", ACCENT, "14px")
    avoid_html  = _bullets_to_html(ai["what_not_to_do"], "#a3542f", "&#10007;", "#c2410c", "13px")
    week_sub    = week_label if week_label else week_theme

    # Streak shield banner — only when a shield silently covered yesterday.
    shield_html = ""
    if shield_note:
        shield_html = f"""
        <tr><td class="px" style="padding:16px 36px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef4fb;border:1px solid #cfe0f2;border-radius:14px;">
            <tr><td style="padding:14px 18px;">
              <p style="color:#3b6ea5;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 6px;font-family:{FONT};">&#128737;&#65039; Streak shield</p>
              <p style="color:#41597a;font-size:13px;margin:0;line-height:1.6;font-family:{FONT};">{shield_note}</p>
            </td></tr>
          </table>
        </td></tr>"""

    # One-tap check-in — the email IS the daily loop, not just a reminder.
    if checkin_url:
        cta_html = f"""
          {_btn_flame('Mark today done &#10003;', checkin_url)}
          <p style="margin:14px 0 0;font-family:{FONT};"><a href="{APP_URL}/app" style="color:{MUTED};font-size:12.5px;text-decoration:none;">Open Feelivate &#8594;</a></p>"""
    else:
        cta_html = _btn_dark('Open Feelivate &#8594;', APP_URL)

    rows = f"""
        <tr><td class="px" style="padding:30px 36px 22px;border-bottom:1px solid {BORDER};">
          {_eyebrow('Daily brief &middot; ' + today_str)}
          <h1 class="h1" style="color:{INK};font-size:30px;font-weight:800;margin:0;line-height:1.15;letter-spacing:-0.02em;font-family:{FONT};">
            Week {week_number} <span style="color:{ACCENT};">&#183;</span> {day_label}
          </h1>
          {f'<p style="color:{MUTED};font-size:12.5px;margin:8px 0 0;font-family:{FONT};">{week_sub}</p>' if week_sub else ''}
        </td></tr>

        <tr><td class="px" style="padding:22px 36px 0;">
          <p style="color:{SUB};font-size:15px;margin:0;font-family:{FONT};">Good morning, <strong style="color:{INK};">{user_name}</strong> &#8212; one day, one task. Here&#39;s yours.</p>
        </td></tr>
        {shield_html}

        <tr><td class="px" style="padding:18px 36px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{PANEL};border:1px solid {BORDER};border-left:3px solid {ACCENT};border-radius:14px;">
            <tr><td style="padding:18px 20px;">
              <p style="color:{ACCENT};font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.14em;margin:0 0 8px;font-family:{FONT};">Today&#39;s task</p>
              <p style="color:{INK};font-size:17px;font-weight:700;margin:0 0 8px;line-height:1.45;font-family:{FONT};">{task_title}</p>
              <p style="color:{SUB};font-size:13.5px;margin:0;line-height:1.7;font-family:{FONT};">{task_description}</p>
            </td></tr>
          </table>
        </td></tr>

        <tr><td class="px" style="padding:16px 36px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{CARD};border:1px solid {BORDER};border-radius:14px;">
            <tr><td style="padding:18px 20px;">
              <p style="color:{INK};font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 12px;font-family:{FONT};">How to do it well</p>
              {how_to_html}
            </td></tr>
          </table>
        </td></tr>

        <tr><td class="px" style="padding:14px 36px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf1ec;border:1px solid #f3d5c8;border-radius:14px;">
            <tr><td style="padding:16px 20px;">
              <p style="color:#c2410c;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 10px;font-family:{FONT};">Avoid today</p>
              {avoid_html}
            </td></tr>
          </table>
        </td></tr>

        <tr><td class="px" style="padding:18px 36px 0;">
          <p style="color:{INK};font-size:15.5px;font-style:italic;line-height:1.75;margin:0;font-family:{SERIF};">&#8220;{ai["motivational_thought"]}&#8221;</p>
          <p style="color:{MUTED};font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.14em;margin:10px 0 0;font-family:{FONT};">For you, {user_name}</p>
        </td></tr>

        <tr><td class="px" style="padding:26px 36px 32px;text-align:center;">
          {cta_html}
        </td></tr>"""

    html = _shell(f"Week {week_number} · {day_label} — {task_title[:80]}", rows, manage_label="Manage alerts")

    try:
        res = resend.Emails.send({
            "from": f"Feelivate <{FROM_EMAIL}>",
            "to": [to_email],
            # Subject: "Week 0 · Thursday — Your Task Title"
            "subject": f"Week {week_number} \u00b7 {day_label} \u2014 {task_title[:55]}{'...' if len(task_title) > 55 else ''}",
            "html": html,
        })
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

# Local clock times these go out at. Both are checked per user, in that user's
# own timezone, so 20:00 means 20:00 wherever they are.
JOURNAL_REMINDER_TIME = os.getenv("JOURNAL_REMINDER_TIME", "20:00")
STREAK_REMINDER_TIME = os.getenv("STREAK_REMINDER_TIME", "21:00")


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


def send_journal_reminder_email(to_email: str, user_name: str) -> bool:
    """20:00 local — today's voice journal hasn't been recorded."""
    name = (user_name or "there").split()[0]
    return _reminder_email(
        to_email=to_email,
        subject="Your journal is still empty today",
        eyebrow="Evening check-in",
        heading=f"{name}, today hasn't been logged yet",
        body_lines=[
            "You haven't recorded your voice journal today. It takes about a minute — "
            "just say how the day actually went, good or bad.",
            "This is the part that makes next week's plan fit you. Without it your "
            "mentor is guessing.",
        ],
        cta_label="Log today",
        accent=ACCENT,
    )


def send_streak_reminder_email(to_email: str, user_name: str, current_streak: int) -> bool:
    """21:00 local — the streak is alive but today is still unchecked."""
    name = (user_name or "there").split()[0]
    day_word = "day" if current_streak == 1 else "days"
    return _reminder_email(
        to_email=to_email,
        subject=f"Your {current_streak}-{day_word} streak ends at midnight",
        eyebrow="Streak at risk",
        heading=f"{current_streak} {day_word} on the line, {name}",
        body_lines=[
            f"You've shown up {current_streak} {day_word} in a row. Today isn't marked "
            "done yet, and the streak resets at midnight.",
            "A few minutes now keeps it. Open the app, finish today's task and log your "
            "journal.",
        ],
        cta_label="Keep the streak",
        accent="#b45309",
        footer_note="Streaks are a motivational feature, nothing more &mdash; nothing is lost if one breaks. ",
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
    return (
        db.query(SessionModel)
        .filter(SessionModel.user_id == user_id, SessionModel.phase == "active")
        .first()
        is not None
    )


def run_evening_reminders():
    """Called every minute by APScheduler, alongside the daily task email.

    Same timezone handling as the morning email: for each user we ask what time
    it is where THEY are, and match against the reminder times. 20:00 in Delhi
    and 20:00 in Chicago are different UTC instants, and both get hit.

    Only users who enabled email notifications are contacted — that switch is
    the consent record for this channel, so it gates every message here.
    """
    from .database import SessionLocal
    from .models import User, UserStreak

    now_utc = datetime.now(pytz.utc)
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
                hhmm = now_local.strftime("%H:%M")
                today = now_local.strftime("%Y-%m-%d")

                # Same grace window as the daily email; the two reminders are
                # an hour apart, so at most one window is open at a time.
                sj = _minutes_since(now_local, JOURNAL_REMINDER_TIME)
                ss = _minutes_since(now_local, STREAK_REMINDER_TIME)
                in_journal = sj is not None and 0 <= sj < SEND_GRACE_MINUTES
                in_streak = ss is not None and 0 <= ss < SEND_GRACE_MINUTES
                if not (in_journal or in_streak):
                    continue
                recipient = _recipient_for(user)
                if not recipient:
                    continue
                if not _has_active_plan(db, user.id):
                    continue

                # ── 20:00 — journal not logged ──
                if in_journal:
                    if user.last_journal_reminder_date == today:
                        continue
                    if _has_journal_today(db, user.id, today):
                        continue
                    if send_journal_reminder_email(recipient, user.name):
                        user.last_journal_reminder_date = today
                        db.commit()

                # ── 21:00 — streak alive but today still unchecked ──
                elif in_streak:
                    if user.last_streak_reminder_date == today:
                        continue
                    streak = (
                        db.query(UserStreak)
                        .filter(UserStreak.user_id == user.id)
                        .first()
                    )
                    # Nothing to save if there's no run going.
                    if not streak or (streak.current_streak or 0) < 1:
                        continue
                    # Chain must be alive through yesterday — a "shielded"
                    # yesterday counts (that user is exactly the at-risk one:
                    # tonight decides whether they miss twice).
                    from .models import DailyCheckin
                    yesterday = (now_local.date() - timedelta(days=1)).isoformat()
                    chain_yesterday = (
                        db.query(DailyCheckin)
                        .filter(
                            DailyCheckin.user_id == user.id,
                            DailyCheckin.date == yesterday,
                            DailyCheckin.status.in_(("done", "shielded")),
                        )
                        .first()
                    )
                    if not chain_yesterday:
                        continue
                    # Today already done → nothing to warn about.
                    done_today = (
                        db.query(DailyCheckin)
                        .filter(
                            DailyCheckin.user_id == user.id,
                            DailyCheckin.date == today,
                            DailyCheckin.status == "done",
                        )
                        .first()
                    )
                    if done_today:
                        continue
                    if send_streak_reminder_email(
                        recipient, user.name, streak.current_streak
                    ):
                        user.last_streak_reminder_date = today
                        db.commit()

            except Exception as e:
                logger.error(f"[Reminders] failed for user {user.id}: {e}")
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

                task_info = get_today_task_for_user(user, db)
                if not task_info:
                    continue  # week finished or no active plan

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
                if API_BASE_URL:
                    try:
                        from .security import create_email_action_token
                        _tok = create_email_action_token(user.id, "checkin", today_date_str)
                        checkin_url = f"{API_BASE_URL}/checkin/email?token={_tok}"
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
