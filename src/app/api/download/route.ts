import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

/**
 * Attempt to download a Google Drive file via the public export endpoint.
 * Works when the owner allows download. View-only restricted files return 403/HTML.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id || !/^[a-zA-Z0-9_-]{20,}$/.test(id)) {
    return NextResponse.json({ error: "Invalid file id" }, { status: 400 });
  }

  const urls = [
    `https://drive.google.com/uc?export=download&id=${id}`,
  ];

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/pdf,*/*",
  };

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(25000),
      });

      if (!res.ok) continue;

      const ct = res.headers.get("content-type") || "";
      if (ct.includes("text/html")) {
        const text = await res.text();
        const m = text.match(/href="(\/uc\?export=download[^"]+)"/);
        if (m) {
          const confirmUrl = "https://drive.google.com" + m[1].replace(/&/g, "&");
          const res2 = await fetch(confirmUrl, {
            headers,
            redirect: "follow",
            signal: AbortSignal.timeout(25000),
          });
          if (res2.ok) {
            const ct2 = res2.headers.get("content-type") || "";
            if (!ct2.includes("text/html")) {
              const buf = await res2.arrayBuffer();
              return new NextResponse(buf, {
                status: 200,
                headers: {
                  "Content-Type": ct2.includes("pdf") ? "application/pdf" : "application/octet-stream",
                  "Content-Disposition": `attachment; filename="${id}.pdf"`,
                  "Cache-Control": "private, max-age=60",
                },
              });
            }
          }
        }
        continue;
      }

      const buf = await res.arrayBuffer();
      if (buf.byteLength < 1000) continue;

      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type": ct.includes("pdf") ? "application/pdf" : "application/octet-stream",
          "Content-Disposition": `attachment; filename="${id}.pdf"`,
          "Cache-Control": "private, max-age=60",
        },
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json(
    {
      error: "File is view-only or restricted. Open in Google Drive and use Print to Save as PDF, or run the local Python downloader.",
      restricted: true,
    },
    { status: 403 }
  );
}
