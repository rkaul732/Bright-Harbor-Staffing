import type { AppUser, ShiftRequest, TimeOffRequest } from "@/shared/types/domain";

type PendingRequest = Pick<ShiftRequest | TimeOffRequest, "created_at" | "status">;

export function isNewPendingRequest(request: PendingRequest, user: AppUser, viewed = false) {
  if (request.status !== "pending_supervisor_approval" || viewed) return false;

  const previousSignIn = user.previous_sign_in_at ?? user.created_at;
  const currentSignIn = user.last_sign_in_at;

  return Boolean(
    currentSignIn &&
    request.created_at > previousSignIn &&
    request.created_at <= currentSignIn
  );
}
