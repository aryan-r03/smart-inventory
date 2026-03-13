"""
Email notification service using aiosmtplib.
Sends alert emails to admins and lab staff.
"""
import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_email(
    to_emails: List[str],
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
) -> bool:
    """Send an HTML email via SMTP."""
    if not settings.SMTP_PASSWORD:
        logger.warning("SMTP not configured — email not sent")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = ", ".join(to_emails)

    if text_body:
        msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            use_tls=False,
            start_tls=True,
        )
        logger.info(f"Email sent to {to_emails}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False


def build_alert_email(alerts: list) -> str:
    """Build HTML body for a batch alert digest."""
    rows = ""
    for alert in alerts:
        color = {
            "critical": "#ef4444",
            "high": "#f59e0b",
            "medium": "#3b82f6",
        }.get(alert.severity, "#64748b")

        rows += f"""
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">
            <strong>{alert.item.item_name if alert.item else "N/A"}</strong>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">
            <span style="background:{color};color:white;padding:2px 8px;border-radius:9999px;font-size:12px;">
              {alert.severity.upper()}
            </span>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">
            {alert.message}
          </td>
        </tr>"""

    return f"""
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:#1d4ed8;padding:24px 32px;">
      <h1 style="color:white;margin:0;font-size:20px;">⚗️ LabTrack Alert Digest</h1>
      <p style="color:#bfdbfe;margin:4px 0 0;font-size:14px;">{len(alerts)} item(s) require attention</p>
    </div>
    <div style="padding:24px 32px;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="text-align:left;padding:10px 12px;font-size:12px;color:#6b7280;text-transform:uppercase;">Item</th>
            <th style="text-align:left;padding:10px 12px;font-size:12px;color:#6b7280;text-transform:uppercase;">Severity</th>
            <th style="text-align:left;padding:10px 12px;font-size:12px;color:#6b7280;text-transform:uppercase;">Message</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;">
        <a href="{settings.FRONTEND_URL}/alerts"
           style="background:#1d4ed8;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">
          View All Alerts →
        </a>
      </div>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;font-size:12px;color:#9ca3af;">
      LabTrack Smart Inventory · Unsubscribe from alerts in Settings
    </div>
  </div>
</body>
</html>"""


async def send_low_stock_alert(to_emails: List[str], alerts: list):
    html = build_alert_email(alerts)
    count = len(alerts)
    await send_email(
        to_emails=to_emails,
        subject=f"⚠️ LabTrack: {count} inventory alert{'s' if count != 1 else ''} require attention",
        html_body=html,
        text_body=f"LabTrack: {count} items need attention. Visit your dashboard for details.",
    )


async def send_welcome_email(to_email: str, full_name: str, role: str):
    html = f"""
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:white;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="font-size:32px;margin-bottom:16px;">⚗️</div>
    <h1 style="margin:0 0 8px;font-size:22px;">Welcome to LabTrack, {full_name}!</h1>
    <p style="color:#6b7280;margin:0 0 24px;">Your account has been created with <strong>{role.replace('_',' ').title()}</strong> access.</p>
    <a href="{settings.FRONTEND_URL}/login"
       style="display:inline-block;background:#1d4ed8;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500;">
      Sign In →
    </a>
  </div>
</body>
</html>"""
    await send_email([to_email], "Welcome to LabTrack 🎉", html)
