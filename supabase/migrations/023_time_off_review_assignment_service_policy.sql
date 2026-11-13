-- Keep the assignment table closed to browser clients while explicitly
-- allowing the server's service role to maintain reviewer assignments.
create policy "service role manages time off review assignments"
on public.time_off_review_assignments
for all to service_role
using (true)
with check (true);
