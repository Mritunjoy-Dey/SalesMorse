import io
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, File, HTTPException, UploadFile
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi.responses import Response, StreamingResponse  # noqa: E402

from brief_service import (  # noqa: E402
    SOURCE_TYPE_LABELS,
    answer_followup,
    build_chunks_from_files,
    generate_brief,
)
from demo_data import (  # noqa: E402
    DEFAULT_ACCOUNT_ID,
    DEMO_ACCOUNT,
    DEMO_ACCOUNTS,
    DEMO_FILE_IDS,
    DEMO_FILES,
    account_files_by_id,
)

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Sales Morse")
api_router = APIRouter(prefix="/api")

# ---------- In-memory session store (single-tenant, in-session scope) ----------
# session_id -> {"files": [...], "chunks": [...], "brief": {...}, "chat": [...], "feedback": [...]}
SESSIONS: Dict[str, Dict] = {}


def _get_session(session_id: str) -> Dict:
    if session_id not in SESSIONS:
        SESSIONS[session_id] = {
            "files": [],
            "chunks": [],
            "brief": None,
            "chat": [],
            "feedback": [],
        }
    return SESSIONS[session_id]


# ---------- Models ----------
class SessionInit(BaseModel):
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))


class FileMeta(BaseModel):
    id: str
    filename: str
    source_type: str
    source_label: str
    uploaded_at: str
    is_demo: bool = False
    size: int = 0


class UploadResponse(BaseModel):
    session_id: str
    files: List[FileMeta]


class GenerateBriefRequest(BaseModel):
    session_id: str


class ChatRequest(BaseModel):
    session_id: str
    question: str


class FeedbackRequest(BaseModel):
    session_id: str
    vote: str  # "up" | "down"
    comment: Optional[str] = None


# ---------- Helpers ----------
def _infer_source_type(filename: str, content: str) -> str:
    lower = filename.lower()
    if any(k in lower for k in ["crm", "note", "account"]):
        return "crm"
    if any(k in lower for k in ["email", "mail", "thread"]):
        return "email"
    if any(k in lower for k in ["transcript", "call", "meeting"]):
        return "transcript"
    # content heuristic
    head = content[:400].lower()
    if re.search(r"^from:\s", head, re.MULTILINE) or "subject:" in head:
        return "email"
    if "transcript" in head or re.search(r"^\[.*\]", head):
        return "transcript"
    if "deal stage" in head or "account:" in head:
        return "crm"
    return "doc"


def _parse_file(filename: str, raw: bytes) -> str:
    lower = filename.lower()
    if lower.endswith(".txt") or lower.endswith(".md"):
        return raw.decode("utf-8", errors="ignore")
    if lower.endswith(".pdf"):
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(io.BytesIO(raw))
            return "\n\n".join((p.extract_text() or "") for p in reader.pages)
        except Exception as e:
            raise HTTPException(400, f"Could not read PDF: {e}")
    if lower.endswith(".docx"):
        try:
            import docx
            document = docx.Document(io.BytesIO(raw))
            return "\n\n".join(p.text for p in document.paragraphs if p.text.strip())
        except Exception as e:
            raise HTTPException(400, f"Could not read DOCX: {e}")
    # fallback: try to decode as text
    return raw.decode("utf-8", errors="ignore")


def _refresh_chunks(session: Dict) -> None:
    session["chunks"] = build_chunks_from_files(session["files"])


def _file_meta(f: Dict) -> FileMeta:
    return FileMeta(
        id=f["id"],
        filename=f["filename"],
        source_type=f["source_type"],
        source_label=SOURCE_TYPE_LABELS.get(f["source_type"], "Document"),
        uploaded_at=f["uploaded_at"],
        is_demo=f["id"] in DEMO_FILE_IDS,
        size=len(f.get("content", "") or ""),
    )


