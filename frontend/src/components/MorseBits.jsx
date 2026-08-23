import React from "react";

export const SOURCE_DOT_COLOR = {
  crm: "#A9C5A0",       // sage
  email: "#A8D8D0",     // seafoam
  transcript: "#EAD2A8", // amber
  doc: "#D9CDE6",       // lilac
};

export function confidenceBand(score) {
  if (score >= 0.7) return { level: "high", color: "#A9C5A0", label: "HIGH" };
  if (score >= 0.5) return { level: "medium", color: "#EAD2A8", label: "MED" };
  return { level: "low", color: "#DDA7A5", label: "LOW" };
}

/** Renders a confidence value as a 5-symbol Morse pattern (dots for high, dashes for lows). */
export function DotDash({ score = 0, animate = false, size = 8 }) {
  const symbols = [];
  const clamped = Math.max(0, Math.min(1, Number(score) || 0));
  const filled = Math.round(clamped * 5);
  for (let i = 0; i < 5; i++) {
    const isFilled = i < filled;
    // alternate dot/dash pattern
    const isDash = i % 2 === 1;
    symbols.push({ isFilled, isDash });
  }
  const band = confidenceBand(clamped);
  return (
    <span
      className={"inline-flex items-center gap-[3px] " + (animate ? "sm-pulse" : "")}
      aria-label={`Confidence ${(clamped * 100).toFixed(0)}%`}
      data-testid="dot-dash-indicator"
    >
      {symbols.map((s, idx) => (
        <span
          key={idx}
          style={{
            display: "inline-block",
            width: s.isDash ? size * 2 : size,
            height: size / 2,
            borderRadius: 999,
            background: s.isFilled ? band.color : "rgba(61,58,74,0.18)",
          }}
        />
      ))}
    </span>
  );
}

export function MorseGlyph({ className = "" }) {
  // Static "SM" in Morse (S = ... , M = --)
  return (
    <span className={"inline-flex items-center gap-[3px] " + className} aria-hidden>
      <span style={{ width: 6, height: 3, borderRadius: 999, background: "#3D3A4A" }} />
      <span style={{ width: 6, height: 3, borderRadius: 999, background: "#3D3A4A" }} />
      <span style={{ width: 6, height: 3, borderRadius: 999, background: "#3D3A4A" }} />
      <span style={{ width: 4, display: "inline-block" }} />
      <span style={{ width: 14, height: 3, borderRadius: 999, background: "#A8D8D0" }} />
      <span style={{ width: 14, height: 3, borderRadius: 999, background: "#A8D8D0" }} />
    </span>
  );
}
