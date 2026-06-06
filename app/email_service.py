"""
email_service.py — Feelivate Email Service
- OTP verification emails
- AI-generated personalized daily task emails (premium startup quality)
- Daily scheduler (runs every minute, sends at user's preferred time IST)
"""

import os
import json
import random
import string
from datetime import datetime, timedelta
import pytz

import resend
from loguru import logger

# ── Resend init ──────────────────────────────────────────────────────────────
resend.api_key = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "onboarding@resend.dev")
APP_URL = os.getenv("APP_URL", "https://emotion-time-travel-brlz.vercel.app")
IST = pytz.timezone("Asia/Kolkata")

# Day index → label
DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


# ── Logo SVG (inline, works in all email clients) ────────────────────────────
LOGO_BLOCK = """
<table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
  <tr>
    <td style="background:#ffffff;border-radius:14px;padding:10px 16px;box-shadow:0 1px 4px rgba(0,0,0,0.25);">
      <span style="font-size:18px;font-weight:800;color:#09090b;letter-spacing:-0.5px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
        ✦ Feelivate
      </span>
    </td>
  </tr>
</table>
"""


# ── OTP Verification Email ────────────────────────────────────────────────────
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

      <!-- Logo -->
      <tr><td align="center" style="padding-bottom:24px;">{LOGO_BLOCK}</td></tr>

      <!-- Card -->
      <tr><td style="background:#13131a;border:1px solid rgba(168,85,247,0.15);border-radius:20px;overflow:hidden;">

        <!-- Purple top bar -->
        <tr><td style="background:linear-gradient(135deg,#2d1060,#1a0a2e);padding:28px 36px 24px;">
          <p style="color:#c084fc;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px;">Email Verification</p>
          <h1 style="color:#f4f4f5;font-size:22px;font-weight:700;margin:0;line-height:1.3;">Your verification code 🔐</h1>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 36px;">
          <p style="color:#a1a1aa;font-size:15px;margin:0 0 8px;">Hey <strong style="color:#e4e4e7;">{user_name}</strong>,</p>
          <p style="color:#71717a;font-size:14px;margin:0 0 28px;line-height:1.7;">
            You're one step away from receiving your daily personalized task emails from Feelivate.
            Enter the code below to activate your daily alerts.
          </p>

          <!-- OTP Box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="background:#09090b;border:1px solid #3f3f46;border-radius:14px;padding:28px;text-align:center;">
              <p style="color:#52525b;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 14px;">One-time code</p>
              <p style="color:#c084fc;font-size:44px;font-weight:800;letter-spacing:14px;margin:0;font-family:'Courier New',Courier,monospace;">{otp}</p>
            </td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.12);border-radius:10px;padding:14px 18px;margin-bottom:24px;">
            <tr>
              <td style="color:#a1a1aa;font-size:13px;">⏱ Expires in <strong style="color:#c084fc;">10 minutes</strong></td>
              <td align="right" style="color:#52525b;font-size:12px;">Single use only</td>
            </tr>
          </table>

          <p style="color:#3f3f46;font-size:12px;margin:0;">If you didn't request this, you can safely ignore this email.</p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="border-top:1px solid #1f1f2e;padding:18px 36px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color:#3f3f46;font-size:11px;">© 2026 Feelivate</td>
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
        logger.info(f"OTP email sent → {to_email} | id={res}")
        return True
    except Exception as e:
        logger.error(f"OTP email failed → {to_email}: {type(e).__name__}: {e}")
        return False


# ── AI Daily Email ────────────────────────────────────────────────────────────
def generate_ai_daily_content(
    user_name: str,
    day_label: str,
    task_title: str,
    task_description: str,
    session_focus: str,
) -> dict:
    """
    Use LLM to generate:
      - how_to: 2-3 bullet tips for today's task
      - what_not_to_do: 1-2 bullet warnings
      - motivational_thought: 2-3 sentence personal thought
    Returns a dict with these keys.
    """
    try:
        from .llm import call_llm
        prompt = f"""You are a world-class behavioural coach writing a personal daily email to {user_name}.

User's transformation goal: {session_focus}
Today ({day_label})'s task: {task_title}
Task details: {task_description}

Write a JSON object with exactly these 3 keys:
{{
  "how_to": "2-3 concise, actionable bullet tips (use • separator) on HOW to do this task well. Be specific, not generic.",
  "what_not_to_do": "1-2 bullet warnings (use • separator) on what mistakes to avoid today. Be direct.",
  "motivational_thought": "2-3 sentences of a deeply personal, warm motivational thought written ONLY for {user_name} about their journey. Make it feel handwritten, not generic. Reference their goal subtly."
}}

Respond ONLY with valid JSON. No markdown fences. No extra text."""

        raw = call_llm(prompt, temperature=0.85, max_tokens=400)
        import re
        raw = re.sub(r'```(?:json)?\s*', '', raw).replace('```', '').strip()
        start = raw.find("{")
        end = raw.rfind("}") + 1
        return json.loads(raw[start:end])
    except Exception as e:
        logger.warning(f"AI content generation failed, using fallback: {e}")
        return {
            "how_to": f"• Start with a 5-minute intention-setting ritual for this task\n• Break it into smaller micro-steps\n• Track your progress at the end of the day",
            "what_not_to_do": f"• Don't skip this — consistency is your superpower\n• Avoid multitasking while doing this task",
            "motivational_thought": f"Every small step you take today is building the person you want to become. {user_name}, you've already made the decision to change — now all you have to do is show up. One day at a time.",
        }


