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

export async function sendDecisionEmail(message: DecisionEmail): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    return { ok: false, error: "Resend sender settings are missing." };
  }

  const approved = message.status === "approved";
  const statusColor = approved ? "#166534" : "#b91c1c";
  const comment = message.reviewComment.trim() || "No additional comment was added.";
  const detail = `${message.requestKind} request for ${message.programName} (${message.dateDescription})`;
  const content = message.customBodyHtml ??
    `<p>Hello ${escapeEmailHtml(message.employeeName)},</p><p>Your ${escapeEmailHtml(detail)} has been <strong>${approved ? "approved" : "denied"}</strong>.</p>`;
  const commentHtml = message.commentAlreadyInBody ? "" : `<div style="background:#eef5fb;border-radius:8px;padding:16px;margin:22px 0"><strong>Comment from ${escapeEmailHtml(message.reviewerName)}</strong><p style="margin:8px 0 0;white-space:pre-wrap">${escapeEmailHtml(comment)}</p></div>`;
  const html = `<!doctype html><html><body style="margin:0;background:#eef5fb;color:#1c2f43;font-family:Arial,sans-serif"><div style="max-width:600px;margin:32px auto;background:#fff;border:1px solid #dbe8f2;border-radius:12px;overflow:hidden"><div style="background:#1c2f43;padding:24px 30px;color:#fff"><div style="font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:#4BA0D8">Bright Harbor Healthcare</div><h1 style="font-size:24px;margin:8px 0 0">Request ${approved ? "approved" : "denied"}</h1></div><div style="padding:30px;line-height:1.6"><div style="border-left:4px solid ${statusColor};padding-left:14px;margin-bottom:20px;font-weight:bold;color:${statusColor}">${approved ? "Approved" : "Denied"}</div>${content}${commentHtml}<p style="font-size:13px;color:#346990">Bright Harbor Staffing</p></div></div></body></html>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject ?? `Your ${message.requestKind} request was ${approved ? "approved" : "denied"}`,
        html
      }),
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
