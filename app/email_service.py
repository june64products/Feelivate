"""
email_service.py - Resend API integration for Feelivate
  1. OTP verification emails
  2. Daily personalized task notification emails
"""

import os
import random
import string
import resend
from loguru import logger

# ── Resend init ────────────────────────────────────────────
resend.api_key = os.getenv("RESEND_API_KEY", "")

# IMPORTANT: Until your domain (feelivate.com) is verified on Resend,
# keep FROM_EMAIL as "onboarding@resend.dev" (Resend's free sender).
# Once Resend shows "Verified" for your domain, change this to "task@feelivate.com".
FROM_EMAIL = os.getenv("FROM_EMAIL", "onboarding@resend.dev")


def generate_otp(length: int = 6) -> str:
    """Generate a 6-digit numeric OTP."""
    return "".join(random.choices(string.digits, k=length))


def send_verification_email(to_email: str, otp: str, user_name: str = "there") -> bool:
    """
    Sends OTP verification email to user via Resend.
    Returns True on success, False on failure.
    """
    if not resend.api_key:
        logger.error("RESEND_API_KEY not set. Cannot send email.")
        return False

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#09090b;font-family:'Inter',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="480" cellpadding="0" cellspacing="0" style="background:#18181b;border-radius:16px;border:1px solid #27272a;overflow:hidden;">
              <!-- Header -->
              <tr>
                <td style="padding:32px 32px 24px;border-bottom:1px solid #27272a;">
                  <span style="font-size:22px;font-weight:700;color:#f4f4f5;letter-spacing:-0.5px;">✦ Feelivate</span>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:32px;">
                  <p style="color:#a1a1aa;font-size:14px;margin:0 0 8px;">Hey {user_name},</p>
                  <h2 style="color:#f4f4f5;font-size:20px;font-weight:600;margin:0 0 16px;line-height:1.4;">
                    Your verification code is here 🔐
                  </h2>
                  <p style="color:#a1a1aa;font-size:14px;margin:0 0 28px;line-height:1.6;">
                    Use the code below to verify your email and start receiving daily task updates from Feelivate.
                  </p>
                  <!-- OTP Box -->
                  <div style="background:#09090b;border:1px solid #3f3f46;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
                    <p style="color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 12px;">Verification Code</p>
                    <p style="color:#c084fc;font-size:40px;font-weight:700;letter-spacing:12px;margin:0;font-family:'Courier New',monospace;">
                      {otp}
                    </p>
                  </div>
                  <p style="color:#52525b;font-size:12px;margin:0;line-height:1.6;">
                    This code expires in <strong style="color:#71717a;">10 minutes</strong>.
                    If you did not request this, please ignore this email.
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding:20px 32px;border-top:1px solid #27272a;">
                  <p style="color:#3f3f46;font-size:11px;margin:0;text-align:center;">
                    © 2026 Feelivate · Behavioral Architecture Engine
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """

    try:
        params = {
            "from": f"Feelivate <{FROM_EMAIL}>",
            "to": [to_email],
            "subject": f"{otp} is your Feelivate verification code",
            "html": html_body,
        }
        response = resend.Emails.send(params)
        logger.info(f"Verification email sent to {to_email}. ID: {response}")
        return True
    except Exception as e:
        logger.error(f"Failed to send verification email to {to_email}: {type(e).__name__}: {e}")
        return False



def generate_otp(length: int = 6) -> str:
    """6-digit numeric OTP generate karta hai."""
    return "".join(random.choices(string.digits, k=length))


def send_verification_email(to_email: str, otp: str, user_name: str = "there") -> bool:
    """
    User ke email par OTP verification email bhejta hai.
    Returns True on success, False on failure.
    """
    if not resend.api_key:
        logger.error("RESEND_API_KEY not set. Cannot send email.")
        return False

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#09090b;font-family:'Inter',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="480" cellpadding="0" cellspacing="0" style="background:#18181b;border-radius:16px;border:1px solid #27272a;overflow:hidden;">
              <!-- Header -->
              <tr>
                <td style="padding:32px 32px 24px;border-bottom:1px solid #27272a;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <span style="font-size:22px;font-weight:700;color:#f4f4f5;letter-spacing:-0.5px;">
                          ✦ Feelivate
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:32px;">
                  <p style="color:#a1a1aa;font-size:14px;margin:0 0 8px;">Hey {user_name},</p>
                  <h2 style="color:#f4f4f5;font-size:20px;font-weight:600;margin:0 0 16px;line-height:1.4;">
                    Your verification code is here 🔐
                  </h2>
                  <p style="color:#a1a1aa;font-size:14px;margin:0 0 28px;line-height:1.6;">
                    Use the code below to verify your email and start receiving your daily motivation & task updates from Feelivate.
                  </p>
                  <!-- OTP Box -->
                  <div style="background:#09090b;border:1px solid #3f3f46;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
                    <p style="color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 12px;">Verification Code</p>
                    <p style="color:#c084fc;font-size:40px;font-weight:700;letter-spacing:12px;margin:0;font-family:'Courier New',monospace;">
                      {otp}
                    </p>
                  </div>
                  <p style="color:#52525b;font-size:12px;margin:0;line-height:1.6;">
                    This code expires in <strong style="color:#71717a;">10 minutes</strong>. 
                    If you did not request this, please ignore this email.
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding:20px 32px;border-top:1px solid #27272a;">
                  <p style="color:#3f3f46;font-size:11px;margin:0;text-align:center;">
                    © 2026 Feelivate · Behavioral Architecture Engine
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """

    try:
        params = {
            "from": f"Feelivate <{FROM_EMAIL}>",
            "to": [to_email],
            "subject": f"{otp} is your Feelivate verification code",
            "html": html_body,
        }
        response = resend.Emails.send(params)
        logger.info(f"Verification email sent to {to_email}. ID: {response.get('id')}")
        return True
    except Exception as e:
        logger.error(f"Failed to send verification email to {to_email}: {e}")
        return False


