# QR booking links (`/booking/<code>`)

`https://valisenmentalhealth.com/booking/bc` is the QR destination for the Booking BC flyer. A scan is
counted, then the visitor is redirected (302) straight to the Jane booking page. Counts appear in the
admin dashboard under **Booking BC** (`/admin/checkpoints/booking`).

## Deploy

1. Run `supabase/migrations/20261019020000_booking_link_scans.sql` in the Supabase SQL editor.
   It is transactional and safe to rerun.
2. Deploy the website. No new environment variables are needed; it uses the existing
   `SUPABASE_URL` and `SUPABASE_SECRET_KEY`.

If the migration has not been run, `/booking/bc` still redirects to Jane; scans are just not saved and
the dashboard tab shows a message saying so.

## What is stored

One row per scan: the link code, a device category (`ios`, `android`, `other`) and the time. No IP
address, user-agent, referrer or anything the visitor typed. Link previews (WhatsApp, iMessage,
Slack, Facebook), crawlers, browser prefetches and HEAD requests are redirected but not counted.

The scan is written with `after()`, once the redirect has been sent, so a slow database never delays
the visitor.

## Add another placement

1. Add an entry to `BOOKING_LINKS` in `lib/bookingLinks.ts`, for example
   `{ code: "cafe", label: "Booking Cafe", destination: janeDestination("cafe") }`.
2. Print a QR code for `https://valisenmentalhealth.com/booking/cafe`.

The dashboard shows a section for every link. With more than one link the tab is called
"Booking links".
