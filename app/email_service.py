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


# ── Feelivate Logo Block (inline, white rounded square) ──────────────────────
LOGO_BLOCK = f"""
<table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
  <tr>
    <td style="background:#ffffff;border-radius:14px;padding:10px 18px;box-shadow:0 1px 6px rgba(0,0,0,0.3);">
      <span style="font-size:18px;font-weight:800;color:#09090b;letter-spacing:-0.5px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
        <img src="{APP_URL}/logo_2_backup.png" alt="" style="width:20px;height:20px;vertical-align:middle;margin-right:6px;margin-top:-2px;" />Feelivate
      </span>
    </td>
  </tr>
</table>
"""


# ╔══════════════════════════════════════════════════════════════╗
# ║  OTP Verification Email                                      ║
# ╚══════════════════════════════════════════════════════════════╝

def send_verification_email(to_email: str, otp: str, user_name: str = "there") -> bool:
    if not resend.api_key:
        logger.error("RESEND_API_KEY not set.")
        return False

    html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:48px 20px;">
  <tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;">
      <tr><td align="center" style="padding-bottom:24px;">{LOGO_BLOCK}</td></tr>
      <tr><td style="background:#13131a;border:1px solid rgba(168,85,247,0.15);border-radius:20px;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#2d1060,#1a0a2e);padding:28px 36px 24px;">
          <p style="color:#c084fc;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px;">Email Verification</p>
          <h1 style="color:#f4f4f5;font-size:22px;font-weight:700;margin:0;line-height:1.3;">Your verification code &#128272;</h1>
        </td></tr>
        <tr><td style="padding:32px 36px;">
          <p style="color:#a1a1aa;font-size:15px;margin:0 0 8px;">Hey <strong style="color:#e4e4e7;">{user_name}</strong>,</p>
          <p style="color:#71717a;font-size:14px;margin:0 0 28px;line-height:1.7;">
            You&#39;re one step away from receiving daily personalized task emails from Feelivate.
            Enter the code below to activate your daily alerts.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="background:#09090b;border:1px solid #3f3f46;border-radius:14px;padding:28px;text-align:center;">
              <p style="color:#52525b;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 14px;">One-time code</p>
              <p style="color:#c084fc;font-size:44px;font-weight:800;letter-spacing:14px;margin:0;font-family:'Courier New',Courier,monospace;">{otp}</p>
            </td></tr>
          </table>
          <p style="color:#3f3f46;font-size:12px;margin:0;line-height:1.6;">
            Expires in <strong style="color:#71717a;">10 minutes</strong> &middot; Single use only.
            If you didn&#39;t request this, you can safely ignore this email.
          </p>
        </td></tr>
        <tr><td style="border-top:1px solid #1f1f2e;padding:18px 36px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color:#3f3f46;font-size:11px;">&#169; 2026 Feelivate</td>
              <td align="right" style="color:#3f3f46;font-size:11px;">Behavioral Architecture Engine</td>
            </tr>
          </table>
        </td></tr>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""

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


