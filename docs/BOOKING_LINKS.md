# Flyer area QR links (`/booking/<code>`)

Each flyer area has its own QR link. A scan is counted under its area, then the visitor is redirected
(302) straight to the Jane booking page. Counts appear in the admin dashboard under **Booking**
(`/admin/checkpoints/booking`), with one section per area and an "All areas" comparison.

| Area        | QR address                                      |
|-------------|-------------------------------------------------|
| Beacon Hill | `https://valisenmentalhealth.com/booking/bh`    |
| Kanata      | `https://valisenmentalhealth.com/booking/ka`    |

## Deploy

1. Run `supabase/migrations/20261019020000_booking_link_scans.sql` in the Supabase SQL editor.
   It is transactional and safe to rerun.
2. Deploy the website. No new environment variables are needed; it uses the existing
   `SUPABASE_URL` and `SUPABASE_SECRET_KEY`.

If the migration has not been run, the links still redirect to Jane; scans are just not saved and
the dashboard tab shows a message saying so.

## What is stored

One row per scan: the area code, a device category (`ios`, `android`, `other`) and the time. No IP
address, user-agent, referrer or anything the visitor typed. Link previews (WhatsApp, iMessage,
Slack, Facebook), crawlers, browser prefetches and HEAD requests are redirected but not counted.

The scan is written with `after()`, once the redirect has been sent, so a slow database never delays
the visitor.

## Add an area

1. Add an entry to `BOOKING_LINKS` in `lib/bookingLinks.ts`, for example
   `{ code: "or", label: "Orleans", destination: janeDestination("or") }`.
2. Print a QR code for `https://valisenmentalhealth.com/booking/or`.

The dashboard adds a section for the new area automatically. Do not change an area's code after its
flyers are printed; the printed QR codes would stop working.
