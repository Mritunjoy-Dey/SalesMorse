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

from brief_service import (  # noqa: E402
    SOURCE_TYPE_LABELS,
    answer_followup,
    build_chunks_from_files,
    generate_brief,
)
from demo_data import DEMO_ACCOUNT, DEMO_FILES  # noqa: E402

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
    )


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Sales Morse API", "model": "gpt-5.6-terra"}


@api_router.post("/session/init", response_model=UploadResponse)
async def init_session(body: SessionInit, load_demo: bool = False):
    session = _get_session(body.session_id)
    if load_demo and not session["files"]:
        now = datetime.now(timezone.utc).isoformat()
        for f in DEMO_FILES:
            session["files"].append(
                {
                    "id": f["id"],
                    "filename": f["filename"],
                    "source_type": f["source_type"],
                    "content": f["content"],
                    "uploaded_at": now,
                }
            )
        _refresh_chunks(session)
    return UploadResponse(
        session_id=body.session_id,
        files=[_file_meta(f) for f in session["files"]],
    )


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
        "account": DEMO_ACCOUNT if any(f["id"].startswith("demo-") for f in session["files"]) else None,
    }


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
