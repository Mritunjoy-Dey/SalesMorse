import React, { useEffect, useRef, useState } from "react";
import { Upload, FileText, Mail, Phone, File as FileIcon, X, Sparkles, Download, ArrowUp } from "lucide-react";
import { SOURCE_DOT_COLOR, DotDash } from "./MorseBits";
import { toast } from "sonner";
import { api } from "../lib/api";

const iconFor = (type) => {
  const p = { size: 13, strokeWidth: 1.7 };
  if (type === "crm") return <FileText {...p} />;
  if (type === "email") return <Mail {...p} />;
  if (type === "transcript") return <Phone {...p} />;
  return <FileIcon {...p} />;
};

function timeAgo(iso) {
  try {
    const then = new Date(iso).getTime();
    const diff = Math.max(0, (Date.now() - then) / 1000);
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return "";
  }
}

function BrandHeader() {
  return (
    <div className="pt-6 pb-4 px-6 border-b border-[rgba(61,58,74,0.08)]">
      <div className="flex items-center gap-2 mb-1">
        <span aria-hidden className="inline-flex items-center gap-[3px]">
          <span className="block w-2 h-[3px] rounded bg-[#3D3A4A]" />
          <span className="block w-2 h-[3px] rounded bg-[#3D3A4A]" />
          <span className="block w-2 h-[3px] rounded bg-[#3D3A4A]" />
          <span className="block w-3 h-[3px] rounded bg-[#3D3A4A]" />
          <span className="block w-3 h-[3px] rounded bg-[#3D3A4A]" />
        </span>
        <h1 className="font-display text-[22px] leading-none tracking-tight text-[#3D3A4A]" data-testid="app-wordmark">
          Sales Morse
        </h1>
      </div>
      <div className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-[rgba(61,58,74,0.55)]">
        Decode the account
      </div>
    </div>
  );
}

