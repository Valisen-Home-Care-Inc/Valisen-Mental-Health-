"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDownToLine, ArrowRight } from "lucide-react";
import { useState } from "react";
import styles from "./ConceptLanding.module.css";

export type ConceptSummary = {
  slug: string; label: string; collection: "campaign" | "niche";
  tone: string; headline: string; emphasis: string;
  photo: string; clinician: string; role: string; keywords: number;
};

export default function ConceptGallery({ concepts, keywordCount }: { concepts: ConceptSummary[]; keywordCount: number }) {
  const [filter, setFilter] = useState("all");
  const visible = concepts.filter((concept) => filter === "all" || concept.collection === filter);
  return <main className={styles.galleryPage}><div className={styles.container}>
    <header className={styles.galleryHeader}><Image src="/valisen-logo.png" alt="Valisen Mental Health" width={950} height={330} className={styles.logo} priority /><span>Google Ads · Design collection</span></header>
    <div className={styles.galleryIntro}><div><p className={styles.eyebrow}>A more personal first impression</p><h1>The right page.<br /><em>For the right person.</em></h1><p>15 focused landing-page concepts. Specific conversations, relevant clinicians, and a simple consultation flow—all on one page.</p></div>
      <aside className={styles.galleryNotes}><strong>{keywordCount} enabled keywords. Both ad groups covered.</strong>The two paused keywords are excluded. Open any concept to explore the page and try its booking flow. These are previews; no requests are sent or appointments booked.<br /><a href="/ads-preview/keyword-map" download="valisen-proposed-keyword-urls.csv"><ArrowDownToLine size={14} /> Download the proposed keyword → URL map</a></aside>
    </div>
    <div className={styles.galleryTools}><div className={styles.galleryFilters} role="group" aria-label="Filter landing concepts">{[["all", "All concepts"], ["campaign", "Current keywords"], ["niche", "Language & niche"]].map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div><span>{visible.length} concepts to explore</span></div>
    <div className={styles.galleryGrid}>{visible.map((concept) => <Link href={`/ads-preview/${concept.slug}`} key={concept.slug} className={`${styles.conceptCard} ${styles.page}`} data-tone={concept.tone} style={{ minHeight: "auto" }}>
      <div className={styles.conceptCover}><span>{concept.label}</span><h2>{concept.headline} <em>{concept.emphasis}</em></h2><div><Image src={concept.photo} alt="" width={40} height={40} /><p><strong>{concept.clinician}</strong><br />{concept.role}</p></div></div>
      <div className={styles.conceptCardBody}><div><strong>{concept.label}</strong><span>{concept.keywords ? `${concept.keywords} keywords` : "New niche"}</span></div><p>Proposed: /welcome/{concept.slug}</p><b>Explore this page <ArrowRight size={15} /></b></div>
    </Link>)}</div>
    <p className={styles.galleryFootnote}>The /welcome/… addresses are proposed final URLs for after approval. The existing /welcome page and campaign settings are unchanged. Mandarin, Arabic, ADHD, perfectionism, and trauma are additional concepts, separate from the uploaded keyword report.</p>
  </div></main>;
}
