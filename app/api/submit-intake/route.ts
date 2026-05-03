import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { google } from "googleapis";

const HEADER_ROW = [
  "Timestamp",
  "First Name",
  "Last Name",
  "Email",
  "Phone",
  "Postal Code",
  "Reason",
  "Format",
  "Benefits",
  "Days",
  "Time of Day",
  "Notes",
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      firstName,
      lastName,
      email,
      phone,
      postalCode,
      reason,
      format,
      benefits,
      days,
      timeOfDay,
      notes,
    } = body as {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      postalCode?: string;
      reason?: string;
      format?: string;
      benefits?: string;
      days?: string[];
      timeOfDay?: string;
      notes?: string;
    };

    if (!firstName || !lastName || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const timestamp = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date());

    const daysStr =
      Array.isArray(days) && days.length > 0 ? days.join(", ") : "Not provided";

    // ── 1. Send email via Nodemailer / Gmail SMTP ──────────────────────────────
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const emailBody = `New intake submission received at ${timestamp}.

Name:                    ${firstName} ${lastName}
Email:                   ${email}
Phone:                   ${phone || "Not provided"}
Postal Code:             ${postalCode || "Not provided"}
Reason for support:      ${reason || "Not provided"}
Session format:          ${format || "Not provided"}
Extended health benefits:${benefits || "Not provided"}
Preferred days:          ${daysStr}
Preferred time of day:   ${timeOfDay || "Not provided"}
Additional notes:        ${notes || "None"}`;

    await transporter.sendMail({
      from: `"Valisen Mental Health" <${process.env.GMAIL_USER}>`,
      to: "info@valisenmentalhealth.com",
      subject: `New Intake Submission – ${firstName} ${lastName}`,
      text: emailBody,
    });

    // ── 2. Append to Google Sheets ─────────────────────────────────────────────
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID ?? "";

    // Check whether a header row already exists
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "A1:L1",
    });

    const firstRow = existing.data.values?.[0];
    if (!firstRow || firstRow.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "A1:L1",
        valueInputOption: "RAW",
        requestBody: { values: [HEADER_ROW] },
      });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "A:L",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          [
            timestamp,
            firstName,
            lastName,
            email,
            phone || "",
            postalCode || "",
            reason || "",
            format || "",
            benefits || "",
            daysStr,
            timeOfDay || "",
            notes || "",
          ],
        ],
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("submit-intake error:", err);
    return NextResponse.json({ error: "Submission failed" }, { status: 500 });
  }
}
