"""RAG-lite service: chunking, retrieval, and LLM brief generation."""
import json
import os
import re
import uuid
from collections import Counter
from math import log, sqrt
from typing import Dict, List, Optional

from emergentintegrations.llm.chat import LlmChat, UserMessage

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
MODEL_PROVIDER = "openai"
MODEL_NAME = "gpt-5.6-terra"

SOURCE_TYPE_LABELS = {
    "crm": "CRM Note",
    "email": "Email",
    "transcript": "Call Transcript",
    "doc": "Document",
}


# ---------- Chunking ----------
def chunk_text(text: str, target_words: int = 90) -> List[str]:
    """Chunk by paragraph, then split long paragraphs to ~target_words."""
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: List[str] = []
    for p in paragraphs:
        words = p.split()
        if len(words) <= target_words * 1.5:
            chunks.append(p)
        else:
            # split large paragraphs
            for i in range(0, len(words), target_words):
                chunks.append(" ".join(words[i : i + target_words]))
    if not chunks and text.strip():
        chunks = [text.strip()]
    return chunks


def build_chunks_from_files(files: List[Dict]) -> List[Dict]:
    """files: [{id, filename, source_type, content}] -> list of chunk dicts."""
    all_chunks = []
    for f in files:
        pieces = chunk_text(f["content"])
        for idx, piece in enumerate(pieces):
            all_chunks.append(
                {
                    "chunk_id": f"{f['id']}-c{idx}",
                    "file_id": f["id"],
                    "filename": f["filename"],
                    "source_type": f["source_type"],
                    "source_label": SOURCE_TYPE_LABELS.get(
                        f["source_type"], "Document"
                    ),
                    "text": piece,
                }
            )
    return all_chunks


# ---------- TF-IDF retrieval ----------
_TOKEN_RE = re.compile(r"[A-Za-z0-9']+")
_STOPWORDS = set(
    """a an the of and or but if to for with without on in at by from is are was
    were be been being have has had do does did i you he she it we they them us our
    your their my me his her its this that these those as not no yes so than then
    which who whom whose what where when why how can could should would may might
    will just about into out over under up down here there also very more most much
    some any all each every other another such"""
    .split()
)


def _tokenize(text: str) -> List[str]:
    return [
        t.lower()
        for t in _TOKEN_RE.findall(text)
        if t.lower() not in _STOPWORDS and len(t) > 1
    ]


def _tfidf_vectors(chunks: List[Dict]) -> List[Dict]:
    """Return list of {counter, norm} per chunk plus idf dict."""
    docs = [_tokenize(c["text"]) for c in chunks]
    df: Counter = Counter()
    for tokens in docs:
        for t in set(tokens):
            df[t] += 1
    n = max(len(docs), 1)
    idf = {t: log((n + 1) / (df_t + 1)) + 1 for t, df_t in df.items()}
    vectors = []
    for tokens in docs:
        tf = Counter(tokens)
        vec = {t: (tf[t] / max(len(tokens), 1)) * idf.get(t, 1.0) for t in tf}
        norm = sqrt(sum(v * v for v in vec.values())) or 1.0
        vectors.append({"vec": vec, "norm": norm})
    return vectors, idf


def retrieve_top_k(query: str, chunks: List[Dict], k: int = 6) -> List[Dict]:
    if not chunks:
        return []
    vectors, idf = _tfidf_vectors(chunks)
    q_tokens = _tokenize(query)
    q_tf = Counter(q_tokens)
    q_vec = {t: (q_tf[t] / max(len(q_tokens), 1)) * idf.get(t, 1.0) for t in q_tf}
    q_norm = sqrt(sum(v * v for v in q_vec.values())) or 1.0
    scored = []
    for i, cv in enumerate(vectors):
        dot = sum(q_vec.get(t, 0) * cv["vec"].get(t, 0) for t in q_vec)
        score = dot / (q_norm * cv["norm"])
        scored.append((score, chunks[i]))
    scored.sort(key=lambda x: x[0], reverse=True)
    top = [c for s, c in scored[:k] if s > 0]
    return top or chunks[:k]