def _append_demo_files(session: Dict, account_id: str = DEFAULT_ACCOUNT_ID) -> None:
    """Idempotently append missing demo files for the given account."""
    now = datetime.now(timezone.utc).isoformat()
    existing_ids = {f["id"] for f in session["files"]}
    files, account_name = account_files_by_id(account_id)
    added = False
    for f in files:
        if f["id"] in existing_ids:
            continue
        session["files"].append(
            {
                "id": f["id"],
                "filename": f["filename"],
                "source_type": f["source_type"],
                "content": f["content"],
                "uploaded_at": now,
                "demo_account_id": account_id,
                "demo_account_name": account_name,
            }
        )
        added = True
    if added:
        _refresh_chunks(session)
        session["brief"] = None


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Sales Morse API", "model": "gpt-5.6-terra"}


@api_router.post("/session/init", response_model=UploadResponse)
async def init_session(body: SessionInit, load_demo: bool = False):
    session = _get_session(body.session_id)
    if load_demo and not session["files"]:
        _append_demo_files(session)
    return UploadResponse(
        session_id=body.session_id,
        files=[_file_meta(f) for f in session["files"]],
    )


@api_router.post("/session/load-demo", response_model=UploadResponse)
async def load_demo(body: SessionInit, account_id: str = DEFAULT_ACCOUNT_ID):
    """Idempotently append demo files for the chosen account. Never removes anything."""
    session = _get_session(body.session_id)
    _append_demo_files(session, account_id)
    return UploadResponse(
        session_id=body.session_id,
        files=[_file_meta(f) for f in session["files"]],
    )


@api_router.get("/demo-accounts")
async def list_demo_accounts():
    return {
        "accounts": [
            {
                "id": a["id"],
                "name": a["name"],
                "tagline": a["tagline"],
                "file_ids": [f["id"] for f in a["files"]],
            }
            for a in DEMO_ACCOUNTS.values()
        ]
    }


@api_router.get("/file/{session_id}/{file_id}/content")
async def get_file_content(session_id: str, file_id: str):
    session = _get_session(session_id)
    for f in session["files"]:
        if f["id"] == file_id:
            return {
                "id": f["id"],
                "filename": f["filename"],
                "source_type": f["source_type"],
                "source_label": SOURCE_TYPE_LABELS.get(f["source_type"], "Document"),
                "is_demo": f["id"] in DEMO_FILE_IDS,
                "content": f["content"],
                "uploaded_at": f["uploaded_at"],
            }
    raise HTTPException(404, "File not found")


@api_router.get("/file/{session_id}/{file_id}/download")
async def download_file(session_id: str, file_id: str):
    session = _get_session(session_id)
    for f in session["files"]:
        if f["id"] == file_id:
            filename = f["filename"]
            # ensure .txt extension for demo/text content
            if not any(filename.lower().endswith(ext) for ext in (".txt", ".md", ".pdf", ".docx")):
                filename = filename + ".txt"
            return Response(
                content=f["content"],
                media_type="text/plain; charset=utf-8",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                },
            )
    raise HTTPException(404, "File not found")


@api_router.post("/upload", response_model=UploadResponse)
async def upload_files(
    session_id: str,
    files: List[UploadFile] = File(...),
):
    session = _get_session(session_id)
    now = datetime.now(timezone.utc).isoformat()
    for f in files:
        raw = await f.read()
        text = _parse_file(f.filename or "file.txt", raw)
        if not text.strip():
            continue
        stype = _infer_source_type(f.filename or "", text)
        session["files"].append(
            {
                "id": f"file-{uuid.uuid4()}",
                "filename": f.filename or "file.txt",
                "source_type": stype,
                "content": text,
                "uploaded_at": now,
            }
        )
    _refresh_chunks(session)
    # Invalidate stale brief when new files come in
    session["brief"] = None
    return UploadResponse(
        session_id=session_id,
        files=[_file_meta(f) for f in session["files"]],
    )


@api_router.delete("/file/{session_id}/{file_id}")
async def delete_file(session_id: str, file_id: str):
    session = _get_session(session_id)
    session["files"] = [f for f in session["files"] if f["id"] != file_id]
    _refresh_chunks(session)
    session["brief"] = None
    return {"ok": True, "files": [_file_meta(f) for f in session["files"]]}


