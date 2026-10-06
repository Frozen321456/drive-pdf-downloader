import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { extractDriveIds, deriveNameFromUrl, isValidUrl, naturalSortKey } from "@/lib/utils";

export const maxDuration = 30;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

const UNIT_RE =
  /(unit|chapter|chap|lec|lecture|exercise|part|lesson|story|stories|essay|essays|letter|letters|application|applications|dialogue|dialogues|nazam|nazm|ghazal|gazal|nasar|nasr|grammar|qawaid|khulasa|khatoot|mukalma|kahani|darkhwast|rubaiyat|qataat|poetry|prose|comprehension|mcq|mcqs)/i;

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractLinks(html: string, baseUrl: string): { href: string; text: string }[] {
  const $ = cheerio.load(html);
  const domain = new URL(baseUrl).hostname;
  const seen = new Set<string>();
  const links: { href: string; text: string }[] = [];

  $("a[href]").each((_, el) => {
    let href = $(el).attr("href");
    if (!href) return;
    try {
      href = new URL(href, baseUrl).href.split("#")[0].split("?")[0];
    } catch {
      return;
    }
    if (!href.startsWith("http") || !href.includes(domain)) return;
    if (seen.has(href)) return;
    seen.add(href);
    const text = $(el).text().replace(/\s+/g, " ").trim();
    links.push({ href, text });
  });

  return links;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = (body.url || body.urls || "").toString().trim();

    if (!input) {
      return NextResponse.json({ error: "URL required" }, { status: 400 });
    }

    const urlMatches = input.match(/https?:\/\/[^\s)\]"'<>]+/g) || [];
    const bareId = input.match(/^[a-zA-Z0-9_-]{25,}$/);
    const urls: string[] = [];

    if (bareId) {
      urls.push(`https://drive.google.com/file/d/${bareId[0]}/view`);
    }
    for (const u of urlMatches) {
      const cleaned = u.replace(/[.,;)]+$/, "");
      if (isValidUrl(cleaned) && !urls.includes(cleaned)) urls.push(cleaned);
    }

    if (urls.length === 0) {
      return NextResponse.json({ error: "No valid URLs found" }, { status: 400 });
    }

    const results: {
      sourceUrl: string;
      name: string;
      fileId: string;
      viewUrl: string;
    }[] = [];
    const seenIds = new Set<string>();
    const pagesToScan = new Set<string>();
    const logs: string[] = [];

    for (const item of urls) {
      const driveMatch =
        item.match(/\/d\/([a-zA-Z0-9_-]{25,})/) ||
        item.match(/id=([a-zA-Z0-9_-]{25,})/);
      if (driveMatch || item.includes("drive.google.com")) {
        const id = driveMatch ? driveMatch[1] : null;
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          results.push({
            sourceUrl: item,
            name: `drive-doc-${results.length + 1}`,
            fileId: id,
            viewUrl: `https://drive.google.com/file/d/${id}/view`,
          });
          logs.push(`Direct Drive ID found: ${id}`);
        }
        continue;
      }

      logs.push(`Fetching: ${item}`);
      const html = await fetchPage(item);
      if (!html) {
        logs.push(`Failed to fetch: ${item}`);
        pagesToScan.add(item);
        continue;
      }

      const idsOnPage = extractDriveIds(html);
      for (const id of idsOnPage) {
        if (!seenIds.has(id)) {
          seenIds.add(id);
          results.push({
            sourceUrl: item,
            name: deriveNameFromUrl(item),
            fileId: id,
            viewUrl: `https://drive.google.com/file/d/${id}/view`,
          });
        }
      }
      if (idsOnPage.length) {
        logs.push(`Found ${idsOnPage.length} Drive ID(s) on page`);
      }

      const links = extractLinks(html, item);
      const unitLinks = links.filter(
        (l) => UNIT_RE.test(l.href) || UNIT_RE.test(l.text)
      );

      if (unitLinks.length > 0) {
        logs.push(`Found ${unitLinks.length} unit/section links`);
        for (const l of unitLinks.slice(0, 40)) {
          pagesToScan.add(l.href);
        }
      } else {
        for (const l of links.slice(0, 15)) {
          if (!l.href.includes("facebook") && !l.href.includes("twitter")) {
            pagesToScan.add(l.href);
          }
        }
      }
    }

    const pageList = Array.from(pagesToScan).slice(0, 25);
    logs.push(`Scanning ${pageList.length} content pages...`);

    const scanPromises = pageList.map(async (pageUrl) => {
      const html = await fetchPage(pageUrl);
      if (!html) return;
      const ids = extractDriveIds(html);
      for (const id of ids) {
        if (!seenIds.has(id)) {
          seenIds.add(id);
          results.push({
            sourceUrl: pageUrl,
            name: deriveNameFromUrl(pageUrl),
            fileId: id,
            viewUrl: `https://drive.google.com/file/d/${id}/view`,
          });
        }
      }
    });

    await Promise.all(scanPromises);

    results.sort((a, b) => {
      const ka = naturalSortKey(a.name);
      const kb = naturalSortKey(b.name);
      for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
        const x = ka[i] ?? "";
        const y = kb[i] ?? "";
        if (x < y) return -1;
        if (x > y) return 1;
      }
      return 0;
    });

    return NextResponse.json({
      success: true,
      count: results.length,
      results,
      logs,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Internal server error", details: String(err) },
      { status: 500 }
    );
  }
}
