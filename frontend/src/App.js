import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "sonner";
import { MorseGlyph } from "./components/MorseBits";
import LeftPane from "./components/LeftPane";
import CenterPane from "./components/CenterPane";
import RightPane from "./components/RightPane";
import CitationPanel from "./components/CitationPanel";
import FilePreviewModal from "./components/FilePreviewModal";
import { api } from "./lib/api";
import "./App.css";

function getSessionId() {
  const KEY = "sales_morse_session";
  let s = sessionStorage.getItem(KEY);
  if (!s) {
    s = `sess-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    sessionStorage.setItem(KEY, s);
  }
  return s;
}

export default function App() {
  const sessionId = useMemo(getSessionId, []);
  const [files, setFiles] = useState([]);
  const [chunks, setChunks] = useState([]);
  const [brief, setBrief] = useState(null);
  const [account, setAccount] = useState(null);
  const [chatLog, setChatLog] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeInsight, setActiveInsight] = useState(null);
  const [activeChunkKey, setActiveChunkKey] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  // On mount: init session with no files (empty state by default)
  useEffect(() => {
    (async () => {
      try {
        const data = await api.initSession(sessionId, false);
        setFiles(data.files || []);
      } catch (e) {
        toast.error("Could not initialize session.");
      } finally {
        setBootstrapped(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpload = useCallback(async (fileList) => {
    const data = await api.uploadFiles(sessionId, fileList);
    setFiles(data.files || []);
    // sources changed → invalidate brief, keep sources union (backend already appends)
    setBrief(null);
    setChatLog([]);
    setPanelOpen(false);
  }, [sessionId]);

  const handleLoadDemo = useCallback(async (accountId = "brightline") => {
    try {
      const data = await api.loadDemo(sessionId, accountId);
      setFiles(data.files || []);
      // Set account name from data if possible; otherwise pretty-print id
      const acctPretty = { brightline: "Brightline Analytics", nimbus: "Nimbus DevOps", zenith: "Zenith Retail" };
      setAccount(acctPretty[accountId] || acctPretty.brightline);
      toast.success(`${acctPretty[accountId] || "Demo"} loaded`);
    } catch (e) {
      toast.error("Could not load demo files.");
    }
  }, [sessionId]);

  const handlePreview = useCallback(async (file) => {
    try {
      const data = await api.getFileContent(sessionId, file.id);
      setPreviewFile({ ...file, content: data.content, source_label: data.source_label });
    } catch (e) {
      toast.error("Could not open file preview.");
    }
  }, [sessionId]);

  const handleDownload = useCallback((file) => {
    const url = api.downloadUrl(sessionId, file.id);
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    a.download = file.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [sessionId]);

  const handleDelete = useCallback(async (fileId) => {
    const data = await api.deleteFile(sessionId, fileId);
    setFiles(data.files || []);
    setBrief(null);
    setChatLog([]);
    setPanelOpen(false);
    toast.success("Source removed");
  }, [sessionId]);

  const handleGenerate = useCallback(async () => {
    if (files.length === 0) return;
    setGenerating(true);
    setPanelOpen(false);
    setBrief({ overall_confidence: 0, sections: [] }); // prime for streaming render
    try {
      const url = api.streamBriefUrl(sessionId);
      const resp = await fetch(url, { method: "GET" });
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // parse SSE frames
        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const lines = frame.split("\n");
          let event = "message";
          let data = "";
          for (const ln of lines) {
            if (ln.startsWith("event:")) event = ln.slice(6).trim();
            else if (ln.startsWith("data:")) data += ln.slice(5).trim();
          }
          if (!data) continue;
          try {
            const payload = JSON.parse(data);
            if (event === "meta") {
              setChunks(payload.chunks || []);
              if (payload.account) setAccount(payload.account);
            } else if (event === "section") {
              setBrief((prev) => {
                const secs = prev?.sections || [];
                // dedupe on id
                const withoutSame = secs.filter((s) => s.id !== payload.id);
                const merged = [...withoutSame, payload];
                const confs = merged.map((s) => s.section_confidence || 0);
                const overall = confs.reduce((a, b) => a + b, 0) / confs.length;
                return { overall_confidence: overall, sections: merged };
              });
            } else if (event === "done") {
              setBrief((prev) => prev ? { ...prev, overall_confidence: payload.overall_confidence ?? prev.overall_confidence } : prev);
            }
          } catch { /* skip malformed */ }
        }
      }
      toast.success("Brief decoded");
    } catch (e) {
      toast.error("Brief generation failed. " + (e?.message || ""));
      setBrief(null);
    } finally {
      setGenerating(false);
    }
  }, [files.length, sessionId]);

  const handleExportPdf = useCallback(() => {
    // Close citation panel so it doesn't overlap the print viewport / export button
    setPanelOpen(false);
    setActiveChunkKey(null);
    // Small delay so React commits the panel-close before print snapshot
    setTimeout(() => window.print(), 50);
  }, []);

  const handleSend = useCallback(async (question) => {
    setChatLog((prev) => [...prev, { role: "user", text: question }]);
    setSending(true);
    try {
      const data = await api.chat(sessionId, question);
      setChunks(data.chunks || chunks);
      setChatLog((prev) => [...prev, { role: "assistant", reply: data.reply }]);
    } catch (e) {
      setChatLog((prev) => [...prev, {
        role: "assistant",
        reply: { insufficient: true, reason: "Something went wrong. " + (e?.response?.data?.detail || e.message || "") },
      }]);
    } finally {
      setSending(false);
    }
  }, [sessionId, chunks]);

  const openCitation = useCallback((insight, key) => {
    setActiveInsight(insight);
    setActiveChunkKey(key);
    setPanelOpen(true);
  }, []);

  const closeCitation = useCallback(() => {
    setPanelOpen(false);
    setActiveChunkKey(null);
  }, []);

  const handleFeedback = useCallback(async (vote, comment) => {
    await api.feedback(sessionId, vote, comment);
  }, [sessionId]);

  const hasFiles = files.length > 0;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#FAF7FB] text-[#3D3A4A]">
      {/* 3-pane workspace */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-[360px_1fr_1.35fr] min-h-0">
        <LeftPane
          files={files}
          onUpload={handleUpload}
          onDelete={handleDelete}
          onGenerate={handleGenerate}
          onLoadDemo={handleLoadDemo}
          onPreview={handlePreview}
          onDownload={handleDownload}
          generating={generating}
          canGenerate={hasFiles}
        />
        <CenterPane
          hasFiles={hasFiles}
          brief={brief}
          chatLog={chatLog}
          onSend={handleSend}
          sending={sending}
          onCite={openCitation}
          activeChunkKey={activeChunkKey}
          account={account}
        />
        <div className="relative min-h-0 overflow-hidden">
          <RightPane
            brief={brief}
            onCite={openCitation}
            activeChunkKey={activeChunkKey}
            onFeedback={handleFeedback}
            account={account}
            streaming={generating}
            chunks={chunks}
            onExportPdf={handleExportPdf}
          />
          <CitationPanel
            open={panelOpen}
            insight={activeInsight}
            chunks={chunks}
            onClose={closeCitation}
          />
        </div>
      </main>

      <Toaster
        richColors
        position="bottom-right"
        toastOptions={{
          style: { background: "#FAF7FB", color: "#3D3A4A", border: "1px solid rgba(61,58,74,0.1)", borderRadius: "14px", fontFamily: "'Figtree', sans-serif" },
        }}
      />

      <FilePreviewModal
        open={!!previewFile}
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onDownload={handleDownload}
      />

      {!bootstrapped && (
        <div className="fixed inset-0 flex items-center justify-center bg-[#FAF7FB] z-50">
          <div className="text-center">
            <MorseGlyph />
            <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[rgba(61,58,74,0.55)]">
              Tuning in…
            </div>
          </div>
        </div>
      )}    </div>
  );
}