@api_router.post("/brief/generate")
async def brief_generate(body: GenerateBriefRequest):
    session = _get_session(body.session_id)
    if not session["chunks"]:
        raise HTTPException(400, "No sources uploaded yet.")
    brief = await generate_brief(session["chunks"])
    session["brief"] = brief
    # Return chunks so the frontend can hydrate the citation panel
    return {
        "brief": brief,
        "chunks": session["chunks"],
        "files": [_file_meta(f) for f in session["files"]],
        "account": _detect_account(session),
    }


def _detect_account(session: Dict) -> Optional[str]:
    for f in session["files"]:
        if f.get("demo_account_name"):
            return f["demo_account_name"]
    return None


@api_router.get("/brief/stream")
async def brief_stream(session_id: str):
    """SSE endpoint that generates 5 sections in parallel and emits each as it completes."""
    import asyncio
    import json as _json

    session = _get_session(session_id)
    if not session["chunks"]:
        raise HTTPException(400, "No sources uploaded yet.")
    chunks = session["chunks"]

    async def gen():
        # meta first
        yield f"event: meta\ndata: {_json.dumps({'chunks': chunks, 'files': [_file_meta(f).model_dump() for f in session['files']], 'account': _detect_account(session)})}\n\n"

        # kick off all sections in parallel; wrap each so it retains its section id on error
        from brief_service import SECTION_SPECS, generate_section  # local import

        async def _run_section(sid, title, purpose):
            try:
                return await generate_section(sid, title, purpose, chunks)
            except Exception as e:
                return {
                    "id": sid,
                    "title": title,
                    "status": "unsupported",
                    "section_confidence": 0.0,
                    "insights": [{"text": f"Section failed: {e}", "chunk_ids": [], "confidence": 0.0, "flag": "insufficient"}],
                }

        tasks = [asyncio.create_task(_run_section(sid, title, purpose)) for sid, title, purpose in SECTION_SPECS]
        collected = []
        # emit as each completes
        for coro in asyncio.as_completed(tasks):
            section = await coro
            collected.append(section)
            yield f"event: section\ndata: {_json.dumps(section)}\n\n"

        # compute overall confidence as mean of section confidences
        confs = [s.get("section_confidence", 0.0) for s in collected]
        overall = sum(confs) / max(len(confs), 1)
        brief = {"overall_confidence": overall, "sections": collected}
        # persist
        session["brief"] = brief
        yield f"event: done\ndata: {_json.dumps({'overall_confidence': overall})}\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@api_router.get("/brief/{session_id}")
async def brief_get(session_id: str):
    session = _get_session(session_id)
    return {
        "brief": session.get("brief"),
        "chunks": session.get("chunks", []),
        "files": [_file_meta(f) for f in session["files"]],
    }


@api_router.post("/chat")
async def chat(body: ChatRequest):
    session = _get_session(body.session_id)
    if not session["chunks"]:
        raise HTTPException(400, "No sources uploaded yet.")
    q = (body.question or "").strip()
    if not q:
        raise HTTPException(400, "Empty question.")
    # Basic out-of-scope guard for obvious cases
    lower = q.lower()
    oos_triggers = [
        "send an email", "send email", "search the web", "search google",
        "book a meeting", "call the customer", "post on linkedin",
    ]
    if any(t in lower for t in oos_triggers):
        reply = {
            "insufficient": True,
            "reason": "I'm not able to help with that.",
            "answer_spans": [],
        }
    else:
        reply = await answer_followup(q, session["chunks"])
    session["chat"].append({"role": "user", "text": q})
    session["chat"].append({"role": "assistant", "reply": reply})
    return {"reply": reply, "chunks": session["chunks"]}


@api_router.post("/feedback")
async def feedback(body: FeedbackRequest):
    session = _get_session(body.session_id)
    if body.vote not in ("up", "down"):
        raise HTTPException(400, "vote must be 'up' or 'down'.")
    entry = {
        "vote": body.vote,
        "comment": body.comment or "",
        "at": datetime.now(timezone.utc).isoformat(),
    }
    session["feedback"].append(entry)
    return {"ok": True, "feedback": entry}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