def send_daily_task_email(
    to_email: str,
    user_name: str,
    day_label: str,
    task_title: str,
    task_description: str,
    week_number: int,
    session_focus: str,
    week_theme: str = "",
) -> bool:
    if not resend.api_key:
        logger.error("RESEND_API_KEY not set.")
        return False

    today_str = datetime.now(IST).strftime("%A, %B %d, %Y")
    ai = generate_ai_daily_content(user_name, day_label, task_title, task_description, session_focus)

    how_to_html = "".join(
        f'<p style="color:#d4d4d8;font-size:14px;margin:0 0 8px;line-height:1.6;">'
        f'<span style="color:#a855f7;font-weight:700;">→</span> {line.lstrip("•").strip()}</p>'
        for line in ai["how_to"].split("•") if line.strip()
    )
    avoid_html = "".join(
        f'<p style="color:#fca5a5;font-size:13px;margin:0 0 6px;line-height:1.6;">'
        f'<span style="color:#f87171;">✗</span> {line.lstrip("•").strip()}</p>'
        for line in ai["what_not_to_do"].split("•") if line.strip()
    )

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

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1a0a2e 0%,#0f0f1a 100%);padding:28px 36px 24px;border-bottom:1px solid rgba(168,85,247,0.1);">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <p style="color:#7c3aed;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 6px;">Week {week_number} · Daily Mission</p>
                <h1 style="color:#f4f4f5;font-size:24px;font-weight:800;margin:0;line-height:1.2;">{day_label} 🎯</h1>
                <p style="color:#52525b;font-size:12px;margin:6px 0 0;">{today_str}</p>
              </td>
              <td align="right" valign="top">
                <span style="background:rgba(168,85,247,0.15);border:1px solid rgba(168,85,247,0.3);color:#c084fc;font-size:11px;font-weight:600;padding:5px 12px;border-radius:20px;white-space:nowrap;">Daily Alert</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:28px 36px 0;">
          <p style="color:#a1a1aa;font-size:15px;margin:0 0 4px;">Good morning, <strong style="color:#e4e4e7;">{user_name}</strong> 👋</p>
          <p style="color:#52525b;font-size:13px;margin:0;">Your future self sent you today's mission. Let's make it count.</p>
        </td></tr>

        <!-- Task Card -->
        <tr><td style="padding:20px 36px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,rgba(109,40,217,0.12),rgba(99,102,241,0.06));border:1px solid rgba(168,85,247,0.2);border-radius:14px;overflow:hidden;">
            <tr><td style="padding:6px 18px;background:rgba(168,85,247,0.12);">
              <p style="color:#c084fc;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin:0;">Today's Task</p>
            </td></tr>
            <tr><td style="padding:16px 18px 18px;">
              <p style="color:#f4f4f5;font-size:17px;font-weight:700;margin:0 0 8px;line-height:1.4;">{task_title}</p>
              <p style="color:#a1a1aa;font-size:13px;margin:0;line-height:1.7;">{task_description}</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- How To -->
        <tr><td style="padding:0 36px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f1a;border:1px solid #1f1f2e;border-radius:12px;padding:18px 20px;">
            <tr><td>
              <p style="color:#7c3aed;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 14px;">💡 How to do it well</p>
              {how_to_html}
            </td></tr>
          </table>
        </td></tr>

        <!-- Avoid -->
        <tr><td style="padding:0 36px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(239,68,68,0.04);border:1px solid rgba(239,68,68,0.12);border-radius:12px;padding:16px 20px;">
            <tr><td>
              <p style="color:#f87171;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 10px;">⚠️ Avoid today</p>
              {avoid_html}
            </td></tr>
          </table>
        </td></tr>

        <!-- Motivational Thought -->
        <tr><td style="padding:0 36px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,rgba(168,85,247,0.08),rgba(99,102,241,0.04));border-left:3px solid #7c3aed;border-radius:0 12px 12px 0;padding:18px 22px;">
            <tr><td>
              <p style="color:#7c3aed;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin:0 0 10px;">✦ Just for you, {user_name}</p>
              <p style="color:#c4b5fd;font-size:14px;font-style:italic;line-height:1.8;margin:0;">"{ai["motivational_thought"]}"</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:0 36px 32px;text-align:center;">
          <a href="{APP_URL}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6366f1);color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 36px;border-radius:12px;letter-spacing:0.3px;">
            Open Feelivate &rarr;
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="border-top:1px solid #1f1f2e;padding:18px 36px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color:#3f3f46;font-size:11px;">© 2026 Feelivate · Behavioral Architecture Engine</td>
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
            "subject": f"🎯 {day_label}'s Mission: {task_title[:55]}{'...' if len(task_title) > 55 else ''}",
            "html": html,
        })
        logger.info(f"Daily email sent → {to_email} ({day_label}) | id={res}")
        return True
    except Exception as e:
        logger.error(f"Daily email failed → {to_email}: {type(e).__name__}: {e}")
        return False


