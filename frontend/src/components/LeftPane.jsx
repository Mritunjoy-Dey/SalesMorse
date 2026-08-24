import React, { useRef, useState } from "react";
import { Upload, FileText, Mail, Phone, File as FileIcon, X, Sparkles, Download, Radio } from "lucide-react";
import { SOURCE_DOT_COLOR, DotDash } from "./MorseBits";
import { toast } from "sonner";

const iconFor = (type) => {
  const p = { size: 14, strokeWidth: 1.6 };
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

  return (
    <aside
      className="flex flex-col h-full border-r border-[rgba(61,58,74,0.08)] bg-[#FAF7FB]"
      data-testid="left-pane"
    >
      <div className="p-6 pb-4 flex items-center gap-2">
        <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[rgba(61,58,74,0.55)]">Sources</span>
        <span className="ml-auto text-[11px] font-mono text-[rgba(61,58,74,0.45)]">{files.length}</span>
      </div>

      <div className="px-6">
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
              ? "border-[#A8D8D0] bg-[#F0E9F5]"
              : "border-[rgba(61,58,74,0.18)] bg-[#F0E9F5]/50 hover:bg-[#F0E9F5]")
          }
        >
          <Upload size={20} strokeWidth={1.5} className="mx-auto mb-2 text-[#3D3A4A]/70" />
          <div className="text-sm text-[#3D3A4A]">Drop files or click to browse</div>
          <div className="mt-1 text-[11px] font-mono text-[rgba(61,58,74,0.5)]">PDF · DOCX · TXT</div>
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

        {/* Try with demo files */}
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-[rgba(61,58,74,0.6)]">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[rgba(61,58,74,0.4)]">or</span>
          <span aria-hidden className="text-[rgba(61,58,74,0.3)]">→</span>
          <button
            type="button"
            data-testid="load-demo-button"
            onClick={onLoadDemo}
            title="Load Brightline Analytics demo sources"
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 bg-[#F0E9F5] hover:bg-[#e6ddef] text-[#3D3A4A] transition-colors active:scale-[0.98]"
          >
            <Radio size={11} strokeWidth={1.7} className="text-[#A8D8D0]" />
            <span>Try with demo files</span>
          </button>
        </div>
      </div>

      <div className="px-6 mt-4 flex-1 overflow-y-auto sm-scroll" data-testid="file-list">
        <div className="flex flex-col gap-2">
          {files.map((f) => (
            <div
              key={f.id}
              role="button"
              tabIndex={0}
              onClick={() => onPreview(f)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onPreview(f)}
              className="group flex items-center gap-3 rounded-xl bg-[#F0E9F5]/70 hover:bg-[#F0E9F5] px-3 py-2.5 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A8D8D0]"
              data-testid={`file-item-${f.id}`}
              aria-label={`Preview ${f.filename}`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: SOURCE_DOT_COLOR[f.source_type] || SOURCE_DOT_COLOR.doc }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[13px] text-[#3D3A4A] truncate">
                  {iconFor(f.source_type)}
                  <span className="truncate" title={f.filename}>{f.filename}</span>
                  {f.is_demo && (
                    <span
                      className="shrink-0 rounded-full px-1.5 py-[1px] font-mono text-[9px] uppercase tracking-[0.14em] bg-[#A8D8D0]/40 text-[#3D3A4A]"
                      data-testid={`demo-badge-${f.id}`}
                    >
                      demo
                    </span>
                  )}
                </div>
                <div className="text-[10.5px] font-mono text-[rgba(61,58,74,0.5)] uppercase tracking-wider truncate">
                  {f.source_label} · {timeAgo(f.uploaded_at)}
                </div>
              </div>
              <button
                type="button"
                data-testid={`download-file-${f.id}`}
                onClick={(e) => { e.stopPropagation(); onDownload(f); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-[rgba(61,58,74,0.06)]"
                aria-label="Download file"
                title="Download"
              >
                <Download size={13} strokeWidth={1.6} />
              </button>
              <button
                type="button"
                data-testid={`delete-file-${f.id}`}
                onClick={(e) => { e.stopPropagation(); onDelete(f.id); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-[rgba(61,58,74,0.06)]"
                aria-label="Remove file"
                title="Remove"
              >
                <X size={14} strokeWidth={1.6} />
              </button>
            </div>
          ))}
          {files.length === 0 && (
            <div className="text-[12.5px] text-[rgba(61,58,74,0.5)] px-1 py-4 text-center">
              No sources yet.
            </div>
          )}
        </div>
      </div>

      <div className="p-6 pt-4 border-t border-[rgba(61,58,74,0.06)]">
        <button
          type="button"
          data-testid="generate-brief-button"
          disabled={!canGenerate || generating}
          onClick={onGenerate}
          className={
            "w-full rounded-full px-4 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2 " +
            (canGenerate && !generating
              ? "bg-[#3D3A4A] text-[#FAF7FB] hover:bg-[#2f2c3a] active:scale-[0.98] shadow-[0_8px_24px_rgba(61,58,74,0.15)]"
              : "bg-[rgba(61,58,74,0.08)] text-[rgba(61,58,74,0.4)] cursor-not-allowed")
          }
        >
          {generating ? (
            <>
              <DotDash score={0.6} animate size={7} />
              <span className="font-mono text-[11px] uppercase tracking-widest">Decoding…</span>
            </>
          ) : (
            <>
              <Sparkles size={15} strokeWidth={1.6} />
              <span>Generate Brief</span>
            </>
          )}
        </button>
        <p className="mt-2 text-[10.5px] font-mono text-[rgba(61,58,74,0.45)] text-center uppercase tracking-[0.12em]">
          Signal from the noise
        </p>
      </div>
    </aside>
  );
}
