-- Apply this migration before 014. PostgreSQL requires the new enum value
-- to be committed before it can be used in an insert.
alter type public.automated_message_event add value if not exists 'request_submitted';
