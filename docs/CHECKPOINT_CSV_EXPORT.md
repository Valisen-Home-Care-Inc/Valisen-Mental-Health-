# Checkpoints: one-file CSV export

The Checkpoints tab's **Export all checkpoint data (CSV)** button downloads an authenticated report for the selected date range, respecting the same active reporting-period boundary as the dashboard. Selecting **All time** requests all data within that active period. Reporting archives retain their existing separate controls.

The CSV includes every checkpoint returned by the database dashboard, including zero-traffic checkpoints. It contains overall and per-checkpoint KPIs, funnels, question-step progression, result actions, intent mix, placement metadata/history, daily/day-of-week trends, sparklines and consultation attribution references. It reads the same full reports used by the dashboard and each detail page; it does not add collection of visitors' check-in answers or contact values.

Each row has `Scope`, `Checkpoint`, `Record type`, `Record key`, range boundaries, reporting-period start and generation timestamp. `Data:` columns contain the source fields. Record types distinguish overall totals from checkpoint detail and nested series (for example, `dashboard.kpis`, `checkpoint.daily`, `checkpoint.placements`). Do not add overall totals to per-checkpoint totals or count the repeated overall/detail consultation references as separate leads. Cumulative KPI rows use their reporting-period range rather than the selected date range.

UTF-8 with a BOM supports Arabic and other Unicode labels in Excel. CSV cells quote commas, quotes and newlines, and neutralize spreadsheet formulas in text. An unsuccessful checkpoint query aborts the export rather than silently omitting data. `/api/admin/checkpoints/export` requires the existing administrator session and sends private/no-store responses. This feature needs no new database migration.

Validation: `lib/__tests__/checkpointExport.test.ts` checks report categories, zero-traffic rows, formula protection, all checkpoint inclusion, reporting boundaries, administrator access and failures. `scripts/checkpoint-export-browser-qa.mjs` checks the actual CSV download and error UI using local database fixtures only.
