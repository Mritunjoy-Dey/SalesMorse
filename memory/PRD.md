# Sales Morse — PRD

## Original problem statement
Build "Sales Morse" — an AI-powered sales meeting prep tool. Sales reps upload messy account data (CRM notes, emails, call transcripts). Sales Morse decodes it into a structured, cited "Sales Brief" — a signal pulled out of the noise, with every insight traceable back to its exact source. Tagline: "Decode the account. Walk in ready."

## User choices
- LLM: **GPT 5.6 Terra** via Emergent Universal LLM Key
- Retrieval: **In-app TF-IDF + cosine** (no external embeddings)
- Demo data: **Brightline Analytics** preloaded on first visit
- Scope: **In-session only**, no auth, no multi-tenant

## Architecture
- **Backend** (FastAPI, `/app/backend`)
  - `server.py`: routes `/api/session/init`, `/api/upload`, `/api/file/{sid}/{fid}`, `/api/brief/generate`, `/api/brief/{sid}`, `/api/chat`, `/api/feedback`. In-memory `SESSIONS` dict per session.
  - `brief_service.py`: paragraph-based chunker, TF-IDF retrieval (`retrieve_top_k`), `generate_brief` and `answer_followup` (both call `openai/gpt-5.6-terra` via `emergentintegrations`), strict JSON-schema prompts enforcing citations, contradictions, and qualifier preservation.
  - `demo_data.py`: Brightline CRM note + Priya budget email + call transcript.
  - File parsing: PDF (PyPDF2), DOCX (python-docx), TXT/MD.
- **Frontend** (React + Tailwind + shadcn + sonner, `/app/frontend/src`)
  - 3-pane workspace (`App.js`): LeftPane (upload + Generate Brief), CenterPane (chat), RightPane (brief + feedback), overlay CitationPanel.
  - Design: pastel palette (`#FAF7FB` bg, `#F0E9F5` surface, `#A8D8D0` signal accent, `#F5C6C6` blush, `#3D3A4A` ink), Fraunces display + Figtree body + IBM Plex Mono metadata.
  - Morse "dot-dash" confidence indicators (`MorseBits.jsx`).
  - Session in `sessionStorage`, demo auto-loaded via `load_demo=true` on init.

## User personas
- Individual sales rep prepping for an account call — needs signal-not-noise, must trust every claim → citations & confidence.
- Sales manager reviewing pipeline health — scans briefs for contradictions and stakeholder gaps.

## Core requirements (static)
- 3-pane layout with upload / chat / brief.
- 5 brief sections in fixed order, each grounded in sources.
- Every insight highlighted + clickable → citation panel with exact chunk, filename, color-coded confidence.
- Contradictions surfaced, never resolved silently. Qualifiers preserved verbatim.
- Follow-up chat uses same citation UX.
- Out-of-scope requests politely refused.
- Overall + section confidence rendered as dot-dash Morse pattern.

## What's been implemented (2026-02-23)
- Full backend RAG pipeline with GPT 5.6 Terra ✔
- File upload (PDF/DOCX/TXT) with source-type inference ✔
- Structured brief JSON with 5 sections, contradictions, insufficient-source flags ✔
- Follow-up chat grounded in sources; OOS refusal ✔
- Full 3-pane frontend with pastel Morse aesthetic ✔
- Citation panel with source chunk view + color-coded confidence ✔
- Thumbs up/down + comment feedback ✔
- Brightline Analytics demo preloaded ✔
- Testing subagent: 100% pass (backend + frontend + integration)

## Prioritized backlog
- P1: Export brief to PDF / share link.
- P1: Persist sessions across refresh (optional Mongo storage per session id).
- P2: Streaming brief generation (SSE) for faster time-to-first-word.
- P2: Additional demo accounts (SMB, technical eval, competitive displacement).
- P2: Diff view when the same insight is contradicted across sources.
- P3: Slack / Gmail import of raw threads.
