import React, { useState } from "react";
import { ThumbsUp, ThumbsDown, Radio, AlertTriangle, FileDown } from "lucide-react";
import { DotDash, confidenceBand } from "./MorseBits";
import { toast } from "sonner";

const SECTION_ORDER = [
  { id: "solution_fit", title: "SOLUTION FIT" },
  { id: "account_snapshot", title: "ACCOUNT SNAPSHOT" },
  { id: "intent_signals", title: "INTENT SIGNALS" },
  { id: "commitments", title: "COMMITMENTS & OPEN QUESTIONS" },
  { id: "competitive", title: "COMPETITIVE & INDUSTRY CONTEXT" },
];

const SECTION_TITLE_BY_ID = Object.fromEntries(SECTION_ORDER.map((s) => [s.id, s.title]));

function StatusBadge({ status }) {
  if (!status) return null;
  const map = {
    strong: { color: "#A9C5A0", label: "STRONG" },
    uncertain: { color: "#EAD2A8", label: "UNCERTAIN" },
    unsupported: { color: "#DDA7A5", label: "UNSUPPORTED" },
  };
  const s = map[status] || map.uncertain;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]"
      style={{ background: s.color + "40", color: "#3D3A4A" }}
      data-testid={`section-status-${status}`}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

export default function RightPane({ brief, onCite, activeChunkKey, onFeedback, feedbackGiven, account, streaming, chunks, onExportPdf }) {
  const [comment, setComment] = useState("");
  const [vote, setVote] = useState(null);

  const submitFeedback = async (v) => {
    setVote(v);
    try {
      await onFeedback(v, comment);
      toast.success("Thanks for the feedback — noted.");
    } catch {
      toast.error("Could not save feedback.");
    }
  };

  if (!brief) {
    return (
      <section className="flex-1 h-full flex items-center justify-center bg-[#FAF7FB]" data-testid="right-pane-empty">
        <div className="text-center max-w-md px-8">
          <div className="mx-auto mb-6 flex items-center justify-center gap-1.5">
            <DotDash score={streaming ? 0.6 : 0} animate={!!streaming} size={9} />
          </div>
          <h2 className="font-display text-2xl mb-2 text-[#3D3A4A]">
            {streaming ? "Decoding signal…" : "Awaiting signal"}
          </h2>
          <p className="text-[14px] text-[rgba(61,58,74,0.6)] leading-relaxed">
            {streaming
              ? "Sections will appear here as each one is decoded — parallel decoding, live from the source."
              : "Your Sales Brief will appear here — every insight highlighted, every citation traceable to its exact source."}
          </p>
        </div>
      </section>
    );
  }

  const bySection = new Map((brief.sections || []).map((s) => [s.id, s]));

  // Collect all contradictions across sections for the digest
  const contradictions = [];
  (brief.sections || []).forEach((s) => {
    (s.insights || []).forEach((ins, idx) => {
      if (ins.flag === "contradiction") {
        contradictions.push({
          section_id: s.id,
          section_title: SECTION_TITLE_BY_ID[s.id] || s.title,
          idx,
          ...ins,
        });
      }
    });
  });

  return (
    <section className="flex-1 h-full flex flex-col bg-[#FAF7FB]" data-testid="right-pane">
      <div className="flex-1 overflow-y-auto sm-scroll">
        <div className="max-w-3xl mx-auto p-8 lg:p-12" id="sm-brief-printable">
          {/* Header */}
          <div className="mb-8 flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Radio size={14} strokeWidth={1.6} className="text-[#A8D8D0]" />
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[rgba(61,58,74,0.55)]">
                  Sales Brief
                </span>
              </div>
              <h1 className="font-display text-4xl leading-tight text-[#3D3A4A]">
                {account || "Decoded account"}
              </h1>
              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <div className="inline-flex items-center gap-2.5 rounded-full bg-white border border-[rgba(61,58,74,0.08)] px-3.5 py-1.5">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[rgba(61,58,74,0.55)]">
                    Signal strength
                  </span>
                  <DotDash score={brief.overall_confidence || 0} size={7} animate={!!streaming} />
                  <span className="font-mono text-[11px] text-[#3D3A4A]">
                    {Math.round((brief.overall_confidence || 0) * 100)}%
                  </span>
                </div>
                <span
                  className="rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em]"
                  style={{
                    background: confidenceBand(brief.overall_confidence || 0).color + "40",
                    color: "#3D3A4A",
                  }}
                >
                  {confidenceBand(brief.overall_confidence || 0).label} confidence
                </span>
                {streaming && (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 bg-[#F0E9F5] font-mono text-[10px] uppercase tracking-[0.14em] text-[rgba(61,58,74,0.7)]">
                    <DotDash score={0.6} animate size={5} />
                    decoding {brief.sections?.length || 0}/5
                  </span>
                )}
              </div>
            </div>
            {!streaming && (
              <button
                type="button"
                onClick={onExportPdf}
                data-testid="export-pdf-button"
                className="relative z-50 print:hidden shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 bg-white border border-[rgba(61,58,74,0.10)] hover:bg-[#F0E9F5] text-[#3D3A4A] text-[12.5px] transition-colors active:scale-[0.98]"
                title="Export brief as PDF"
              >
                <FileDown size={14} strokeWidth={1.7} />
                Export PDF
              </button>
            )}
          </div>

          {/* Contradiction Digest */}
          {contradictions.length > 0 && (
            <div
              className="mb-6 rounded-2xl bg-[#F5C6C6]/25 border border-[#F5C6C6]/60 p-5"
              data-testid="contradiction-digest"
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} strokeWidth={1.8} className="text-[#DDA7A5]" />
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#3D3A4A]">
                  Contradictions detected · {contradictions.length}
                </span>
              </div>
              <p className="text-[12.5px] text-[rgba(61,58,74,0.7)] mb-3">
                The sources disagree on these points. Review before you walk in.
              </p>
              <ul className="space-y-1.5">
                {contradictions.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13.5px] leading-snug">
                    <span
                      aria-hidden
                      className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#DDA7A5] shrink-0"
                    />
                    <button
                      type="button"
                      onClick={() => onCite(c, `${c.section_id}-${c.idx}`)}
                      data-testid={`contradiction-item-${i}`}
                      className="text-left text-[#3D3A4A] hover:underline decoration-[#DDA7A5] underline-offset-2"
                    >
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[rgba(61,58,74,0.55)] mr-2">
                        {c.section_title.split(" ")[0]}
                      </span>
                      {c.text}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Sections */}
          <div className="rounded-2xl bg-white border border-[rgba(61,58,74,0.06)] shadow-[0_8px_30px_rgba(61,58,74,0.04)] p-8 lg:p-10 space-y-8">
            {SECTION_ORDER.map(({ id, title }) => {
              const s = bySection.get(id);
              if (!s) {
                if (streaming) {
                  return (
                    <section key={id} data-testid={`brief-section-placeholder-${id}`} className="opacity-60">
                      <header className="flex items-center gap-3 mb-3">
                        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-[rgba(61,58,74,0.5)]">
                          [{title}]
                        </h2>
                        <DotDash score={0.5} animate size={5} />
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[rgba(61,58,74,0.4)]">
                          decoding
                        </span>
                      </header>
                      <div className="h-3 rounded bg-[#F0E9F5] w-3/4 mb-2" />
                      <div className="h-3 rounded bg-[#F0E9F5] w-2/3" />
                    </section>
                  );
                }
                return null;
              }
              return (
                <section key={id} data-testid={`brief-section-${id}`}>
                  <header className="flex items-center gap-3 mb-3 flex-wrap">
                    <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#3D3A4A]">
                      [{title}]
                    </h2>
                    <StatusBadge status={s.status} />
                    <span className="ml-auto flex items-center gap-2">
                      <DotDash score={s.section_confidence || 0} size={6} />
                      <span className="font-mono text-[10.5px] text-[rgba(61,58,74,0.55)]">
                        {Math.round((s.section_confidence || 0) * 100)}%
                      </span>
                    </span>
                  </header>
                  <div className="text-[15px] leading-relaxed text-[#3D3A4A]">
                    {(s.insights || []).map((ins, idx) => {
                      const key = `${id}-${idx}`;
                      const active = activeChunkKey === key;
                      const hasSource = ins.chunk_ids && ins.chunk_ids.length > 0;
                      return (
                        <React.Fragment key={idx}>
                          {hasSource ? (
                            <span
                              role="button"
                              tabIndex={0}
                              data-testid={`insight-${id}-${idx}`}
                              onClick={() => onCite(ins, key)}
                              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onCite(ins, key)}
                              className={
                                "sm-cite " +
                                (ins.flag === "contradiction" ? "sm-flag-contradiction " : "") +
                                (active ? "sm-cite-active" : "")
                              }
                            >
                              {ins.text}
                            </span>
                          ) : (
                            <span className="italic text-[rgba(61,58,74,0.55)]">{ins.text}</span>
                          )}
                          {ins.flag === "contradiction" && (
                            <span className="ml-1 inline-flex items-center rounded-full bg-[#F5C6C6]/60 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-widest text-[#3D3A4A] align-middle">
                              contradiction
                            </span>
                          )}
                          {" "}
                          {/* Print-only citation footnote */}
                          {hasSource && ins.chunk_ids?.length > 0 && (
                            <span className="hidden print:inline font-mono text-[10px] text-[#3D3A4A]/60">
                              [{ins.chunk_ids.join(", ")}]{" "}
                            </span>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          {/* Print-only source appendix */}
          {chunks && chunks.length > 0 && (
            <div className="hidden print:block mt-8 rounded-2xl bg-white p-6">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#3D3A4A] mb-3">
                [SOURCE APPENDIX]
              </h3>
              {chunks.map((c) => (
                <div key={c.chunk_id} className="mb-4 break-inside-avoid">
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[rgba(61,58,74,0.55)] mb-1">
                    {c.chunk_id} · {c.filename} · {c.source_label}
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[#3D3A4A]">
                    {c.text}
                  </pre>
                </div>
              ))}
            </div>
          )}

          {/* Feedback */}
          <div className="mt-8 rounded-2xl bg-[#F0E9F5] p-5 print:hidden" data-testid="feedback-box">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[rgba(61,58,74,0.6)]">
                Was this brief useful?
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  data-testid="feedback-up"
                  onClick={() => submitFeedback("up")}
                  className={
                    "rounded-full p-2 transition-all active:scale-95 " +
                    (vote === "up" ? "bg-[#A9C5A0]/60 text-[#3D3A4A]" : "bg-white hover:bg-white/80 text-[#3D3A4A]/70")
                  }
                  aria-label="Thumbs up"
                >
                  <ThumbsUp size={15} strokeWidth={1.6} />
                </button>
                <button
                  type="button"
                  data-testid="feedback-down"
                  onClick={() => submitFeedback("down")}
                  className={
                    "rounded-full p-2 transition-all active:scale-95 " +
                    (vote === "down" ? "bg-[#DDA7A5]/60 text-[#3D3A4A]" : "bg-white hover:bg-white/80 text-[#3D3A4A]/70")
                  }
                  aria-label="Thumbs down"
                >
                  <ThumbsDown size={15} strokeWidth={1.6} />
                </button>
              </div>
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional — anything we missed or over-called?"
              className="mt-3 w-full min-h-[64px] rounded-xl bg-white border-none p-3 text-[13.5px] outline-none focus:ring-2 focus:ring-[#A8D8D0] resize-none"
              data-testid="feedback-comment"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
