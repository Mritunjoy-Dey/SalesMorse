import React, { useState } from "react";
import { ThumbsUp, ThumbsDown, Radio } from "lucide-react";
import { DotDash, confidenceBand } from "./MorseBits";
import { toast } from "sonner";

const SECTION_ORDER = [
  { id: "solution_fit", title: "SOLUTION FIT" },
  { id: "account_snapshot", title: "ACCOUNT SNAPSHOT" },
  { id: "intent_signals", title: "INTENT SIGNALS" },
  { id: "commitments", title: "COMMITMENTS & OPEN QUESTIONS" },
  { id: "competitive", title: "COMPETITIVE & INDUSTRY CONTEXT" },
];

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

export default function RightPane({ brief, onCite, activeChunkKey, onFeedback, feedbackGiven, account }) {
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
            <DotDash score={0} size={9} />
          </div>
          <h2 className="font-display text-2xl mb-2 text-[#3D3A4A]">Awaiting signal</h2>
          <p className="text-[14px] text-[rgba(61,58,74,0.6)] leading-relaxed">
            Your Sales Brief will appear here — every insight highlighted, every citation traceable to its exact source.
          </p>
        </div>
      </section>
    );
  }

  const bySection = new Map((brief.sections || []).map((s) => [s.id, s]));

  return (
    <section className="flex-1 h-full flex flex-col bg-[#FAF7FB]" data-testid="right-pane">
      <div className="flex-1 overflow-y-auto sm-scroll">
        <div className="max-w-3xl mx-auto p-8 lg:p-12">
          {/* Header */}
          <div className="mb-8">
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
                <DotDash score={brief.overall_confidence || 0} size={7} />
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
            </div>
          </div>

          {/* Sections */}
          <div className="rounded-2xl bg-white border border-[rgba(61,58,74,0.06)] shadow-[0_8px_30px_rgba(61,58,74,0.04)] p-8 lg:p-10 space-y-8">
            {SECTION_ORDER.map(({ id, title }) => {
              const s = bySection.get(id);
              if (!s) return null;
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
                        </React.Fragment>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          {/* Feedback */}
          <div className="mt-8 rounded-2xl bg-[#F0E9F5] p-5" data-testid="feedback-box">
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
