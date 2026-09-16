import keywordMap from "@/lib/paidSearchKeywordMap.json";
import { conceptFinalPath } from "@/lib/paidSearchConcepts";

export function GET() {
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const rows = [
    ["Ad group", "Keyword", "Match type", "Proposed final URL (after approval)", "Preview path"],
    ...keywordMap.map((keyword) => [keyword.adGroup, keyword.keyword, keyword.matchType,
      `https://valisenmentalhealth.com${conceptFinalPath(keyword.slug)}`, `/ads-preview/${keyword.slug}`]),
  ];
  return new Response("\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="valisen-proposed-keyword-urls.csv"', "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