# ---------- LLM prompts ----------
BRIEF_SYSTEM_PROMPT = """You are Sales Morse, an assistant that decodes messy sales account data into a structured sales brief. You work ONLY from the uploaded source chunks provided.

CRITICAL RULES:
- Never fabricate information. Every insight must be grounded in a specific source chunk.
- If a source uses a qualifier like "maybe Q3" or "possibly approved", preserve that qualifier exactly — never state it as fact.
- If sources contradict each other, surface BOTH sides with citations and flag the contradiction. Never silently pick one.
- If a section cannot be supported by the uploaded sources, mark it "insufficient source coverage" instead of generating filler.
- Tone: direct, confident, honest. No filler.

You MUST return a single JSON object (no prose, no markdown fences) with this exact schema:
{
  "overall_confidence": 0.0-1.0,
  "sections": [
    {
      "id": "solution_fit" | "account_snapshot" | "intent_signals" | "commitments" | "competitive",
      "title": "SOLUTION FIT" | "ACCOUNT SNAPSHOT" | "INTENT SIGNALS" | "COMMITMENTS & OPEN QUESTIONS" | "COMPETITIVE & INDUSTRY CONTEXT",
      "status": "strong" | "uncertain" | "unsupported",
      "section_confidence": 0.0-1.0,
      "insights": [
        {
          "text": "One sentence insight, preserving any qualifiers verbatim from sources.",
          "chunk_ids": ["<chunk_id1>", ...],
          "confidence": 0.0-1.0,
          "flag": null | "contradiction" | "qualifier" | "insufficient"
        }
      ]
    }
  ]
}

Return the 5 sections in this exact order: solution_fit, account_snapshot, intent_signals, commitments, competitive.
For INTENT SIGNALS, if contradictions exist (e.g. budget approved vs still under review), emit TWO insights side-by-side each citing its own chunk_ids, and set flag="contradiction" on both. Set section_confidence lower when contradictions are present.
If a section is unsupported, still emit it with status="unsupported", section_confidence <= 0.3, and one insight with text like "Insufficient source coverage for X." and flag="insufficient".
Confidence heuristic: 0.85+ if directly stated in one clear source; 0.6-0.8 if inferred but well-supported; 0.4-0.6 if qualified/hedged in source; below 0.5 if contradicted or thin.
"""


CHAT_SYSTEM_PROMPT = """You are Sales Morse's follow-up assistant. Answer follow-up questions grounded STRICTLY in the uploaded source chunks.

Rules:
- Never fabricate. If the answer isn't in the sources, respond with insufficient="true" and a short reason.
- Preserve qualifiers verbatim ("maybe", "possibly", "pending").
- If sources contradict, surface both with their chunk_ids.
- Refuse out-of-scope requests (sending email, searching web, external actions) with insufficient="true" and reason "Out of scope".

Return ONE JSON object (no markdown, no prose outside JSON):
{
  "insufficient": true | false,
  "reason": "<short reason if insufficient>",
  "answer_spans": [
    {"text": "one sentence", "chunk_ids": ["<id>"], "confidence": 0.0-1.0, "flag": null | "contradiction" | "qualifier"}
  ]
}
Emit answer_spans as a sequence of sentence-level spans. If insufficient=true, emit answer_spans=[].
"""


def _format_chunks_for_prompt(chunks: List[Dict]) -> str:
    lines = []
    for c in chunks:
        lines.append(
            f"[chunk_id={c['chunk_id']} | source={c['source_label']} | file={c['filename']}]\n{c['text']}"
        )
    return "\n\n---\n\n".join(lines)


def _extract_json(raw: str) -> Optional[dict]:
    if not raw:
        return None
    # try direct parse
    try:
        return json.loads(raw)
    except Exception:
        pass
    # find first { ... last }
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            return None
    return None


SECTION_SPECS = [
    ("solution_fit", "SOLUTION FIT",
     "Where our product addresses this prospect's pain. Flag as strong/uncertain/unsupported."),
    ("account_snapshot", "ACCOUNT SNAPSHOT",
     "Deal stage, last interaction, urgency signals, stakeholder roles (economic buyer, champion, influencer, blocker) where sources support it."),
    ("intent_signals", "INTENT SIGNALS",
     "Budget, objections, timeline, blockers. If sources conflict, show BOTH sides with flag='contradiction' and lower confidence. Never silently resolve."),
    ("commitments", "COMMITMENTS & OPEN QUESTIONS",
     "Agreed actions and unresolved items."),
    ("competitive", "COMPETITIVE & INDUSTRY CONTEXT",
     "Competitors mentioned, trigger events, relevant pressures."),
]