def send_daily_task_email(
    to_email: str,
    user_name: str,
    day_action: str,
    motivation: str,
    week_number: int = 1,
    app_url: str = "https://emotion-time-travel-brlz.vercel.app",
) -> bool:
    """
    User ke email par daily personalized task notification bhejta hai.
    Returns True on success, False on failure.
    """
    if not resend.api_key:
        logger.error("RESEND_API_KEY not set. Cannot send daily email.")
        return False

    from datetime import datetime
    today_str = datetime.now().strftime("%A, %B %d")  # e.g., "Monday, June 06"

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#09090b;font-family:'Inter',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="480" cellpadding="0" cellspacing="0" style="background:#18181b;border-radius:16px;border:1px solid #27272a;overflow:hidden;">
              <!-- Header -->
              <tr>
                <td style="padding:28px 32px 20px;border-bottom:1px solid #27272a;background:linear-gradient(135deg,#1a0533,#18181b);">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <span style="font-size:20px;font-weight:700;color:#f4f4f5;letter-spacing:-0.5px;">✦ Feelivate</span>
                        <p style="color:#a855f7;font-size:11px;margin:4px 0 0;letter-spacing:1px;text-transform:uppercase;">Week {week_number} · {today_str}</p>
                      </td>
                      <td align="right">
                        <span style="background:rgba(168,85,247,0.15);border:1px solid rgba(168,85,247,0.3);color:#c084fc;font-size:11px;padding:4px 10px;border-radius:20px;">Daily Mission</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Greeting -->
              <tr>
                <td style="padding:28px 32px 0;">
                  <p style="color:#a1a1aa;font-size:14px;margin:0 0 6px;">Good morning, <strong style="color:#f4f4f5;">{user_name}</strong> 👋</p>
                  <p style="color:#71717a;font-size:13px;margin:0;line-height:1.6;">Your future self sent you a message. Here is what needs to be done today.</p>
                </td>
              </tr>
              <!-- Task Box -->
              <tr>
                <td style="padding:20px 32px;">
                  <div style="background:linear-gradient(135deg,rgba(168,85,247,0.1),rgba(99,102,241,0.05));border:1px solid rgba(168,85,247,0.2);border-radius:12px;padding:20px;">
                    <p style="color:#c084fc;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 10px;">🎯 Today's Task</p>
                    <p style="color:#f4f4f5;font-size:15px;font-weight:600;margin:0;line-height:1.5;">{day_action}</p>
                  </div>
                </td>
              </tr>
              <!-- Motivation -->
              <tr>
                <td style="padding:0 32px 24px;">
                  <div style="background:#0a0a0a;border-left:3px solid #a855f7;border-radius:0 8px 8px 0;padding:16px 20px;">
                    <p style="color:#a1a1aa;font-size:13px;line-height:1.7;margin:0;font-style:italic;">"{motivation}"</p>
                  </div>
                </td>
              </tr>
              <!-- CTA Button -->
              <tr>
                <td style="padding:0 32px 28px;text-align:center;">
                  <a href="{app_url}"
                     style="display:inline-block;background:linear-gradient(135deg,#a855f7,#6366f1);color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:10px;letter-spacing:0.3px;">
                    Open Feelivate →
                  </a>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding:16px 32px;border-top:1px solid #27272a;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <p style="color:#3f3f46;font-size:11px;margin:0;">© 2026 Feelivate</p>
                      </td>
                      <td align="right">
                        <a href="{app_url}/unsubscribe" style="color:#52525b;font-size:11px;text-decoration:none;">Unsubscribe</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """

    try:
        params = {
            "from": f"Feelivate <{FROM_EMAIL}>",
            "to": [to_email],
            "subject": f"🚀 Today's Mission: {day_action[:50]}{'...' if len(day_action) > 50 else ''}",
            "html": html_body,
        }
        response = resend.Emails.send(params)
        logger.info(f"Daily task email sent to {to_email}. ID: {response.get('id')}")
        return True
    except Exception as e:
        logger.error(f"Failed to send daily task email to {to_email}: {e}")
        return False


# Singleton instance
email_service = {
    "generate_otp": generate_otp,
    "send_verification_email": send_verification_email,
    "send_daily_task_email": send_daily_task_email,
}
