import Image from "next/image";
import { MessageCircle, UserPlus } from "lucide-react";
import {
  VALISEN_CARE_MARK_PATH,
  VALISEN_CARE_VCARD_PATH,
  WHATSAPP_URL,
} from "@/lib/valisenCare";
import styles from "./ResultsReveal.module.css";

/** A teal band offering the discreet "Valisen Care" contact and WhatsApp. */
export default function SaveContactBand({ exploring }: { exploring: boolean }) {
  return (
    <section className={styles.saveBand} aria-labelledby="save-valisen-care-title">
      <div className={styles.saveIntro}>
        <span className={styles.saveIcon} aria-hidden="true">
          <Image src={VALISEN_CARE_MARK_PATH} alt="" width={46} height={48} />
        </span>
        <div>
          <h2 id="save-valisen-care-title">Save Valisen Care to your phone</h2>
          <p>
            {exploring
              ? "No pressure. Save us now and reach out whenever you’re ready."
              : "A direct line to a care coordinator, whenever you need one."}
          </p>
        </div>
      </div>
      <div className={styles.saveActions}>
        <a href={VALISEN_CARE_VCARD_PATH} download="Valisen Care.vcf" className={styles.saveButton}>
          <UserPlus size={18} aria-hidden="true" />
          Save contact
        </a>
        <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={styles.whatsappButton}>
          <MessageCircle size={18} aria-hidden="true" />
          WhatsApp us
        </a>
      </div>
      <p className={styles.saveNote}>
        Saves under the discreet name “Valisen Care”. WhatsApp is for questions and scheduling; in an emergency, call or text 9-8-8.
      </p>
    </section>
  );
}
