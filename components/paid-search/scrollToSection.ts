const EXTRA_GAP_PX = 16;

/**
 * Chrome's scrollIntoView appears to auto-detect the sticky header and
 * clear it using its own heuristic, which does not consistently honor a
 * `scroll-margin-top` set on the target (verified: it settles the header's
 * own height below the top regardless of the CSS value, sometimes leaving
 * the target's top edge tucked under the header). Computing the offset
 * manually is the reliable way to land just below the sticky header.
 */
export function scrollToSection(targetId: string): void {
  const target = document.getElementById(targetId);
  if (!target) return;
  const header = document.querySelector("header");
  const headerOffset = header?.getBoundingClientRect().height ?? 0;
  const targetTop =
    target.getBoundingClientRect().top + window.scrollY - headerOffset - EXTRA_GAP_PX;
  window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
}
