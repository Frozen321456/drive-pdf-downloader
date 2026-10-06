"use client";

import { useState } from "react";
import {
  Search, FileText, Loader2, ExternalLink, CheckCircle2,
  AlertCircle, Copy, Download, BookOpen, Zap, Shield,
  Link2, ArrowRight, Sparkles,
} from "lucide-react";

interface DriveResult {
  sourceUrl: string;
  name: string;
  fileId: string;
  viewUrl: string;
}

export default function Home() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DriveResult[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [dlMsg, setDlMsg] = useState<Record<string, string>>({});

  async function handleScan() {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    setResults([]);
    setLogs([]);
    setDlMsg({});
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: input }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Scan failed");
        return;
      }
      setResults(data.results || []);
      setLogs(data.logs || []);
      if ((data.results || []).length === 0) {
        setError("No Google Drive PDFs found. Try a different page URL.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function copyLink(url: string, id: string) {
    navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  function openAll() {
    results.forEach((r, i) => {
      setTimeout(() => window.open(r.viewUrl, "_blank"), i * 250);
    });
  }

  async function tryDownload(r: DriveResult) {
    setDownloading(r.fileId);
    setDlMsg((m) => ({ ...m, [r.fileId]: "" }));
    try {
      const res = await fetch(`/api/download?id=${encodeURIComponent(r.fileId)}`);
      if (res.ok) {
        const blob = await res.blob();
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("pdf") || ct.includes("octet-stream") || blob.size > 5000) {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `${r.name || "document"}.pdf`;
          a.click();
          URL.revokeObjectURL(a.href);
          setDlMsg((m) => ({ ...m, [r.fileId]: "ok" }));
          return;
        }
      }
      setDlMsg((m) => ({ ...m, [r.fileId]: "restricted" }));
      window.open(r.viewUrl, "_blank");
    } catch {
      setDlMsg((m) => ({ ...m, [r.fileId]: "restricted" }));
      window.open(r.viewUrl, "_blank");
    } finally {
      setDownloading(null);
    }
  }

  async function downloadAll() {
    for (const r of results) {
      await tryDownload(r);
      await new Promise((x) => setTimeout(x, 600));
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border glass">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue to-purple flex items-center justify-center shadow-lg shadow-blue/25">
              <FileText size={18} className="text-white" />
            </div>
            <div>
              <div className="font-semibold text-sm tracking-tight">DrivePDF</div>
              <div className="text-[10px] text-muted leading-none">View-Only Finder</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge badge-blue hidden sm:inline-flex">
              <Sparkles size={12} /> Free Tool
            </span>
            <a href="https://github.com/Frozen321456/drive-pdf-downloader" target="_blank" rel="noreferrer" className="text-xs text-muted hover:text-text transition-colors">
              GitHub
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-10 sm:py-14">
        <section className="text-center mb-12 fade-up">
          <div className="inline-flex items-center gap-2 badge badge-blue mb-5">
            <Zap size={12} /> Educational notes · Restricted PDFs
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4 leading-[1.15]">
            Find & access{" "}
            <span className="bg-gradient-to-r from-blue via-purple to-green bg-clip-text text-transparent">
              Google Drive PDFs
            </span>
          </h1>
          <p className="text-muted max-w-lg mx-auto text-sm sm:text-base leading-relaxed">
            Paste any notes / textbook page URL. We crawl unit pages, extract Drive links, and help you open or download them.
          </p>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10 fade-up-1">
          {[
            { n: "1", icon: Link2, t: "Paste URL", d: "Educational page or Drive link" },
            { n: "2", icon: Search, t: "Auto scan", d: "Finds all Drive PDF IDs" },
            { n: "3", icon: Download, t: "Open / Download", d: "Direct if allowed, else viewer" },
          ].map((s) => (
            <div key={s.n} className="glass rounded-2xl p-4 flex items-start gap-3">
              <div className="step-num">{s.n}</div>
              <div>
                <div className="text-sm font-semibold mb-0.5 flex items-center gap-1.5">
                  <s.icon size={14} className="text-blue" /> {s.t}
                </div>
                <div className="text-xs text-muted">{s.d}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="glass rounded-2xl p-5 sm:p-6 mb-8 fade-up-2 shadow-2xl shadow-black/40">
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            Page URL(s) or Drive link
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleScan();
            }}
            placeholder={"https://example.com/class-10-english-notes\nhttps://drive.google.com/file/d/xxxxx/view"}
            rows={3}
            className="input-area mb-4"
            disabled={loading}
          />
          <div className="flex flex-wrap gap-2.5">
            <button onClick={handleScan} disabled={loading || !input.trim()} className="btn-primary inline-flex items-center gap-2 text-sm">
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Scanning pages…</>
              ) : (
                <><Search size={16} /> Scan for PDFs</>
              )}
            </button>
            {results.length > 0 && (
              <>
                <button onClick={downloadAll} className="btn-ghost inline-flex items-center gap-2 text-sm">
                  <Download size={16} /> Try download all
                </button>
                <button onClick={openAll} className="btn-ghost inline-flex items-center gap-2 text-sm">
                  <ExternalLink size={16} /> Open all
                </button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red/30 bg-red/10 px-4 py-3 flex gap-3 fade-up">
            <AlertCircle size={18} className="text-red shrink-0 mt-0.5" />
            <p className="text-sm text-red/90">{error}</p>
          </div>
        )}

        {results.length > 0 && (
          <section className="fade-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <CheckCircle2 size={18} className="text-green" />
                {results.length} PDF{results.length !== 1 ? "s" : ""} found
              </h2>
              <span className="badge badge-green">{results.length} files</span>
            </div>

            <div className="space-y-2.5 mb-6">
              {results.map((r) => (
                <div key={r.fileId} className="result-row flex-col sm:flex-row">
                  <div className="flex items-center gap-3 flex-1 min-w-0 w-full">
                    <div className="w-10 h-10 rounded-xl bg-red/10 border border-red/20 flex items-center justify-center shrink-0">
                      <FileText size={18} className="text-red" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{r.name}</p>
                      <p className="text-[11px] text-muted font-mono truncate">{r.fileId}</p>
                      {dlMsg[r.fileId] === "restricted" && (
                        <p className="text-[11px] text-amber mt-0.5">View-only · opened in Drive viewer</p>
                      )}
                      {dlMsg[r.fileId] === "ok" && (
                        <p className="text-[11px] text-green mt-0.5">Downloaded successfully</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                    <button onClick={() => copyLink(r.viewUrl, r.fileId)} className="btn-ghost !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5">
                      {copied === r.fileId ? <><CheckCircle2 size={13} className="text-green" /> Copied</> : <><Copy size={13} /> Copy</>}
                    </button>
                    <button onClick={() => tryDownload(r)} disabled={downloading === r.fileId} className="btn-ghost !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5">
                      {downloading === r.fileId ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                      Download
                    </button>
                    <a href={r.viewUrl} target="_blank" rel="noreferrer" className="btn-primary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5 !shadow-md">
                      <ExternalLink size={13} /> Open
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <div className="glass rounded-2xl p-5 border-amber/20">
              <div className="flex gap-3">
                <Shield size={18} className="text-amber shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-amber mb-1.5">About view-only PDFs</p>
                  <ul className="text-xs text-muted space-y-1.5 leading-relaxed">
                    <li className="flex gap-2"><ArrowRight size={12} className="shrink-0 mt-0.5 text-blue" /> <span><b className="text-text">Download</b> tries Google export. Works if the owner allows download.</span></li>
                    <li className="flex gap-2"><ArrowRight size={12} className="shrink-0 mt-0.5 text-blue" /> <span><b className="text-text">View-only files</b> cannot be auto-downloaded on the web. Open then Print → Save as PDF, or use the Python Playwright tool.</span></li>
                    <li className="flex gap-2"><ArrowRight size={12} className="shrink-0 mt-0.5 text-blue" /> <span>Full automated capture needs a desktop browser engine — that is what <code className="text-purple text-[11px]">downloader.py</code> does locally.</span></li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        )}

        {results.length === 0 && !loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 fade-up-3 mt-4">
            {[
              { icon: Zap, t: "Smart crawl", d: "Detects unit, chapter, nazam, grammar pages automatically from education sites." },
              { icon: BookOpen, t: "Batch scan", d: "Paste multiple URLs or a whole subject index — finds every Drive PDF ID." },
              { icon: Shield, t: "Restricted aware", d: "Handles view-only files: open in Drive or use local Playwright for full capture." },
            ].map((f) => (
              <div key={f.t} className="glass rounded-2xl p-5">
                <div className="w-10 h-10 rounded-xl bg-blue/10 flex items-center justify-center mb-3">
                  <f.icon size={18} className="text-blue" />
                </div>
                <h3 className="font-semibold text-sm mb-1">{f.t}</h3>
                <p className="text-xs text-muted leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
        )}

        {logs.length > 0 && (
          <details className="mt-8 glass rounded-xl overflow-hidden">
            <summary className="px-4 py-3 text-xs text-muted cursor-pointer hover:text-text">
              Scan log · {logs.length} entries
            </summary>
            <div className="px-4 pb-4 font-mono text-[11px] text-muted space-y-1 max-h-40 overflow-y-auto">
              {logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </details>
        )}
      </main>

      <footer className="border-t border-border py-6 text-center text-[11px] text-muted">
        Educational use · Next.js + Vercel · Not affiliated with Google
      </footer>
    </div>
  );
}
