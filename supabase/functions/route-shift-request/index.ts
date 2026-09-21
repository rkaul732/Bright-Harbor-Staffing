import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const approvalEmail =
  Deno.env.get("SHIFT_APPROVAL_SUPERVISOR_EMAIL") ?? "bpataky@brightharbor.org";

serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const payload = await request.json();
  const requestorName = payload.record?.requestor_name ?? "An employee";
  const shiftId = payload.record?.shift_id ?? "unknown shift";

  // Wire this to Resend, SendGrid, or SMTP in production. The database trigger
  // already stores the routed notification; this function is the email adapter.
  console.info(
    `Approval request for ${shiftId} from ${requestorName} should be emailed to ${approvalEmail}.`
  );

  return Response.json({
    ok: true,
    routedTo: approvalEmail
  });
});
