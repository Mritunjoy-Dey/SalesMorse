import React from "react";
import { X, FileText, Mail, Phone, File as FileIcon } from "lucide-react";
import { DotDash, confidenceBand, SOURCE_DOT_COLOR } from "./MorseBits";

const iconFor = (type) => {
  const p = { size: 14, strokeWidth: 1.6 };
  if (type === "crm") return <FileText {...p} />;
  if (type === "email") return <Mail {...p} />;
  if (type === "transcript") return <Phone {...p} />;
  return <FileIcon {...p} />;
};

export default function CitationPanel({ open, insight, chunks, onClose }) {
  const chunkIds = insight?.chunk_ids || [];
  const shown = chunks.filter((c) => chunkIds.includes(c.chunk_id));
  const conf = insight?.confidence ?? 0;
  const band = confidenceBand(conf);

  return (
    <div
      className={
        "fixed inset-y-0 right-0 w-full sm:w-[400px] z-40 transform transition-transform duration-300 ease-out " +
        (open ? "translate-x-0" : "translate-x-full")
      }
      aria-hidden={!open}
      data-testid="citation-panel"
    >
      <div className="h-full bg-[#F0E9F5] border-l border-[rgba(61,58,74,0.08)] shadow-[-20px_0_40px_rgba(61,58,74,0.06)] rounded-l-2xl flex flex-col">
        <div className="p-5 border-b border-[rgba(61,58,74,0.08)] flex items-center gap-3">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[rgba(61,58,74,0.6)]">
            Source trace
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto p-1.5 rounded-md hover:bg-[rgba(61,58,74,0.06)]"
            aria-label="Close citation"
            data-testid="citation-close"
          >
            <X size={16} strokeWidth={1.6} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto sm-scroll flex-1">
          {insight && (
            <div className="rounded-xl bg-white border border-[rgba(61,58,74,0.06)] p-4">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <DotDash score={conf} size={7} />
                <span
                  className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]"
                  style={{ background: band.color + "40", color: "#3D3A4A" }}
                >
                  {band.label} · {Math.round(conf * 100)}%
                </span>
                {insight.flag && (
                  <span className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] bg-[#F5C6C6]/60 text-[#3D3A4A]">
                    {insight.flag}
                  </span>
                )}
              </div>
              <div className="text-[13.5px] leading-relaxed text-[#3D3A4A]">
                “{insight.text}”
              </div>
            </div>
          )}

          {shown.length === 0 && (
            <div className="text-[13px] text-[rgba(61,58,74,0.55)] italic">
              No source chunks were attached to this insight.
            </div>
          )}

          {shown.map((c) => (
            <div key={c.chunk_id} className="rounded-xl bg-white border border-[rgba(61,58,74,0.06)] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[rgba(61,58,74,0.06)] bg-[#FAF7FB]">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: SOURCE_DOT_COLOR[c.source_type] || SOURCE_DOT_COLOR.doc }}
                />
                {iconFor(c.source_type)}
                <span className="text-[12.5px] text-[#3D3A4A] truncate">{c.filename}</span>
                <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] text-[rgba(61,58,74,0.5)]">
                  {c.source_label}
                </span>
              </div>
              <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-[#3D3A4A] p-4 bg-white">
                {c.text}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