def _bullets_to_html(text, color="#d4d4d8", icon="→", icon_color="#a855f7", font_size="14px"):
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

    how_to_html = _bullets_to_html(ai["how_to"], "#d4d4d8", "&#8594;", "#a855f7", "14px")
    avoid_html  = _bullets_to_html(ai["what_not_to_do"], "#fca5a5", "&#10007;", "#f87171", "13px")
    week_sub    = week_label if week_label else week_theme

    html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:48px 20px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;">

      <!-- Logo -->
      <tr><td align="center" style="padding-bottom:20px;">{LOGO_BLOCK}</td></tr>

      <!-- Card -->
      <tr><td style="background:#13131a;border:1px solid rgba(168,85,247,0.15);border-radius:20px;overflow:hidden;">

        <!-- ▸ Header: Week N · DayName -->
        <tr><td style="background:linear-gradient(135deg,#1a0a2e 0%,#0f0f1a 100%);padding:28px 36px 22px;border-bottom:1px solid rgba(168,85,247,0.1);">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <p style="color:#7c3aed;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 10px;">&#128236; Daily Alert</p>
                <!-- Big title line: "Week 0 · Thursday" -->
                <h1 style="color:#f4f4f5;font-size:30px;font-weight:800;margin:0 0 4px;line-height:1.1;letter-spacing:-0.5px;">
                  Week {week_number} <span style="color:#7c3aed;">&#183;</span> {day_label}
                </h1>
                <p style="color:#71717a;font-size:12px;margin:6px 0 0;">{today_str}{(' &nbsp;&#183;&nbsp; ' + week_sub) if week_sub else ''}</p>
              </td>
              <td align="right" valign="top">
                <span style="background:rgba(168,85,247,0.15);border:1px solid rgba(168,85,247,0.3);color:#c084fc;font-size:11px;font-weight:600;padding:5px 12px;border-radius:20px;white-space:nowrap;">Daily Alert</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:24px 36px 0;">
          <p style="color:#a1a1aa;font-size:15px;margin:0 0 4px;">Good morning, <strong style="color:#e4e4e7;">{user_name}</strong> &#128075;</p>
          <p style="color:#52525b;font-size:13px;margin:0;">Your future self sent you today&#39;s mission. Let&#39;s make it count.</p>
        </td></tr>

        <!-- Task Card -->
        <tr><td style="padding:18px 36px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,rgba(109,40,217,0.12),rgba(99,102,241,0.06));border:1px solid rgba(168,85,247,0.2);border-radius:14px;overflow:hidden;">
            <tr><td style="padding:6px 18px;background:rgba(168,85,247,0.12);">
              <p style="color:#c084fc;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin:0;">&#127919; Today&#39;s Task</p>
            </td></tr>
            <tr><td style="padding:16px 18px 18px;">
              <p style="color:#f4f4f5;font-size:17px;font-weight:700;margin:0 0 8px;line-height:1.4;">{task_title}</p>
              <p style="color:#a1a1aa;font-size:13px;margin:0;line-height:1.7;">{task_description}</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- How To -->
        <tr><td style="padding:0 36px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f1a;border:1px solid #1f1f2e;border-radius:12px;padding:18px 20px;">
            <tr><td>
              <p style="color:#7c3aed;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 12px;">&#128161; How to do it well</p>
              {how_to_html}
            </td></tr>
          </table>
        </td></tr>

        <!-- Avoid -->
        <tr><td style="padding:0 36px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(239,68,68,0.04);border:1px solid rgba(239,68,68,0.12);border-radius:12px;padding:16px 20px;">
            <tr><td>
              <p style="color:#f87171;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 10px;">&#9888; Avoid today</p>
              {avoid_html}
            </td></tr>
          </table>
        </td></tr>

        <!-- Motivational Thought -->
        <tr><td style="padding:0 36px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,rgba(168,85,247,0.08),rgba(99,102,241,0.04));border-left:3px solid #7c3aed;border-radius:0 12px 12px 0;padding:18px 22px;">
            <tr><td>
              <p style="color:#7c3aed;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin:0 0 10px;">&#10022; Just for you, {user_name}</p>
              <p style="color:#c4b5fd;font-size:14px;font-style:italic;line-height:1.8;margin:0;">&#8220;{ai["motivational_thought"]}&#8221;</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:0 36px 32px;text-align:center;">
          <a href="{APP_URL}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6366f1);color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 36px;border-radius:12px;letter-spacing:0.3px;">
            Open Feelivate &#8594;
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="border-top:1px solid #1f1f2e;padding:18px 36px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color:#3f3f46;font-size:11px;">&#169; 2026 Feelivate &middot; Behavioral Architecture Engine</td>
              <td align="right"><a href="{APP_URL}" style="color:#52525b;font-size:11px;text-decoration:none;">Unsubscribe</a></td>
            </tr>
          </table>
        </td></tr>

      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""

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
        f'<p style="margin:0 0 14px;color:#a1a1aa;font-size:15px;line-height:1.65;">{line}</p>'
        for line in body_lines
    )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:48px 20px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;">

      <tr><td align="center" style="padding-bottom:20px;">{LOGO_BLOCK}</td></tr>

      <tr><td style="background:#13131a;border:1px solid rgba(168,85,247,0.15);border-radius:20px;padding:38px 34px;">

        <p style="margin:0 0 10px;color:{accent};font-size:11px;font-weight:700;
                  letter-spacing:0.14em;text-transform:uppercase;">{eyebrow}</p>

        <h1 style="margin:0 0 18px;color:#fafafa;font-size:23px;line-height:1.25;
                   font-weight:700;letter-spacing:-0.02em;">{heading}</h1>

        {paragraphs}

        <table cellpadding="0" cellspacing="0" style="margin:26px 0 0;">
          <tr><td style="background:{accent};border-radius:100px;">
            <a href="{APP_URL}/app" style="display:inline-block;padding:14px 30px;color:#0a0a0f;
               font-size:13px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;
               text-decoration:none;">{cta_label}</a>
          </td></tr>
        </table>

      </td></tr>

      <tr><td style="padding:22px 8px 0;">
        <p style="margin:0;color:#52525b;font-size:12px;line-height:1.6;">
          {footer_note}
          You can turn these reminders off any time from Alerts in the app.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>"""

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
        accent="#a855f7",
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
        accent="#f59e0b",
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

                if hhmm not in (JOURNAL_REMINDER_TIME, STREAK_REMINDER_TIME):
                    continue
                recipient = _recipient_for(user)
                if not recipient:
                    continue
                if not _has_active_plan(db, user.id):
                    continue

                # ── 20:00 — journal not logged ──
                if hhmm == JOURNAL_REMINDER_TIME:
                    if user.last_journal_reminder_date == today:
                        continue
                    if _has_journal_today(db, user.id, today):
                        continue
                    if send_journal_reminder_email(recipient, user.name):
                        user.last_journal_reminder_date = today
                        db.commit()

                # ── 21:00 — streak alive but today still unchecked ──
                elif hhmm == STREAK_REMINDER_TIME:
                    if user.last_streak_reminder_date == today:
                        continue
                    streak = (
                        db.query(UserStreak)
                        .filter(UserStreak.user_id == user.id)
                        .first()
                    )
                    # Nothing to save if there's no run going, and nothing to
                    # warn about if today is already done — last_checkin would
                    # be today in that case, not yesterday.
                    if not streak or (streak.current_streak or 0) < 1:
                        continue
                    yesterday = (now_local.date() - timedelta(days=1)).isoformat()
                    if streak.last_checkin != yesterday:
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

                # Does it match their preferred time?
                if user_time_str != user.preferred_notification_time:
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