export default function LeftPane({
  files,
  onUpload,
  onDelete,
  onGenerate,
  onLoadDemo,
  onPreview,
  onDownload,
  generating,
  canGenerate,
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    api.listDemoAccounts().then((d) => setAccounts(d.accounts || [])).catch(() => {});
  }, []);

  const loadedFileIds = new Set(files.map((f) => f.id));
  const accountsWithState = accounts.map((a) => ({
    ...a,
    fully_loaded: a.file_ids.every((id) => loadedFileIds.has(id)),
  }));
  // Hide the "Try with demo files" button as soon as ANY file is loaded (upload or demo).
  // It reappears only when the Loaded Files list is empty again.
  const showDemoButton = files.length === 0;

  const handleFiles = async (list) => {
    if (!list || list.length === 0) return;
    const accepted = Array.from(list).filter((f) => {
      const n = f.name.toLowerCase();
      return n.endsWith(".txt") || n.endsWith(".md") || n.endsWith(".pdf") || n.endsWith(".docx");
    });
    if (accepted.length === 0) {
      toast.error("Only PDF, DOCX, and TXT files are accepted.");
      return;
    }
    if (accepted.length !== list.length) {
      toast.warning("Some files were skipped (unsupported type).");
    }
    try {
      await onUpload(accepted);
      toast.success(`${accepted.length} file${accepted.length > 1 ? "s" : ""} added`);
    } catch (e) {
      toast.error("Upload failed. " + (e?.response?.data?.detail || e.message || ""));
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handlePickAccount = async (accountId) => {
    setPickerOpen(false);
    await onLoadDemo(accountId);
  };

  return (
    <aside
      className="flex flex-col h-full border-r border-[rgba(61,58,74,0.08)] bg-[#FAF7FB]"
      data-testid="left-pane"
    >
      <BrandHeader />

      {/* ADD SOURCES */}
      <div className="px-6 pt-5">
        <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-[rgba(61,58,74,0.55)] mb-3">
          Add sources
        </div>
        <div
          role="button"
          tabIndex={0}
          data-testid="upload-dropzone"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={
            "rounded-2xl border border-dashed p-6 text-center transition-colors cursor-pointer " +
            (dragOver
              ? "border-[#6C63FF] bg-[#EEECFF]"
              : "border-[rgba(108,99,255,0.35)] bg-white hover:bg-[#F5F3FF]")
          }
        >
          <div className="mx-auto mb-3 w-9 h-9 rounded-full bg-[#EEECFF] flex items-center justify-center">
            <ArrowUp size={16} strokeWidth={2} className="text-[#6C63FF]" />
          </div>
          <div className="text-[14px] text-[#3D3A4A] font-medium">Drop files or click to browse</div>
          <div className="mt-1 text-[11px] font-mono uppercase tracking-[0.16em] text-[rgba(61,58,74,0.5)]">PDF · DOCX · TXT</div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md"
            className="hidden"
            data-testid="upload-file-input"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>

      {/* LOADED FILES */}
      <div className="px-6 pt-5 flex items-center gap-2">
        <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-[rgba(61,58,74,0.55)]">Loaded files</span>
        <span className="ml-auto text-[11px] font-mono text-[rgba(61,58,74,0.45)]" data-testid="loaded-files-count">
          {files.length}
        </span>
      </div>

      {/* Empty state */}
      {files.length === 0 && (
        <div className="px-6 pt-3">
          <div
            className="rounded-2xl bg-white border border-[rgba(61,58,74,0.08)] px-4 py-5 text-center"
            data-testid="loaded-files-empty"
          >
            <div className="text-[13px] text-[#3D3A4A] font-medium">No files loaded</div>
            <div className="text-[11.5px] text-[rgba(61,58,74,0.55)] mt-0.5">Upload assets or try demo data</div>
          </div>
        </div>
      )}

      {/* OR → Try with demo files (only when no files loaded) */}
      {showDemoButton && (
        <div className="px-6 pt-3 flex items-center gap-2 relative">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[rgba(61,58,74,0.45)]">
            or
          </span>
          <span aria-hidden className="text-[rgba(61,58,74,0.3)]">→</span>
          <button
            type="button"
            data-testid="load-demo-button"
            onClick={() => setPickerOpen((v) => !v)}
            title="Load a demo account"
            className="ml-auto inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 bg-[#EEECFF] hover:bg-[#E1DEFF] text-[#6C63FF] text-[12.5px] font-medium transition-colors active:scale-[0.98]"
          >
            <Sparkles size={13} strokeWidth={2} />
            Try with demo files
          </button>
          {pickerOpen && (
            <div
              className="absolute right-6 top-[calc(100%+6px)] z-30 w-[260px] rounded-2xl bg-white border border-[rgba(61,58,74,0.08)] shadow-[0_16px_40px_rgba(61,58,74,0.14)] p-2"
              data-testid="demo-account-menu"
              onMouseLeave={() => setPickerOpen(false)}
            >
              {accountsWithState.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  disabled={a.fully_loaded}
                  onClick={() => handlePickAccount(a.id)}
                  data-testid={`demo-account-${a.id}`}
                  className={
                    "w-full text-left rounded-xl px-3 py-2.5 transition-colors " +
                    (a.fully_loaded
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-[#F5F3FF] cursor-pointer")
                  }
                >
                  <div className="text-[13px] text-[#3D3A4A] font-medium flex items-center gap-2">
                    {a.name}
                    {a.fully_loaded && (
                      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[rgba(61,58,74,0.5)]">
                        loaded
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[rgba(61,58,74,0.6)] mt-0.5">{a.tagline}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* File list */}
      <div className="px-6 pt-3 flex-1 overflow-y-auto sm-scroll" data-testid="file-list">
        <div className="flex flex-col gap-2">
          {files.map((f) => (
            <div
              key={f.id}
              role="button"
              tabIndex={0}
              onClick={() => onPreview(f)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onPreview(f)}
              className="group flex items-center gap-3 rounded-2xl bg-white border border-[rgba(61,58,74,0.08)] hover:border-[rgba(108,99,255,0.30)] hover:bg-[#FBFAFF] px-3 py-2.5 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]/40"
              data-testid={`file-item-${f.id}`}
              aria-label={`Preview ${f.filename}`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: SOURCE_DOT_COLOR[f.source_type] || SOURCE_DOT_COLOR.doc }}
                aria-hidden
              />
              <span className="shrink-0 w-7 h-7 rounded-lg bg-[#F0E9F5] flex items-center justify-center text-[#3D3A4A]">
                {iconFor(f.source_type)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[13px] text-[#3D3A4A] truncate">
                  <span className="truncate font-medium" title={f.filename}>{f.filename}</span>
                </div>
                <div className="text-[10.5px] font-mono text-[rgba(61,58,74,0.55)] uppercase tracking-[0.12em] truncate">
                  {f.source_label} · {timeAgo(f.uploaded_at)}
                </div>
              </div>
              {f.is_demo && (
                <span
                  className="shrink-0 rounded-md px-1 py-[1px] font-mono text-[9px] uppercase tracking-[0.14em] bg-[#F0E9F5] text-[rgba(61,58,74,0.7)]"
                  data-testid={`demo-badge-${f.id}`}
                >
                  demo
                </span>
              )}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                <button
                  type="button"
                  data-testid={`download-file-${f.id}`}
                  onClick={(e) => { e.stopPropagation(); onDownload(f); }}
                  className="p-1 rounded-md hover:bg-[rgba(61,58,74,0.06)]"
                  aria-label="Download file"
                  title="Download"
                >
                  <Download size={13} strokeWidth={1.6} />
                </button>
                <button
                  type="button"
                  data-testid={`delete-file-${f.id}`}
                  onClick={(e) => { e.stopPropagation(); onDelete(f.id); }}
                  className="p-1 rounded-md hover:bg-[rgba(61,58,74,0.06)]"
                  aria-label="Remove file"
                  title="Remove"
                >
                  <X size={14} strokeWidth={1.6} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Generate Brief */}
      <div className="p-6 pt-4">
        <button
          type="button"
          data-testid="generate-brief-button"
          disabled={!canGenerate || generating}
          onClick={onGenerate}
          className={
            "w-full rounded-full px-4 py-3.5 text-[14px] font-medium transition-all flex items-center justify-center gap-2 " +
            (canGenerate && !generating
              ? "bg-[#6C63FF] text-white hover:bg-[#5A50F0] active:scale-[0.98] shadow-[0_10px_28px_rgba(108,99,255,0.35)]"
              : "bg-[rgba(108,99,255,0.15)] text-[rgba(61,58,74,0.4)] cursor-not-allowed")
          }
        >
          {generating ? (
            <>
              <DotDash score={0.6} animate size={7} />
              <span className="font-mono text-[11px] uppercase tracking-widest">Decoding…</span>
            </>
          ) : (
            <>
              <Sparkles size={16} strokeWidth={1.8} />
              <span>Generate Brief</span>
            </>
          )}
        </button>
        <p className="mt-2.5 text-[10px] font-mono text-[rgba(61,58,74,0.45)] text-center uppercase tracking-[0.18em]">
          Signal from the noise
        </p>
      </div>
    </aside>
  );
}
