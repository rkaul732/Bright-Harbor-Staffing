import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const payload = await request.json();
  const requestorName = payload.record?.requestor_name ?? "An employee";
  const shiftId = payload.record?.shift_id ?? "unknown shift";

  // Wire this to an email provider if email delivery is enabled. The database
  // trigger creates in-app alerts for approved program reviewers.
  console.info(
    `Approval request for ${shiftId} from ${requestorName} was routed to assigned program reviewers in-app.`
  );

  return Response.json({
    ok: true
  });
});
