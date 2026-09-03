import {
  GOOGLE_ADS_CLICK_KEYS,
  googleAdsClickAttributionFromSearch,
} from "@/lib/campaignAttribution";
import {
  GOOGLE_ADS_AUTO_QUERY_KEYS,
  GOOGLE_ADS_VALUE_TRACK_QUERY_KEYS,
  googleAdsValueTrackAttributionFromSearch,
  hasGoogleAdsClickSignal,
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
 * optional Ads CRM attribution is skipped. `/welcome` additionally performs
 * this redirect on the server, so the inline script is only its fallback.
 */
const GOOGLE_ADS_DIRECT_ENTRY_PATHS_JSON = JSON.stringify(
  GOOGLE_ADS_DIRECT_ENTRY_PATHS,
);

export const GOOGLE_ADS_HOMEPAGE_ENTRY_BOOTSTRAP = `(function(){try{
  var u=new URL(window.location.href);
  var landing=u.pathname.length>1&&u.pathname.endsWith("/")?u.pathname.slice(0,-1):u.pathname;
  var allowed=${GOOGLE_ADS_DIRECT_ENTRY_PATHS_JSON};
  if(allowed.indexOf(landing)<0||new URLSearchParams(u.hash.slice(1)).has("vmh_ga")){return}
  var get=function(key){return u.searchParams.get(key)||""};
  var keys=["gclid","gbraid","wbraid"],out=new URLSearchParams(),has=false;
  for(var i=0;i<keys.length;i++){var value=get(keys[i]).replace(/[\\u0000-\\u001F\\u007F\\s]/g,"").slice(0,500);if(/^[A-Za-z0-9._~-]{6,500}$/.test(value)){out.set(keys[i],value);has=true}}
  var id=function(value){value=(value||"").trim();return /^\\d{1,20}$/.test(value)?value:""};
  var campaignId=id(get("vmh_campaignid")||get("campaignid")||get("gad_campaignid"));
  var adGroupId=id(get("vmh_adgroupid")||get("adgroupid"));
  var adsSource=get("gad_source")==="1";
  if(!has&&!adsSource&&!campaignId&&!adGroupId){return}
  var clean=function(value){value=(value||"").replace(/[\\u0000-\\u001F\\u007F]/g,"").replace(/\\s+/g," ").trim().slice(0,120);return value&&!/[@/?#&=\\\\]/.test(value)&&/^[\\p{L}\\p{N}][\\p{L}\\p{N} ._~:+()\\[\\]-]*$/u.test(value)?value:""};
  var text=function(value){return (value||"").replace(/[\\u0000-\\u001F\\u007F]/g,"").replace(/\\s+/g," ").trim().slice(0,120)};
  var campaign=clean(get("utm_campaign")),content=clean(get("utm_content"));
  if(campaign){out.set("utm_campaign",campaign)}if(content){out.set("utm_content",content)}
  if(adsSource){out.set("gad_source","1")}
  if(campaignId){out.set("vmh_campaignid",campaignId)}
  var campaignName=text(get("vmh_campaign"));if(campaignName){out.set("vmh_campaign",campaignName)}
  if(adGroupId){out.set("vmh_adgroupid",adGroupId)}
  var adGroup=text(get("vmh_adgroup"));if(adGroup){out.set("vmh_adgroup",adGroup)}
  var keyword=text(get("vmh_keyword")||get("keyword")||get("utm_term"));if(keyword){out.set("vmh_keyword",keyword)}
  var extra=["vmh_matchtype","vmh_network","vmh_device","vmh_creative"];
  for(var j=0;j<extra.length;j++){var e=text(get(extra[j])).slice(0,40);if(e){out.set(extra[j],e)}}
  var entry=landing==="/"?"/google-ads/home":"/google-ads"+landing;
  window.location.replace(entry+"?"+out.toString());
}catch(_){}})();`;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Turns a genuine Google click on an approved final URL into the existing
 * signed entry flow. Unknown fields, actual search queries and contact-like
 * values are never forwarded. Google's advertiser-account matched keyword and
 * the campaign ID Google appends itself are allowlisted.
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
  const signal = new URLSearchParams();
  for (const key of [
    ...GOOGLE_ADS_CLICK_KEYS,
    ...GOOGLE_ADS_AUTO_QUERY_KEYS,
    "vmh_campaignid",
    "vmh_adgroupid",
  ]) {
    const value = first(searchParams[key]);
    if (value) signal.set(key, value);
  }
  if (!hasGoogleAdsClickSignal(signal.toString())) return null;

  const output = new URLSearchParams(
    googleAdsClickAttributionFromSearch(signal.toString()),
  );
  const campaign = safeGoogleAdsCampaignIdentifier(first(searchParams.utm_campaign));
  const content = safeGoogleAdsCampaignIdentifier(first(searchParams.utm_content));
  if (campaign) output.set("utm_campaign", campaign);
  if (content) output.set("utm_content", content);
  if (first(searchParams.gad_source) === "1") output.set("gad_source", "1");
  const valueTrackInput = new URLSearchParams();
  for (const key of [
    ...GOOGLE_ADS_VALUE_TRACK_QUERY_KEYS,
    "gad_campaignid",
    "campaignid",
    "adgroupid",
    "keyword",
    "utm_term",
  ]) {
    const value = first(searchParams[key]);
    if (value !== undefined) valueTrackInput.set(key, value);
  }
  // `utm_term={keyword}` is an older advertiser convention for the same
  // account keyword; it is only read here on an already-qualified ad click.
  if (!valueTrackInput.get("vmh_keyword") && !valueTrackInput.get("keyword")) {
    const term = valueTrackInput.get("utm_term");
    if (term) valueTrackInput.set("vmh_keyword", term);
  }
  valueTrackInput.delete("utm_term");
  const valueTrack = googleAdsValueTrackAttributionFromSearch(valueTrackInput.toString());
  if (valueTrack.campaignId) output.set("vmh_campaignid", valueTrack.campaignId);
  if (valueTrack.campaignName) output.set("vmh_campaign", valueTrack.campaignName);
  if (valueTrack.adGroupId) output.set("vmh_adgroupid", valueTrack.adGroupId);
  if (valueTrack.adGroupName) output.set("vmh_adgroup", valueTrack.adGroupName);
  if (valueTrack.keyword) output.set("vmh_keyword", valueTrack.keyword);
  if (valueTrack.matchType) output.set("vmh_matchtype", valueTrack.matchType);
  if (valueTrack.network) output.set("vmh_network", valueTrack.network);
  if (valueTrack.device) output.set("vmh_device", valueTrack.device);
  if (valueTrack.creativeId) output.set("vmh_creative", valueTrack.creativeId);
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
