"use client";
import ContactFirstWelcomeForm from "./ContactFirstWelcomeForm";
import LegacyPaidSearchConsultationForm from "./LegacyPaidSearchConsultationForm";
export default function PaidSearchConsultationForm({instanceId,contactFirst=false}:{instanceId:string;contactFirst?:boolean}) {
  return contactFirst ? <ContactFirstWelcomeForm instanceId={instanceId}/> : <LegacyPaidSearchConsultationForm instanceId={instanceId}/>;
}
