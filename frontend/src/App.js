import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "sonner";
import { MorseGlyph } from "./components/MorseBits";
import LeftPane from "./components/LeftPane";
import CenterPane from "./components/CenterPane";
import RightPane from "./components/RightPane";
import CitationPanel from "./components/CitationPanel";
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

  // On mount: init session and load demo data if empty
  useEffect(() => {
    (async () => {
      try {
        const data = await api.initSession(sessionId, true);
        setFiles(data.files || []);
        setAccount("Brightline Analytics");
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
    setBrief(null);
    setChatLog([]);
    setPanelOpen(false);
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
    try {
      const data = await api.generateBrief(sessionId);
      setBrief(data.brief);
      setChunks(data.chunks || []);
      if (data.account) setAccount(data.account);
      toast.success("Brief decoded");
    } catch (e) {
      toast.error("Brief generation failed. " + (e?.response?.data?.detail || e.message || ""));
    } finally {
      setGenerating(false);
    }
  }, [files.length, sessionId]);

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
      {/* Top bar */}
      <header className="h-14 px-6 flex items-center gap-3 border-b border-[rgba(61,58,74,0.08)] bg-[#FAF7FB]/95 backdrop-blur-sm z-30 relative">
        <div className="flex items-center gap-3">
          <MorseGlyph />
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[19px] leading-none tracking-tight" data-testid="app-wordmark">
              Sales Morse
            </span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[rgba(61,58,74,0.5)]">
              Decode the account
            </span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden sm:inline font-mono text-[10.5px] uppercase tracking-[0.14em] text-[rgba(61,58,74,0.5)]">
            Session · {sessionId.slice(0, 12)}
          </span>
        </div>
      </header>

      {/* 3-pane workspace */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-[300px_1fr_1.35fr] min-h-0">
        <LeftPane
          files={files}
          onUpload={handleUpload}
          onDelete={handleDelete}
          onGenerate={handleGenerate}
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

      {!bootstrapped && (
        <div className="fixed inset-0 flex items-center justify-center bg-[#FAF7FB] z-50">
          <div className="text-center">
            <MorseGlyph />
            <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[rgba(61,58,74,0.55)]">
              Tuning in…
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
