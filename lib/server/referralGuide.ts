import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getActiveTherapists, getVerifiedLanguages, formatTherapySession } from "@/lib/therapists";

export async function buildReferralGuide(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Valisen Mental Health - Healthcare Provider Referral Guide");
  pdf.setAuthor("Valisen Mental Health");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const teal = rgb(.12, .42, .42);
  const ink = rgb(.17, .17, .17);
  let page = pdf.addPage([612, 792]);
  let y = 730;
  const clean = (text: string) => text.normalize("NFKD").replace(/[\u2013\u2014]/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[^\x20-\x7e]/g, "");
  function line(text: string, size = 11, font = regular, color = ink) {
    const words = clean(text).split(/\s+/);
    let buffer = "";
    for (const word of words) {
      const next = buffer ? buffer + " " + word : word;
      if (font.widthOfTextAtSize(next, size) > 504 && buffer) {
        if (y < 65) { page = pdf.addPage([612, 792]); y = 730; }
        page.drawText(buffer, { x: 54, y, size, font, color }); y -= size + 6; buffer = word;
      } else buffer = next;
    }
    if (buffer) {
      if (y < 65) { page = pdf.addPage([612, 792]); y = 730; }
      page.drawText(buffer, { x: 54, y, size, font, color }); y -= size + 6;
    }
  }
  line("VALISEN MENTAL HEALTH", 11, bold, teal);
  y -= 12;
  line("Healthcare Provider Referral Guide", 25, serif, teal);
  line("Virtual outpatient psychotherapy across Ontario", 12);
  y -= 16;
  line("Who to refer", 15, bold, teal);
  line("Adults and couples seeking outpatient support for anxiety, depression, stress, trauma, relationship concerns, grief and life transitions. Individual suitability is confirmed with the clinician.");
  y -= 12;
  line("How to refer", 15, bold, teal);
  line("1. Obtain the patient's authorization to share referral details by email with Valisen.");
  line("2. Complete the provider referral form at valisenmentalhealth.com/referrals.");
  line("3. Valisen reviews the referral and contacts the patient to discuss clinician fit and availability.");
  line("4. The patient selects a clinician and an appointment is arranged.");
  y -= 12;
  line("Referral coordination", 15, bold, teal);
  line("Phone: 613-707-0333");
  line("Clinic mailbox: info@valisenmentalhealth.com");
  line("Use the online form for referrals. General email enquiries should not include patient details or clinical records.");
  line("Submitting a referral does not book an appointment or authorize clinical updates to the referring provider.");
  y -= 12;
  line("Access and payment", 15, bold, teal);
  line("Languages: " + getVerifiedLanguages().join(", ") + ". Availability varies by clinician.");
  line("Video appointments; telephone options depend on clinician. Itemized receipts are provided. Patients should confirm their plan covers the selected professional designation.");
  y -= 12;
  line("Outpatient care only", 15, bold, teal);
  line("Valisen is not an emergency or crisis service. Direct patients requiring immediate intervention to appropriate emergency or crisis resources.");
  page = pdf.addPage([612, 792]); y = 730;
  line("Our Clinical Team", 25, serif, teal);
  line("Check the referral website for current availability and full profiles.", 10);
  y -= 12;
  for (const t of getActiveTherapists()) {
    if (y < 190) { page = pdf.addPage([612, 792]); y = 730; }
    line(t.name, 15, bold, teal);
    line(t.credentials, 11, bold);
    line("Languages: " + t.languages.join(", "));
    line("Support: " + t.specialties.slice(0, 3).join(", "));
    line(formatTherapySession(t) + " | " + (t.acceptingNewClients ? "Accepting new clients" : "Contact for availability"), 10);
    line("valisenmentalhealth.com/referrals/therapists/" + t.slug, 9);
    y -= 14;
  }
  const pages = pdf.getPages();
  pages.forEach((p, index) => p.drawText("Valisen Mental Health | " + new Date().toISOString().slice(0, 10) + " | " + (index + 1) + " / " + pages.length, { x: 54, y: 30, size: 9, font: regular, color: teal }));
  return pdf.save();
}
