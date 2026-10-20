# Bright Harbor Supabase Auth email templates

Paste each complete HTML file into the matching template under Supabase Dashboard > Authentication > Email Templates. Set the subject separately:

| Supabase template | Subject | HTML file |
| --- | --- | --- |
| Confirm sign up | Confirm your Bright Harbor email | `confirm-sign-up.html` |
| Magic link or OTP | Your Bright Harbor sign-in link | `magic-link-or-otp.html` |
| Change email address | Confirm your new Bright Harbor email address | `change-email-address.html` |
| Reset password | Reset your Bright Harbor Staffing password | `reset-password.html` |
| Reauthentication | Your Bright Harbor verification code | `reauthentication.html` |

Keep `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .Email }}`, and `{{ .NewEmail }}` intact. Supabase fills them in when sending. The public logo is served from `https://brightharborstaffing.org/brand/bhh-logo.png`. These files are source copies; editing them does not change the live Supabase templates. Turn off link click tracking in any external email provider used for Supabase Auth so verification URLs remain intact.

Resend delivers these Supabase Auth messages when the Resend-to-Supabase integration or custom SMTP is enabled. Supabase still supplies the HTML and subject. In Supabase, set the sender name to `Bright Harbor Staffing` and the sender address to an address on a domain verified in Resend. Use the same address for Netlify's `RESEND_FROM_EMAIL` so account and request-decision emails have a consistent From line. The site sends request decisions through Resend's API, so Netlify also needs `RESEND_API_KEY`; a Supabase integration does not supply that variable to Netlify.