SECTION_SYSTEM_PROMPT = """You are Sales Morse. Generate exactly ONE section of a Sales Brief from the provided source chunks.

CRITICAL RULES:
- Never fabricate. Every insight cites specific chunk_ids from the provided chunks.
- Preserve qualifiers verbatim ("maybe", "possibly", "pending"). Never state hedged claims as fact.
- If sources contradict, emit TWO parallel insights each citing their own chunk_ids, both with flag="contradiction". Lower section_confidence when contradictions exist.
- If the section cannot be supported by the sources, return status="unsupported", section_confidence<=0.3, and one insight with text like "Insufficient source coverage for X." and flag="insufficient".
- Direct, honest tone. No filler.

Return ONE JSON object only (no prose, no markdown fences):
{
  "id": "<section_id>",
  "title": "<SECTION TITLE>",
  "status": "strong" | "uncertain" | "unsupported",
  "section_confidence": 0.0-1.0,
  "insights": [
    {"text": "one sentence", "chunk_ids": ["..."], "confidence": 0.0-1.0, "flag": null | "contradiction" | "qualifier" | "insufficient"}
  ]
}
Confidence heuristic: 0.85+ if directly stated; 0.6-0.8 if inferred but supported; 0.4-0.6 if qualified in source; below 0.5 if contradicted.
"""


async def generate_section(section_id: str, title: str, purpose: str, chunks: List[Dict]) -> Dict:
    context = _format_chunks_for_prompt(chunks)
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"sec-{section_id}-{uuid.uuid4()}",
        system_message=SECTION_SYSTEM_PROMPT,
    ).with_model(MODEL_PROVIDER, MODEL_NAME)
    user_text = (
        f"Section id: {section_id}\nTitle: {title}\nPurpose: {purpose}\n\n"
        f"Source chunks:\n\n{context}\n\nReturn ONLY the JSON object."
    )
    response = await chat.send_message(UserMessage(text=user_text))
    parsed = _extract_json(response) or {
        "id": section_id,
        "title": title,
        "status": "unsupported",
        "section_confidence": 0.0,
        "insights": [{"text": "Model returned an unparseable response.", "chunk_ids": [], "confidence": 0.0, "flag": "insufficient"}],
    }
    # ensure required keys
    parsed.setdefault("id", section_id)
    parsed.setdefault("title", title)
    parsed.setdefault("status", "uncertain")
    parsed.setdefault("section_confidence", 0.5)
    parsed.setdefault("insights", [])
    return parsed


async def generate_brief(chunks: List[Dict]) -> Dict:
    """Call LLM to generate the structured brief."""
    if not chunks:
        return {"overall_confidence": 0.0, "sections": []}

    context = _format_chunks_for_prompt(chunks)
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"brief-{uuid.uuid4()}",
        system_message=BRIEF_SYSTEM_PROMPT,
    ).with_model(MODEL_PROVIDER, MODEL_NAME)

    user_text = (
        "Here are the uploaded source chunks. Decode them into a Sales Brief following the JSON schema.\n\n"
        f"{context}\n\n"
        "Return ONLY the JSON object."
    )
    response = await chat.send_message(UserMessage(text=user_text))
    parsed = _extract_json(response)
    if not parsed:
        # fallback empty structure
        parsed = {
            "overall_confidence": 0.0,
            "sections": [
                {
                    "id": sid,
                    "title": title,
                    "status": "unsupported",
                    "section_confidence": 0.0,
                    "insights": [
                        {
                            "text": "Model returned an unparseable response. Please regenerate.",
                            "chunk_ids": [],
                            "confidence": 0.0,
                            "flag": "insufficient",
                        }
                    ],
                }
                for sid, title in [
                    ("solution_fit", "SOLUTION FIT"),
                    ("account_snapshot", "ACCOUNT SNAPSHOT"),
                    ("intent_signals", "INTENT SIGNALS"),
                    ("commitments", "COMMITMENTS & OPEN QUESTIONS"),
                    ("competitive", "COMPETITIVE & INDUSTRY CONTEXT"),
                ]
            ],
        }
    return parsed


async def answer_followup(question: str, chunks: List[Dict]) -> Dict:
    """Retrieve top chunks and ask LLM to answer with citations."""
    top = retrieve_top_k(question, chunks, k=6)
    context = _format_chunks_for_prompt(top)
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"chat-{uuid.uuid4()}",
        system_message=CHAT_SYSTEM_PROMPT,
    ).with_model(MODEL_PROVIDER, MODEL_NAME)

    user_text = (
        f"Question: {question}\n\n"
        f"Retrieved source chunks:\n\n{context}\n\n"
        "Return ONLY the JSON object."
    )
    response = await chat.send_message(UserMessage(text=user_text))
    parsed = _extract_json(response)
    if not parsed:
        parsed = {
            "insufficient": True,
            "reason": "Model returned an unparseable response.",
            "answer_spans": [],
        }
    return parsed
