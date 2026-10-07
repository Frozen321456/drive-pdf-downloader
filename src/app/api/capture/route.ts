import { NextRequest, NextResponse } from "next/server";
import { chromium as playwrightChromium } from "playwright-core";
import chromium from "@sparticuz/chromium";
import { PDFDocument } from "pdf-lib";

export const maxDuration = 300;
export const runtime = "nodejs";

/**
 * Full view-only Drive PDF capture (same idea as downloader.py):
 * open preview → intercept page images → scroll → dedupe → PDF
 */
export async function POST(req: NextRequest) {
  let browser = null as Awaited<ReturnType<typeof playwrightChromium.launch>> | null;

  try {
    const body = await req.json();
    const fileId = String(body.fileId || body.id || "").trim();
    const name =
      String(body.name || "document")
        .replace(/[\\/*?:"<>|]/g, "")
        .slice(0, 80) || "document";

    if (!fileId || !/^[a-zA-Z0-9_-]{20,}$/.test(fileId)) {
      return NextResponse.json({ error: "Invalid fileId" }, { status: 400 });
    }

    await chromium.setGraphicsMode(false);
    const executablePath = await chromium.executablePath();

    browser = await playwrightChromium.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();
    const capturedByUrl = new Map<string, Buffer>();

    page.on("response", async (response) => {
      try {
        const ct = response.headers()["content-type"] || "";
        const isImage =
          ct.includes("image/jpeg") ||
          ct.includes("image/png") ||
          ct.includes("image/webp");
        if (response.status() === 200 && isImage) {
          const bodyBuf = await response.body();
          if (bodyBuf.length > 10_000) {
            capturedByUrl.set(response.url(), Buffer.from(bodyBuf));
          }
        }
      } catch {
        /* ignore */
      }
    });

    await page.goto(`https://drive.google.com/file/d/${fileId}/view`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForTimeout(4000);

    const pageUrl = page.url();
    const pageTitle = await page.title();
    if (pageUrl.includes("accounts.google.com")) {
      return NextResponse.json(
        { error: "Requires Google login — file is private" },
        { status: 403 }
      );
    }
    if (/denied|not found/i.test(pageTitle)) {
      return NextResponse.json(
        { error: "Access denied or file not found" },
        { status: 404 }
      );
    }

    let stableRounds = 0;
    for (let i = 0; i < 120; i++) {
      const scrollBefore = await page.evaluate(scrollTopJs);
      await page.evaluate(scrollDownJs);
      await page.waitForTimeout(800);
      const scrollAfter = await page.evaluate(scrollTopJs);
      if (scrollAfter === scrollBefore) {
        stableRounds++;
        if (stableRounds >= 4) break;
      } else {
        stableRounds = 0;
      }
    }
    await page.waitForTimeout(2000);

    await page.close();
    await context.close();
    await browser.close();
    browser = null;

    if (capturedByUrl.size === 0) {
      return NextResponse.json(
        {
          error:
            "No page images captured. File may be restricted, empty, or Drive changed the viewer.",
        },
        { status: 422 }
      );
    }

    const pagesByNum = new Map<number, Buffer>();
    const unpageable: Buffer[] = [];

    for (const [url, img] of capturedByUrl) {
      try {
        const u = new URL(url);
        const pageParam = u.searchParams.get("page");
        if (pageParam != null) {
          const n = parseInt(pageParam, 10);
          if (!Number.isNaN(n)) {
            const prev = pagesByNum.get(n);
            if (!prev || img.length > prev.length) pagesByNum.set(n, img);
            continue;
          }
        }
      } catch {
        /* fall through */
      }
      unpageable.push(img);
    }

    let pageImages: Buffer[] = [];
    if (pagesByNum.size > 0) {
      const nums = [...pagesByNum.keys()].sort((a, b) => a - b);
      pageImages = nums.map((n) => pagesByNum.get(n)!);
    } else {
      const seen = new Set<string>();
      for (const img of unpageable) {
        const key = `${img.length}:${img.subarray(0, 64).toString("hex")}`;
        if (!seen.has(key)) {
          seen.add(key);
          pageImages.push(img);
        }
      }
    }

    if (pageImages.length === 0) {
      return NextResponse.json(
        { error: "No unique page images after dedup" },
        { status: 422 }
      );
    }

    const MAX_PAGES = 40;
    if (pageImages.length > MAX_PAGES) {
      pageImages = pageImages.slice(0, MAX_PAGES);
    }

    const pdfDoc = await PDFDocument.create();
    for (const imgBytes of pageImages) {
      try {
        let embedded;
        if (imgBytes[0] === 0xff && imgBytes[1] === 0xd8) {
          embedded = await pdfDoc.embedJpg(imgBytes);
        } else {
          embedded = await pdfDoc.embedPng(imgBytes);
        }
        const pdfPage = pdfDoc.addPage([embedded.width, embedded.height]);
        pdfPage.drawImage(embedded, {
          x: 0,
          y: 0,
          width: embedded.width,
          height: embedded.height,
        });
      } catch {
        /* skip bad image */
      }
    }

    if (pdfDoc.getPageCount() === 0) {
      return NextResponse.json(
        { error: "Could not build PDF from captured images" },
        { status: 500 }
      );
    }

    const pdfBytes = await pdfDoc.save();
    const filename = `${name}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Page-Count": String(pdfDoc.getPageCount()),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("capture error", err);
    return NextResponse.json(
      {
        error: "Capture failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
  }
}

const scrollTopJs = `() => {
  const findScrollContainer = () => {
    const doc = document.querySelector('[role="document"]');
    if (doc) {
      let parent = doc;
      while (parent) {
        if (parent.scrollHeight > parent.clientHeight + 10) {
          const style = window.getComputedStyle(parent);
          if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
            return parent;
          }
        }
        parent = parent.parentElement;
      }
    }
    const divs = Array.from(document.querySelectorAll('div'));
    let best = null;
    let maxScroll = 0;
    for (const div of divs) {
      if (div.scrollHeight > div.clientHeight + 50) {
        const style = window.getComputedStyle(div);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          if (div.scrollHeight > maxScroll) {
            maxScroll = div.scrollHeight;
            best = div;
          }
        }
      }
    }
    return best || document.documentElement;
  };
  const c = findScrollContainer();
  return c ? c.scrollTop : 0;
}`;

const scrollDownJs = `() => {
  const findScrollContainer = () => {
    const doc = document.querySelector('[role="document"]');
    if (doc) {
      let parent = doc;
      while (parent) {
        if (parent.scrollHeight > parent.clientHeight + 10) {
          const style = window.getComputedStyle(parent);
          if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
            return parent;
          }
        }
        parent = parent.parentElement;
      }
    }
    const divs = Array.from(document.querySelectorAll('div'));
    let best = null;
    let maxScroll = 0;
    for (const div of divs) {
      if (div.scrollHeight > div.clientHeight + 50) {
        const style = window.getComputedStyle(div);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          if (div.scrollHeight > maxScroll) {
            maxScroll = div.scrollHeight;
            best = div;
          }
        }
      }
    }
    return best || document.documentElement;
  };
  const c = findScrollContainer();
  if (c) c.scrollTop += c.clientHeight * 0.8;
}`;
