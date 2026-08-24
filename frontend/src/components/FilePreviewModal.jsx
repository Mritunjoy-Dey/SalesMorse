import React from "react";
import { X, Download, FileText, Mail, Phone, File as FileIcon } from "lucide-react";
import { SOURCE_DOT_COLOR } from "./MorseBits";

const iconFor = (type) => {
  const p = { size: 14, strokeWidth: 1.6 };
  if (type === "crm") return <FileText {...p} />;
  if (type === "email") return <Mail {...p} />;
  if (type === "transcript") return <Phone {...p} />;
  return <FileIcon {...p} />;
};

export default function FilePreviewModal({ open, file, onClose, onDownload }) {
  if (!open || !file) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
      data-testid="file-preview-modal"
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-[#3D3A4A]/25 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      {/* dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${file.filename}`}
        className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-[#FAF7FB] rounded-2xl border border-[rgba(61,58,74,0.08)] shadow-[0_24px_60px_rgba(61,58,74,0.18)] overflow-hidden"
      >
        <header className="px-6 py-4 border-b border-[rgba(61,58,74,0.08)] flex items-center gap-3 bg-white">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: SOURCE_DOT_COLOR[file.source_type] || SOURCE_DOT_COLOR.doc }}
            aria-hidden
          />
          {iconFor(file.source_type)}
          <div className="min-w-0 flex-1">
            <div className="text-[14px] text-[#3D3A4A] truncate font-medium">{file.filename}</div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[rgba(61,58,74,0.55)]">
              {file.source_label}
              {file.is_demo && <span className="ml-2 text-[#3D3A4A]/70">· demo</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onDownload(file)}
            className="rounded-full px-3 py-1.5 bg-[#F0E9F5] hover:bg-[#e6ddef] text-[#3D3A4A] text-[12.5px] flex items-center gap-1.5 transition-colors active:scale-[0.98]"
            data-testid="file-preview-download"
          >
            <Download size={13} strokeWidth={1.7} />
            Download
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[rgba(61,58,74,0.06)]"
            aria-label="Close preview"
            data-testid="file-preview-close"
          >
            <X size={16} strokeWidth={1.6} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto sm-scroll p-6 bg-[#FAF7FB]">
          <pre
            className="whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-[#3D3A4A] bg-white rounded-xl border border-[rgba(61,58,74,0.06)] p-5"
            data-testid="file-preview-content"
          >
            {file.content}
          </pre>
        </div>
      </div>
    </div>
  );
}