# ── Scheduler: send daily emails at user's preferred time ────────────────────
def get_today_task_for_user(user, db):
    """
    Find the user's active session, parse today's task from the week plan.
    Returns dict with task_title, task_description, week_number, session_focus, week_theme or None.
    """
    try:
        from .models import Session as SessionModel
        # Get the most recent active session with an approved plan
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

        now_ist = datetime.now(IST)
        today_idx = now_ist.weekday()
        today_day_name = now_ist.strftime("%A").lower() # e.g. "thursday"
        today_short = now_ist.strftime("%a").lower()    # e.g. "thu"

        # Try to find the task by matching the day name string
        day_entry = None
        for d in days:
            day_str = str(d.get("day", "")).lower()
            if today_day_name in day_str or today_short in day_str:
                day_entry = d
                break

        # Fallback to index mapping if text match fails (only safe for full 7-day plans)
        if not day_entry:
            if len(days) == 7 and today_idx < len(days):
                day_entry = days[today_idx]
            else:
                logger.warning(f"Could not reliably find a task for {today_day_name} in user {user.id}'s plan.")
                return None

        task_title = day_entry.get("action") or day_entry.get("title") or "Today's Task"
        task_desc = day_entry.get("description") or day_entry.get("details") or ""

        return {
            "task_title": task_title,
            "task_description": task_desc,
            "week_number": session.current_week or 1,
            "session_focus": session.focus or "personal transformation",
            "week_theme": plan.get("theme") or plan.get("week_label") or "",
            "day_label": DAY_LABELS[today_idx],
        }
    except Exception as e:
        logger.error(f"get_today_task_for_user failed for user {user.id}: {e}")
        return None


def run_daily_email_scheduler():
    """
    Called every minute by APScheduler.
    Sends daily task email to users whose preferred_notification_time matches current IST time
    and who haven't received today's email yet.
    """
    from .database import SessionLocal
    from .models import User

    now_ist = datetime.now(IST)
    current_time_str = now_ist.strftime("%H:%M")
    today_date_str = now_ist.strftime("%Y-%m-%d")

    db = SessionLocal()
    try:
        # Get all users with notifications enabled whose time matches now
        users = (
            db.query(User)
            .filter(
                User.email_notifications_enabled == 1,
                User.notification_email.isnot(None),
                User.preferred_notification_time == current_time_str,
            )
            .all()
        )

        if not users:
            return

        logger.info(f"[Scheduler] {current_time_str} IST — {len(users)} user(s) to email")

        for user in users:
            # Skip if already sent today
            if user.last_daily_email_date == today_date_str:
                logger.info(f"[Scheduler] Already sent today to {user.notification_email}, skipping")
                continue

            task_info = get_today_task_for_user(user, db)
            if not task_info:
                logger.warning(f"[Scheduler] No active plan for user {user.id}, skipping")
                continue

            success = send_daily_task_email(
                to_email=user.notification_email,
                user_name=user.name or "there",
                day_label=task_info["day_label"],
                task_title=task_info["task_title"],
                task_description=task_info["task_description"],
                week_number=task_info["week_number"],
                session_focus=task_info["session_focus"],
                week_theme=task_info["week_theme"],
            )

            if success:
                user.last_daily_email_date = today_date_str
                db.commit()

    except Exception as e:
        logger.error(f"[Scheduler] Error: {e}")
    finally:
        db.close()
