import {
  GOOGLE_ADS_CLICK_KEYS,
  googleAdsClickAttributionFromSearch,
} from "@/lib/campaignAttribution";
import { safeGoogleAdsCampaignIdentifier } from "@/lib/googleAdsEntry";

export type HomepageSearchParams = Record<
  string,
  string | string[] | undefined
>;

/**
 * Runs before React so the homepage remains a static, fail-open page. If this
 * tiny bridge cannot run, the visitor still gets the normal website; only the
 * optional Ads CRM attribution is skipped.
 */
export const GOOGLE_ADS_HOMEPAGE_ENTRY_BOOTSTRAP = `(function(){try{
  var u=new URL(window.location.href);
  if(u.pathname!=="/"||new URLSearchParams(u.hash.slice(1)).has("vmh_ga")){return}
  var keys=["gclid","gbraid","wbraid"],out=new URLSearchParams(),has=false;
  for(var i=0;i<keys.length;i++){var value=(u.searchParams.get(keys[i])||"").replace(/[\\u0000-\\u001F\\u007F\\s]/g,"").slice(0,500);if(/^[A-Za-z0-9._~-]{6,500}$/.test(value)){out.set(keys[i],value);has=true}}
  if(!has){return}
  var clean=function(value){value=(value||"").replace(/[\\u0000-\\u001F\\u007F]/g,"").replace(/\\s+/g," ").trim().slice(0,120);return value&&!/[@/?#&=\\\\]/.test(value)&&/^[\\p{L}\\p{N}][\\p{L}\\p{N} ._~:+()\\[\\]-]*$/u.test(value)?value:""};
  var campaign=clean(u.searchParams.get("utm_campaign")),content=clean(u.searchParams.get("utm_content"));
  if(campaign){out.set("utm_campaign",campaign)}if(content){out.set("utm_content",content)}
  window.location.replace("/google-ads/general?"+out.toString());
}catch(_){}})();`;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Turns a genuine Google click on `/` into the existing signed entry flow.
 * Unknown fields, search terms and contact-like values are never forwarded.
 */
export function googleAdsHomepageEntryPath(
  searchParams: HomepageSearchParams,
): string | null {
  const candidate = new URLSearchParams();
  for (const key of GOOGLE_ADS_CLICK_KEYS) {
    const value = first(searchParams[key]);
    if (value) candidate.set(key, value);
  }
  const clicks = googleAdsClickAttributionFromSearch(candidate.toString());
  if (Object.keys(clicks).length === 0) return null;

  const output = new URLSearchParams(clicks);
  const campaign = safeGoogleAdsCampaignIdentifier(first(searchParams.utm_campaign));
  const content = safeGoogleAdsCampaignIdentifier(first(searchParams.utm_content));
  if (campaign) output.set("utm_campaign", campaign);
  if (content) output.set("utm_content", content);
  return `/google-ads/general?${output.toString()}`;
}
