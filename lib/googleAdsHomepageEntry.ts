import {
  GOOGLE_ADS_CLICK_KEYS,
  googleAdsClickAttributionFromSearch,
} from "@/lib/campaignAttribution";
import {
  GOOGLE_ADS_VALUE_TRACK_QUERY_KEYS,
  googleAdsValueTrackAttributionFromSearch,
  safeGoogleAdsCampaignIdentifier,
} from "@/lib/googleAdsEntry";
import { GOOGLE_ADS_DIRECT_ENTRY_PATHS } from "@/lib/googleAdsJourney";

export type HomepageSearchParams = Record<
  string,
  string | string[] | undefined
>;

/**
 * Runs before React so the homepage remains a static, fail-open page. If this
 * tiny bridge cannot run, the visitor still gets the normal website; only the
 * optional Ads CRM attribution is skipped.
 */
const GOOGLE_ADS_DIRECT_ENTRY_PATHS_JSON = JSON.stringify(
  GOOGLE_ADS_DIRECT_ENTRY_PATHS,
);

export const GOOGLE_ADS_HOMEPAGE_ENTRY_BOOTSTRAP = `(function(){try{
  var u=new URL(window.location.href);
  var landing=u.pathname.length>1&&u.pathname.endsWith("/")?u.pathname.slice(0,-1):u.pathname;
  var allowed=${GOOGLE_ADS_DIRECT_ENTRY_PATHS_JSON};
  if(allowed.indexOf(landing)<0||new URLSearchParams(u.hash.slice(1)).has("vmh_ga")){return}
  var keys=["gclid","gbraid","wbraid"],out=new URLSearchParams(),has=false;
  for(var i=0;i<keys.length;i++){var value=(u.searchParams.get(keys[i])||"").replace(/[\\u0000-\\u001F\\u007F\\s]/g,"").slice(0,500);if(/^[A-Za-z0-9._~-]{6,500}$/.test(value)){out.set(keys[i],value);has=true}}
  if(!has){return}
  var clean=function(value){value=(value||"").replace(/[\\u0000-\\u001F\\u007F]/g,"").replace(/\\s+/g," ").trim().slice(0,120);return value&&!/[@/?#&=\\\\]/.test(value)&&/^[\\p{L}\\p{N}][\\p{L}\\p{N} ._~:+()\\[\\]-]*$/u.test(value)?value:""};
  var campaign=clean(u.searchParams.get("utm_campaign")),content=clean(u.searchParams.get("utm_content"));
  if(campaign){out.set("utm_campaign",campaign)}if(content){out.set("utm_content",content)}
  var id=function(value){value=(value||"").trim();return /^\\d{1,20}$/.test(value)?value:""};
  var campaignId=id(u.searchParams.get("vmh_campaignid")||u.searchParams.get("campaignid"));
  var adGroupId=id(u.searchParams.get("vmh_adgroupid")||u.searchParams.get("adgroupid"));
  var adGroup=clean(u.searchParams.get("vmh_adgroup"));
  var keyword=clean(u.searchParams.get("vmh_keyword")||u.searchParams.get("keyword")||u.searchParams.get("utm_term"));
  if(campaignId){out.set("vmh_campaignid",campaignId)}if(adGroupId){out.set("vmh_adgroupid",adGroupId)}if(adGroup){out.set("vmh_adgroup",adGroup)}if(keyword){out.set("vmh_keyword",keyword)}
  var entry=landing==="/"?"/google-ads/home":"/google-ads"+landing;
  window.location.replace(entry+"?"+out.toString());
}catch(_){}})();`;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Turns a genuine Google click on `/` into the existing signed entry flow.
 * Unknown fields, actual search queries and contact-like values are never
 * forwarded. Google's advertiser-account matched keyword is allowlisted.
 */
export function googleAdsDirectEntryPath(
  pathname: string,
  searchParams: HomepageSearchParams,
): string | null {
  const normalizedPath = pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
  if (!(GOOGLE_ADS_DIRECT_ENTRY_PATHS as readonly string[]).includes(normalizedPath)) {
    return null;
  }
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
  const valueTrackInput = new URLSearchParams();
  for (const key of [
    ...GOOGLE_ADS_VALUE_TRACK_QUERY_KEYS,
    "campaignid",
    "adgroupid",
    "keyword",
    "utm_term",
  ]) {
    const value = first(searchParams[key]);
    if (value !== undefined) valueTrackInput.set(key, value);
  }
  const valueTrack = googleAdsValueTrackAttributionFromSearch(valueTrackInput.toString());
  if (valueTrack.campaignId) output.set("vmh_campaignid", valueTrack.campaignId);
  if (valueTrack.adGroupId) output.set("vmh_adgroupid", valueTrack.adGroupId);
  if (valueTrack.adGroupName) output.set("vmh_adgroup", valueTrack.adGroupName);
  if (valueTrack.keyword) output.set("vmh_keyword", valueTrack.keyword);
  const entryPath = normalizedPath === "/"
    ? "/google-ads/home"
    : `/google-ads${normalizedPath}`;
  return `${entryPath}?${output.toString()}`;
}

/** Backward-compatible server helper for the original homepage entry. */
export function googleAdsHomepageEntryPath(
  searchParams: HomepageSearchParams,
): string | null {
  return googleAdsDirectEntryPath("/", searchParams);
}
