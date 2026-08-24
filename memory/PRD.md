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

## What's been implemented (2026-02-24)
- **Streaming decode**: `/api/brief/stream` (SSE) generates 5 sections in parallel (`asyncio.as_completed`) and emits `meta`, `section`, `done` events. Frontend uses fetch reader + SSE frame parser to render each section as it arrives; unarrived sections show pulsing morse-skeleton placeholders. Sections are guaranteed to keep their id on failure.
- **Contradiction Digest**: top-of-brief callout collects every insight with `flag='contradiction'` across all sections; each item is clickable and opens the citation panel with its source chunk.
- **Brief Export (PDF)**: `Export PDF` button in brief header calls `window.print()`, closing the citation panel first (z-index + auto-close). Dedicated `@media print` stylesheet in `index.css` keeps citation highlights, adds inline `[chunk_id]` footnotes on every cited insight, and appends a source chunk appendix.
- **Three demo accounts**: Brightline Analytics (default), Nimbus DevOps (technical eval / SSO SOC2 gate), Zenith Retail (competitive displacement). `GET /api/demo-accounts` lists them, picker in LeftPane opens on click, disabled state for already-loaded accounts.
- **Loaded Files section restructure**: LeftPane now has a distinct "Add Sources" area (dropzone + demo picker) and a "Loaded Files" section below with count + list. "Try with demo files" button auto-hides once ALL three demo accounts are fully loaded, comes back when any demo file is deleted.

## What's been implemented (2026-02-23)
- Full backend RAG pipeline with GPT 5.6 Terra
- File upload (PDF/DOCX/TXT) with source-type inference
- Structured brief JSON with 5 sections, contradictions, insufficient-source flags
- Follow-up chat grounded in sources; OOS refusal
- Full 3-pane frontend with pastel Morse aesthetic
- Citation panel with source chunk view + color-coded confidence
- Thumbs up/down + comment feedback
- File preview modal + per-file download
- Bug fix: sources are append-only (demos never disappear on upload)

## Prioritized backlog
- P2: Reconcile brief header account label when multiple demo accounts are loaded (currently shows first-loaded account's name).
- P2: Improve filename truncation in Loaded Files (middle-ellipsis or wider pane).
- P2: Persist sessions across refresh (Mongo storage).
- P2: Per-section retrieval (retrieve_top_k inside generate_section) to cut token cost on large source sets.
- P3: Streaming to be token-level per section (currently section-level).
- P3: Slack / Gmail import of raw threads.
