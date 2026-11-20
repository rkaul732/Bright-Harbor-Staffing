-- Super Admins can inspect every time off and shift coverage request,
-- regardless of program, requester role, or decision status.
-- Existing UPDATE policies continue to control who may decide a request.
begin;

create policy "super admins read all time off requests"
on public.time_off_requests for select to authenticated
using (public.current_admin_is_super_admin());

create policy "super admins read all shift requests"
on public.requests for select to authenticated
using (public.current_admin_is_super_admin());

commit;
