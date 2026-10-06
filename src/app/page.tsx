"use client";

import { useState } from "react";
import {
  Search, FileText, Loader2, ExternalLink, CheckCircle2,
  AlertCircle, Copy, BookOpen, Zap, Shield,
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

  async function handleScan() {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    setResults([]);
    setLogs([]);
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
        setError("No Google Drive PDFs found on the provided page(s).");
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
      setTimeout(() => window.open(r.viewUrl, "_blank"), i * 300);
    });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-card-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">DrivePDF</h1>
              <p className="text-xs text-muted">View-Only PDF Finder</p>
            </div>
          </div>
          <a href="https://github.com/Frozen321456/drive-pdf-downloader" target="_blank" rel="noopener noreferrer" className="text-sm text-muted hover:text-foreground transition-colors">
            GitHub
          </a>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-10">
        <section className="text-center mb-12 animate-fade-in">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3 bg-gradient-to-r from-blue-400 via-emerald-400 to-blue-400 bg-clip-text text-transparent">
            Find Restricted Google Drive PDFs
          </h2>
          <p className="text-muted max-w-xl mx-auto text-sm sm:text-base">
            Paste any educational page URL. We scan for unit/chapter links and extract all view-only Google Drive PDF IDs automatically.
          </p>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {[
            { icon: Zap, title: "Smart Crawl", desc: "Detects unit, chapter & section pages automatically" },
            { icon: Shield, title: "View-Only Support", desc: "Works with restricted Drive files that block download" },
            { icon: BookOpen, title: "Education Focused", desc: "Optimized for notes, textbooks & board materials" },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-card-border bg-card p-5 flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <f.icon className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-muted leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-card-border bg-card p-6 mb-8 shadow-xl shadow-black/20">
          <label className="block text-sm font-medium mb-2 text-muted">Page URL(s) or Drive link</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"https://example.com/class-10-english-notes\nhttps://drive.google.com/file/d/xxxxx/view\nOr paste multiple links..."}
            rows={4}
            className="w-full rounded-xl bg-background border border-card-border px-4 py-3 text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-y transition-all"
            disabled={loading}
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={handleScan}
              disabled={loading || !input.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-all shadow-lg shadow-blue-500/25"
            >
              {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Scanning...</>) : (<><Search className="w-4 h-4" /> Scan for PDFs</>)}
            </button>
            {results.length > 0 && (
              <button onClick={openAll} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-card-border hover:bg-white/5 text-sm font-medium transition-all">
                <ExternalLink className="w-4 h-4" /> Open All ({results.length})
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-start gap-3 animate-fade-in">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {results.length > 0 && (
          <section className="animate-fade-in">
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-accent" />
              {results.length} PDF{results.length !== 1 ? "s" : ""} found
            </h3>
            <div className="space-y-3">
              {results.map((r) => (
                <div key={r.fileId} className="rounded-xl border border-card-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:border-blue-500/40 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-red-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{r.name}</p>
                      <p className="text-xs text-muted truncate font-mono">{r.fileId}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => copyLink(r.viewUrl, r.fileId)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-card-border hover:bg-white/5 transition-colors">
                      {copied === r.fileId ? (<><CheckCircle2 className="w-3.5 h-3.5 text-accent" /> Copied</>) : (<><Copy className="w-3.5 h-3.5" /> Copy</>)}
                    </button>
                    <a href={r.viewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-primary/90 hover:bg-primary text-white transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" /> Open
                    </a>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-muted">
              <p className="font-medium text-amber-300/90 mb-1">How to download view-only PDFs</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Open the Drive link above</li>
                <li>Use a browser extension like Document Preview Exporter, or print to PDF (Ctrl/Cmd + P)</li>
                <li>Or run the original Python tool locally for fully automated capture</li>
              </ol>
            </div>
          </section>
        )}

        {logs.length > 0 && (
          <details className="mt-8 rounded-xl border border-card-border bg-card/50 overflow-hidden">
            <summary className="px-4 py-3 text-sm text-muted cursor-pointer hover:text-foreground">
              Scan log ({logs.length} entries)
            </summary>
            <div className="px-4 pb-4 font-mono text-xs text-muted space-y-1 max-h-48 overflow-y-auto">
              {logs.map((l, i) => (<div key={i}>{l}</div>))}
            </div>
          </details>
        )}
      </main>

      <footer className="border-t border-card-border py-6 text-center text-xs text-muted">
        <p>Built for educational use · Powered by Next.js + Vercel · Not affiliated with Google</p>
      </footer>
    </div>
  );
}
