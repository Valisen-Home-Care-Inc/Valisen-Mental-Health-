import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { google } from "googleapis";
import {
  getPreferredTherapistLabel,
  isSpecificTherapistSlug,
  normalizePreferredTherapist,
  type SpecificTherapistSlug,
} from "@/lib/intake";

const CLINIC_EMAIL = "info@valisenmentalhealth.com";

const THERAPIST_EMAILS: Record<SpecificTherapistSlug, string | undefined> = {
  "dayong-quan": process.env.DAYONG_QUAN_EMAIL,
  "wilfred-bengnwi": process.env.WILFRED_BENGNWI_EMAIL,
  "tim-kahtava": process.env.TIM_KAHTAVA_EMAIL,
};

const ALLOW_SELF_SIGNED_SMTP_CERT =
  process.env.NODE_ENV === "development" && process.env.SMTP_ALLOW_SELF_SIGNED_CERT === "true";

const HEADER_ROW = [
  "Timestamp",
  "First Name",
  "Last Name",
  "Email",
  "Phone",
  "Postal Code",
  "Reason",
  "Preferred Therapist",
  "Consent",
  "Days",
  "Time of Day",
  "Notes",
];

function getMissingEnv(names: string[]) {
  return names.filter((name) => !process.env[name]);
}

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Unknown error";
}

function submissionError(message: string, err?: unknown) {
  const detail =
    process.env.NODE_ENV === "development" && err ? ` ${getErrorMessage(err)}` : "";

  return NextResponse.json({ error: `${message}${detail}` }, { status: 500 });
}

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
      preferredTherapist: rawPreferredTherapist,
      consent,
      days,
      timeOfDay,
      notes,
      source,
    } = body as {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      postalCode?: string;
      reason?: string;
      preferredTherapist?: string;
      consent?: boolean;
      days?: string[];
      timeOfDay?: string;
      notes?: string;
      /** Optional origin tag. "quiz" submissions are emailed only — not written to the Sheet. */
      source?: string;
    };

    const skipSheet = source === "quiz";

    if (!firstName || !lastName || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const preferredTherapist = normalizePreferredTherapist(rawPreferredTherapist);
    const preferredTherapistLabel = getPreferredTherapistLabel(preferredTherapist);

    const timestamp = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date());

    const daysStr =
      Array.isArray(days) && days.length > 0 ? days.join(", ") : "Not provided";

    const missingEmailEnv = getMissingEnv(["GMAIL_USER", "GMAIL_APP_PASSWORD"]);
    if (missingEmailEnv.length > 0) {
      console.error("submit-intake: missing email environment variables:", missingEmailEnv);
      return submissionError("Submission email is not configured.");
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
      tls: ALLOW_SELF_SIGNED_SMTP_CERT
        ? {
            rejectUnauthorized: false,
          }
        : undefined,
    });

    const clinicEmailBody = `New intake submission received at ${timestamp}.

Name:                    ${firstName} ${lastName}
Email:                   ${email}
Phone:                   ${phone || "Not provided"}
Postal Code:             ${postalCode || "Not provided"}
Reason for support:      ${reason || "Not provided"}
Preferred therapist:     ${preferredTherapistLabel}
Extended health benefits:${consent ? "Yes — consented" : "Not confirmed"}
Preferred days:          ${daysStr}
Preferred time of day:   ${timeOfDay || "Not provided"}
Additional notes:        ${notes || "None"}`;

    try {
      await transporter.sendMail({
        from: `"Valisen Mental Health" <${process.env.GMAIL_USER}>`,
        to: CLINIC_EMAIL,
        subject: `New Intake Submission - ${firstName} ${lastName}`,
        text: clinicEmailBody,
      });
    } catch (err) {
      console.error("submit-intake email failed:", err);
      return submissionError(
        "Submission email failed. Check the Gmail app password and account settings.",
        err,
      );
    }

    if (isSpecificTherapistSlug(preferredTherapist)) {
      const therapistEmail = THERAPIST_EMAILS[preferredTherapist];

      if (therapistEmail) {
        const therapistEmailBody = `Hello ${preferredTherapistLabel},

A new lead has selected you through the Valisen Mental Health website.

Client details:
Name: ${firstName} ${lastName}
Email: ${email}
Phone: ${phone || "Not provided"}
Reason for seeking support: ${reason || "Not provided"}
Preferred therapist: ${preferredTherapistLabel}
Benefits: ${consent ? "Yes — consented" : "Not confirmed"}

Please follow Valisen's intake process before discussing clinical details.

Valisen Mental Health`;

        try {
          await transporter.sendMail({
            from: `"Valisen Mental Health" <${process.env.GMAIL_USER}>`,
            to: therapistEmail,
            subject: "New Valisen Mental Health Lead",
            text: therapistEmailBody,
          });
        } catch (err) {
          console.warn("submit-intake therapist notification failed:", err);
        }
      } else {
        console.warn(
          `submit-intake: missing therapist email environment variable for ${preferredTherapist}`,
        );
      }
    }

    const missingSheetEnv = getMissingEnv([
      "GOOGLE_SERVICE_ACCOUNT_EMAIL",
      "GOOGLE_PRIVATE_KEY",
      "GOOGLE_SHEET_ID",
    ]);
    let savedToSheet = false;

    if (skipSheet) {
      // Quiz submissions are intentionally email-only and never written to the Sheet.
    } else if (missingSheetEnv.length > 0) {
      console.warn("submit-intake: skipping spreadsheet append, missing variables:", missingSheetEnv);
    } else {
      try {
        const privateKey = (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

        const auth = new google.auth.JWT({
          email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          key: privateKey,
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });

        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEET_ID ?? "";

        const existing = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: "A1:L1",
        });

        const firstRow = existing.data.values?.[0];
        if (!firstRow || firstRow.length === 0 || firstRow[7] === "Format") {
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
                preferredTherapistLabel,
                consent ? "Consented" : "Not confirmed",
                daysStr,
                timeOfDay || "",
                notes || "",
              ],
            ],
          },
        });
        savedToSheet = true;
      } catch (err) {
        console.warn("submit-intake spreadsheet append failed:", err);
      }
    }

    return NextResponse.json({ ok: true, savedToSheet });
  } catch (err) {
    console.error("submit-intake error:", err);
    return submissionError("Submission failed.", err);
  }
}
