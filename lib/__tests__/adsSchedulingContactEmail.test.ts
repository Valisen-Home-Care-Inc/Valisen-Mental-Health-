import { describe,expect,it } from "vitest";
import { buildConsultationContactEmail } from "@/lib/server/consultationContactEmail";
import { landingTranslator,type LandingLocale } from "@/lib/paidSearchLocale";
describe("dedicated landing unscheduled request receipt",()=>{
 it.each(["en","ar","zh-Hans"] as LandingLocale[])("promises a response within 24 hours and keeps the time unconfirmed in %s",locale=>{
  const receipt=buildConsultationContactEmail("Alex","VC-111111111111111111111111",locale,true);
  const t=landingTranslator(locale);
  expect(receipt.text).toContain(t("Your consultation request is saved. A date and time have not been booked yet. Our team will contact you within 24 hours to help arrange your free 20-minute phone consultation."));
  expect(receipt.text).toContain("24");expect(receipt.text).toContain("VC-111111111111111111111111");
  expect(receipt.html).toContain(`lang="${locale}"`);expect(receipt.html).not.toContain("Your consultation is booked");
 });
 it("keeps the other website contact receipt unchanged",()=>{
  const receipt=buildConsultationContactEmail("Alex","VC-111111111111111111111111");
  expect(receipt.text).toContain("Our team will contact you to arrange your free 20-minute phone consultation.");
  expect(receipt.text).not.toContain("within 24 hours");
 });
});
