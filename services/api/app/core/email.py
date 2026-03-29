"""
Email service — async SMTP sending via thread executor.
No additional dependencies required (uses stdlib smtplib).
"""
import asyncio
import logging
import smtplib
from concurrent.futures import ThreadPoolExecutor
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="email")


# ---------------------------------------------------------------------------
# Core send
# ---------------------------------------------------------------------------

def _send_smtp(to: str, subject: str, html: str) -> None:
    """Blocking SMTP deliver — always called via executor."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg.attach(MIMEText(html, "html", "utf-8"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
        if settings.SMTP_TLS:
            smtp.starttls()
        if settings.SMTP_USER:
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD or "")
        smtp.sendmail(settings.SMTP_FROM, [to], msg.as_string())


async def send_email(to: str, subject: str, html: str) -> None:
    """Send an HTML email. Logs and swallows errors so auth flows are never blocked."""
    if not settings.SMTP_ENABLED:
        logger.info("[EMAIL DISABLED] To=%s | Subject=%s", to, subject)
        return
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(_executor, _send_smtp, to, subject, html)
        logger.info("Email sent: To=%s | Subject=%s", to, subject)
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to, exc)


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------

_BASE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{subject}</title>
  <style>
    body {{ margin:0; padding:0; background:#F5F2EE; font-family:'Helvetica Neue',Arial,sans-serif; }}
    .wrapper {{ max-width:560px; margin:40px auto; background:#ffffff; border-radius:8px; overflow:hidden; border:1px solid #E5E0D8; }}
    .header {{ background:#C96442; padding:32px 40px; }}
    .header h1 {{ margin:0; color:#ffffff; font-size:22px; font-weight:700; letter-spacing:-0.3px; }}
    .body {{ padding:36px 40px; color:#2D2926; }}
    .body p {{ margin:0 0 18px; font-size:15px; line-height:1.6; color:#4A4540; }}
    .btn {{ display:inline-block; margin:8px 0 24px; padding:14px 28px; background:#C96442; color:#ffffff !important; text-decoration:none; border-radius:6px; font-size:15px; font-weight:600; }}
    .divider {{ border:none; border-top:1px solid #E5E0D8; margin:24px 0; }}
    .small {{ font-size:13px; color:#8A7F78; line-height:1.5; }}
    .footer {{ padding:20px 40px; background:#FAF8F5; border-top:1px solid #E5E0D8; font-size:12px; color:#8A7F78; text-align:center; }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>CADVisor</h1></div>
    <div class="body">{content}</div>
    <div class="footer">This email was sent by CADVisor. If you did not request this, you can safely ignore it.</div>
  </div>
</body>
</html>"""


def _render(subject: str, content: str) -> str:
    return _BASE.format(subject=subject, content=content)


# ---------------------------------------------------------------------------
# Auth emails
# ---------------------------------------------------------------------------

async def send_verification_email(email: str, token: str) -> None:
    link = f"{settings.FRONTEND_URL}/auth/verify-email?token={token}"
    subject = "Verify your email — CADVisor"
    content = f"""
      <p>Welcome to <strong>CADVisor</strong>! Please verify your email address to get started.</p>
      <a href="{link}" class="btn">Verify email address</a>
      <hr class="divider" />
      <p class="small">This link expires in <strong>24 hours</strong>. If you did not create an account, no action is needed.</p>
      <p class="small">If the button above doesn't work, paste this link into your browser:<br /><a href="{link}" style="color:#C96442;">{link}</a></p>
    """
    await send_email(email, subject, _render(subject, content))


async def send_password_reset_email(email: str, token: str) -> None:
    link = f"{settings.FRONTEND_URL}/auth/reset-password?token={token}"
    subject = "Reset your password — CADVisor"
    content = f"""
      <p>We received a request to reset the password for your CADVisor account (<strong>{email}</strong>).</p>
      <a href="{link}" class="btn">Reset password</a>
      <hr class="divider" />
      <p class="small">This link expires in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email — your password will not change.</p>
      <p class="small">If the button above doesn't work, paste this link into your browser:<br /><a href="{link}" style="color:#C96442;">{link}</a></p>
    """
    await send_email(email, subject, _render(subject, content))


async def send_password_changed_email(email: str) -> None:
    subject = "Your password was changed — CADVisor"
    content = f"""
      <p>The password for your CADVisor account (<strong>{email}</strong>) was successfully changed.</p>
      <p>If you made this change, no further action is needed.</p>
      <hr class="divider" />
      <p class="small"><strong>Did not make this change?</strong> Your account may be compromised. Please <a href="{settings.FRONTEND_URL}/auth/forgot-password" style="color:#C96442;">reset your password immediately</a> and contact support.</p>
    """
    await send_email(email, subject, _render(subject, content))
