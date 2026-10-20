from html import escape

import httpx

from backend.core.config import get_settings

FIELD = "#14211A"  # dark work green
BONE = "#E9E3D6"  # light text on green
SAGE = "#94A79A"  # muted text on green
SUN = "#D9A441"  # the accent
INK = "#1F2A24"  # body text on the white card
MUTED = "#6B7A70"  # secondary text on the white card
PAGE = "#F3F0E8"  # warm off-white page behind the card

FONT = "'Familjen Grotesk', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, 'Courier New', monospace"


async def send_email(to: str, subject: str, text: str, html: str | None = None) -> None:
    s = get_settings()

    if s.email_provider == "console":
        print(f"[email to {to}] {subject}\n{text}", flush=True)
        return

    if s.email_provider != "resend" or not s.resend_api_key:
        raise RuntimeError("Email provider is not configured")

    payload = {"from": s.email_from, "to": [to], "subject": subject, "text": text}
    if html:
        payload["html"] = html

    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {s.resend_api_key}"},
            json=payload,
        )
        res.raise_for_status()


def render_code_email(code: str, minutes: int = 5) -> tuple[str, str]:
    """Returns (text, html) for a verification code email.

    Email clients ignore <style> blocks and most modern CSS, so everything is
    inline and laid out with tables. That is what makes it look the same in
    Gmail, Outlook and Apple Mail.
    """
    code = escape(code)

    text = (
        f"Your Meridiem verification code is {code}\n\n"
        f"It expires in {minutes} minutes. Enter it on the page where you signed in.\n\n"
        "If you didn't try to sign in, you can ignore this email. "
        "Someone may have typed your address by mistake, and nothing changes without the code.\n\n"
        "Meridiem by Green Star"
    )

    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Your Meridiem code</title>
</head>
<body style="margin:0; padding:0; background:{PAGE}; -webkit-text-size-adjust:100%;">

<!-- Inbox preview line. Hidden in the email itself. -->
<div style="display:none; max-height:0; overflow:hidden; opacity:0; color:{PAGE};">
Your code is {code}. It expires in {minutes} minutes.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{PAGE}" style="background:{PAGE};">
<tr><td align="center" style="padding:40px 16px;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">

    <!-- Header band -->
    <tr>
      <td bgcolor="{FIELD}" style="background:{FIELD}; background-image:radial-gradient(120% 140% at 50% 130%, rgba(217,164,65,0.38) 0%, rgba(217,164,65,0.10) 45%, rgba(217,164,65,0) 75%); border-radius:14px 14px 0 0; padding:28px 32px 26px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td valign="middle" style="padding-right:11px;">
              <div style="width:22px; height:22px; border-radius:50%; background:{SUN}; line-height:22px; font-size:1px;">&nbsp;</div>
            </td>
            <td valign="middle" style="font-family:{FONT};">
              <div style="font-size:20px; font-weight:700; letter-spacing:-0.02em; color:{BONE}; line-height:1;">Meridiem</div>
              <div style="font-size:11.5px; font-weight:500; color:{SAGE}; margin-top:4px; line-height:1;">by Green Star</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Card body -->
    <tr>
      <td bgcolor="#FFFFFF" style="background:#FFFFFF; border-radius:0 0 14px 14px; padding:34px 32px 30px; font-family:{FONT}; color:{INK};">

        <h1 style="margin:0 0 10px; font-size:22px; font-weight:700; letter-spacing:-0.02em; line-height:1.25; color:{INK};">Your verification code</h1>
        <p style="margin:0 0 24px; font-size:15px; line-height:1.55; color:{MUTED};">
          Enter this code on the page where you signed in. It expires in {minutes} minutes.
        </p>

        <!-- The code -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" bgcolor="#FBF6EC" style="background:#FBF6EC; border:1px solid #EBDDBF; border-radius:10px; padding:20px 12px;">
              <div style="font-family:{MONO}; font-size:34px; font-weight:700; letter-spacing:10px; color:{FIELD}; line-height:1.1; padding-left:10px;">{code}</div>
            </td>
          </tr>
        </table>

        <p style="margin:24px 0 0; font-size:13.5px; line-height:1.55; color:{MUTED};">
          If you didn't try to sign in, you can ignore this email. Someone may have typed your
          address by mistake, and nothing changes without the code.
        </p>

        <!-- Divider -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px;">
          <tr><td style="border-top:1px solid #ECE8DF; font-size:1px; line-height:1px;">&nbsp;</td></tr>
        </table>

        <p style="margin:16px 0 0; font-size:12.5px; line-height:1.5; color:{MUTED};">
          For your security, Meridiem will never ask for this code by phone or text.
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td align="center" style="padding:22px 16px 0; font-family:{FONT}; font-size:12px; line-height:1.5; color:#9AA59E;">
        Meridiem by Green Star
      </td>
    </tr>

  </table>

</td></tr>
</table>
</body>
</html>"""

    return text, html


async def send_code_email(to: str, code: str) -> None:
    text, html = render_code_email(code)
    await send_email(to, f"Your Meridiem code is {code}", text, html)
