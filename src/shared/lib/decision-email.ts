type DecisionEmail = {
  to: string;
  employeeName: string;
  requestKind: "time off" | "shift coverage";
  programName: string;
  dateDescription: string;
  status: "approved" | "declined";
  reviewComment: string;
  reviewerName: string;
  subject?: string;
  customBodyHtml?: string;
  commentAlreadyInBody?: boolean;
  idempotencyKey: string;
};

export function escapeEmailHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function deliverResendEmail({
  to,
  subject,
  html,
  idempotencyKey
}: {
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { ok: false, error: "Resend sender settings are missing." };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
      cache: "no-store"
    });

    if (!response.ok) {
      const error = await response.text();
      return { ok: false, error: `Resend rejected the email (${response.status}): ${error.slice(0, 300)}` };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Email service unavailable." };
  }
}

export async function sendDecisionEmail(message: DecisionEmail): Promise<{ ok: boolean; error?: string }> {
  const approved = message.status === "approved";
  const statusColor = approved ? "#166534" : "#b91c1c";
  const comment = message.reviewComment.trim() || "No additional comment was added.";
  const detail = `${message.requestKind} request for ${message.programName} (${message.dateDescription})`;
  const content = message.customBodyHtml ??
    `<p>Hello ${escapeEmailHtml(message.employeeName)},</p><p>Your ${escapeEmailHtml(detail)} has been <strong>${approved ? "approved" : "denied"}</strong>.</p>`;
  const commentHtml = message.commentAlreadyInBody ? "" : `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:24px;">
      <tr><td bgcolor="#eef5fb" style="padding:16px 18px;border-left:4px solid #4BA0D8;border-radius:6px;color:#40566b;font-size:14px;line-height:22px;">
        <strong style="color:#1c2f43;">Comment from ${escapeEmailHtml(message.reviewerName)}</strong><br>
        <span style="white-space:pre-wrap;">${escapeEmailHtml(comment)}</span>
      </td></tr>
    </table>`;
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Bright Harbor request decision</title></head>
<body style="margin:0;padding:0;background-color:#eef5fb;font-family:Arial,Helvetica,sans-serif;color:#1c2f43;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your Bright Harbor ${escapeEmailHtml(message.requestKind)} request was ${approved ? "approved" : "denied"}.</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#eef5fb" style="background-color:#eef5fb;">
    <tr><td align="center" style="padding:36px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #dce8f1;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:28px 36px 22px;"><img src="https://brightharborstaffing.org/brand/bhh-logo.png" alt="Bright Harbor Healthcare" width="220" style="display:block;width:220px;max-width:100%;height:auto;border:0;"></td></tr>
        <tr><td><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td width="40%" height="5" bgcolor="#4BA0D8" style="font-size:0;line-height:0;">&nbsp;</td><td width="40%" height="5" bgcolor="#346990" style="font-size:0;line-height:0;">&nbsp;</td><td width="20%" height="5" bgcolor="#f7f5ac" style="font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>
        <tr><td style="padding:38px 36px 34px;">
          <p style="margin:0 0 12px;color:#346990;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Bright Harbor Staffing Portal</p>
          <h1 style="margin:0 0 18px;color:#1c2f43;font-size:30px;font-weight:700;line-height:38px;">Request ${approved ? "approved" : "denied"}</h1>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 22px;"><tr><td style="padding:12px 16px;border-left:4px solid ${statusColor};background-color:${approved ? "#f0fdf4" : "#fef2f2"};color:${statusColor};font-size:14px;font-weight:700;">${approved ? "Approved" : "Denied"}</td></tr></table>
          <div style="color:#40566b;font-size:16px;line-height:26px;">${content}</div>
          ${commentHtml}
        </td></tr>
        <tr><td bgcolor="#f7fafc" style="padding:20px 36px;border-top:1px solid #dce8f1;color:#718394;font-size:12px;line-height:19px;">Bright Harbor Healthcare Staffing<br>Staffing Portal</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return deliverResendEmail({
    to: message.to,
    subject: message.subject ?? `Your ${message.requestKind} request was ${approved ? "approved" : "denied"}`,
    html,
    idempotencyKey: message.idempotencyKey
  });
}

export async function sendSubmissionEmail({
  to,
  subject,
  bodyHtml,
  idempotencyKey
}: {
  to: string;
  subject: string;
  bodyHtml: string;
  idempotencyKey: string;
}): Promise<{ ok: boolean; error?: string }> {
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Your Request Has Been Submitted</title></head>
<body style="margin:0;padding:0;background-color:#eef5fb;font-family:Arial,Helvetica,sans-serif;color:#1c2f43;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your Bright Harbor request was successfully submitted.</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#eef5fb" style="background-color:#eef5fb;">
    <tr><td align="center" style="padding:36px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #dce8f1;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:28px 36px 22px;"><img src="https://brightharborstaffing.org/brand/bhh-logo.png" alt="Bright Harbor Healthcare" width="220" style="display:block;width:220px;max-width:100%;height:auto;border:0;"></td></tr>
        <tr><td><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td width="40%" height="5" bgcolor="#4BA0D8" style="font-size:0;line-height:0;">&nbsp;</td><td width="40%" height="5" bgcolor="#346990" style="font-size:0;line-height:0;">&nbsp;</td><td width="20%" height="5" bgcolor="#f7f5ac" style="font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>
        <tr><td style="padding:38px 36px 34px;">
          <p style="margin:0 0 12px;color:#346990;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Bright Harbor Staffing Portal</p>
          <h1 style="margin:0 0 18px;color:#1c2f43;font-size:30px;font-weight:700;line-height:38px;">Your Request Has Been Submitted</h1>
          <div style="color:#40566b;font-size:16px;line-height:26px;">${bodyHtml}</div>
        </td></tr>
        <tr><td bgcolor="#f7fafc" style="padding:20px 36px;border-top:1px solid #dce8f1;color:#718394;font-size:12px;line-height:19px;">Bright Harbor Healthcare Staffing<br>Staffing Portal</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return deliverResendEmail({ to, subject, html, idempotencyKey });
}
