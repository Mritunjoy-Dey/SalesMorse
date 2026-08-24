import React, { useEffect, useRef, useState } from "react";
import { Send, Radio, User } from "lucide-react";
import { DotDash, confidenceBand } from "./MorseBits";

function CitedText({ spans, onCite, activeChunkKey }) {
  if (!spans || spans.length === 0) return null;
  return (
    <span>
      {spans.map((sp, i) => {
        const key = `${sp.chunk_ids?.join("|") || "none"}-${i}`;
        const isActive = activeChunkKey === key;
        const hasSource = sp.chunk_ids && sp.chunk_ids.length > 0;
        return (
          <React.Fragment key={i}>
            {hasSource ? (
              <span
                role="button"
                tabIndex={0}
                data-testid="chat-citation-span"
                onClick={() => onCite(sp, key)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onCite(sp, key)}
                className={
                  "sm-cite " +
                  (sp.flag === "contradiction" ? "sm-flag-contradiction " : "") +
                  (isActive ? "sm-cite-active" : "")
                }
              >
                {sp.text}
              </span>
            ) : (
              <span>{sp.text}</span>
            )}{" "}
          </React.Fragment>
        );
      })}
    </span>
  );
}

export default function CenterPane({
  hasFiles,
  brief,
  chatLog,
  onSend,
  sending,
  onCite,
  activeChunkKey,
  account,
}) {
  const [q, setQ] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatLog, brief]);

  const submit = (e) => {
    e.preventDefault();
    const text = q.trim();
    if (!text || sending) return;
    onSend(text);
    setQ("");
  };

  const briefReadyMsg = brief ? (
    <div className="rounded-2xl bg-white border border-[rgba(61,58,74,0.08)] p-5 max-w-[520px] shadow-[0_8px_30px_rgba(61,58,74,0.04)]">
      <div className="flex items-center gap-2 mb-2">
        <Radio size={14} strokeWidth={1.6} className="text-[#A8D8D0]" />
        <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[rgba(61,58,74,0.55)]">
          Brief decoded
        </span>
        <DotDash score={brief.overall_confidence || 0} size={6} />
      </div>
      <div className="font-display text-lg leading-snug mb-1">
        {account ? account : "Sales Brief"}
      </div>
      <div className="text-sm text-[rgba(61,58,74,0.7)]">
        See the full document on the right. Ask a follow-up below — replies stay grounded in your sources.
      </div>
    </div>
  ) : null;

  return (
    <section
      className="flex flex-col h-full border-r border-[rgba(61,58,74,0.08)] bg-[#FAF7FB]"
      data-testid="center-pane"
    >
      <div className="px-6 py-5 flex items-center gap-2">
        <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-[rgba(61,58,74,0.55)]">
          Chat with your file
        </span>
      </div>

      <div className="flex-1 overflow-y-auto sm-scroll px-6 pb-4" ref={scrollRef}>
        {!hasFiles && (
          <div
            className="rounded-2xl bg-[#F0E9F5] px-5 py-4 text-[13.5px] text-[#3D3A4A]/80 max-w-[520px]"
            data-testid="empty-banner"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#DDA7A5]" />
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[rgba(61,58,74,0.5)]">
                Waiting for signal
              </span>
            </div>
            No account data uploaded yet — add a source to get started.
          </div>
        )}

        {hasFiles && !brief && (
          <div className="rounded-2xl bg-[#F0E9F5]/70 px-5 py-4 text-[13.5px] text-[#3D3A4A]/80 max-w-[520px]">
            Upload file and Click <span className="font-medium">Generate Brief</span> to start chatting.
          </div>
        )}

        {briefReadyMsg}

        {chatLog.map((m, idx) => (
          <div key={idx} className={"mt-4 flex " + (m.role === "user" ? "justify-end" : "justify-start") }>
            {m.role === "user" ? (
              <div className="rounded-2xl rounded-tr-md bg-[#F0E9F5] px-4 py-2.5 text-[14px] text-[#3D3A4A] max-w-[520px]" data-testid="chat-user-msg">
                {m.text}
              </div>
            ) : (
              <div className="rounded-2xl rounded-tl-md bg-white border border-[rgba(61,58,74,0.08)] px-4 py-3 max-w-[560px] text-[14px] text-[#3D3A4A] leading-relaxed shadow-[0_6px_24px_rgba(61,58,74,0.04)]" data-testid="chat-assistant-msg">
                {m.reply?.insufficient ? (
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 mt-2 rounded-full bg-[#DDA7A5] shrink-0" />
                    <div>
                      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[rgba(61,58,74,0.55)] mb-0.5">
                        No signal
                      </div>
                      <div>{m.reply.reason || "I don't have this in your uploaded sources. Try uploading a document that covers this."}</div>
                    </div>
                  </div>
                ) : (
                  <CitedText spans={m.reply?.answer_spans || []} onCite={onCite} activeChunkKey={activeChunkKey} />
                )}
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div className="mt-4 flex justify-start">
            <div className="rounded-2xl rounded-tl-md bg-white border border-[rgba(61,58,74,0.08)] px-4 py-3">
              <DotDash score={0.6} animate size={6} />
            </div>
          </div>
        )}
      </div>

      <form onSubmit={submit} className="p-4 border-t border-[rgba(61,58,74,0.06)]">
        <div className="flex items-center gap-2 bg-white border border-[rgba(61,58,74,0.10)] rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-[#A8D8D0] transition-all">
          <User size={14} strokeWidth={1.6} className="text-[rgba(61,58,74,0.5)]" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={hasFiles ? "Ask a follow-up… (e.g. Is budget locked in?)" : "Upload a source to start"}
            disabled={!hasFiles || sending}
            className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-[rgba(61,58,74,0.4)]"
            data-testid="chat-input"
          />
          <button
            type="submit"
            disabled={!hasFiles || !q.trim() || sending}
            className={
              "rounded-full p-2 transition-all " +
              (hasFiles && q.trim()
                ? "bg-[#3D3A4A] text-[#FAF7FB] hover:bg-[#2f2c3a] active:scale-95"
                : "bg-[rgba(61,58,74,0.08)] text-[rgba(61,58,74,0.4)] cursor-not-allowed")
            }
            aria-label="Send"
            data-testid="chat-send-button"
          >
            <Send size={14} strokeWidth={1.8} />
          </button>
        </div>
        <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-[rgba(61,58,74,0.4)]">
          Answers stay grounded in your uploaded sources
        </p>
      </form>
    </section>
  );
}
