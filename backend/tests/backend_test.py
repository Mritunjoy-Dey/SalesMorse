"""Sales Morse backend tests — iteration 3 (SSE streaming, demo accounts, contradictions)."""
import json
import os
import uuid

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

EXPECTED_SECTIONS = {"solution_fit", "account_snapshot", "intent_signals", "commitments", "competitive"}


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    return s


def new_session():
    return f"TEST-sess-{uuid.uuid4()}"


# ---------- Module: health / demo accounts ----------
class TestDemoAccounts:
    def test_root(self, client):
        r = client.get(f"{API}/", timeout=30)
        assert r.status_code == 200
        assert "message" in r.json()

    def test_demo_accounts_list(self, client):
        r = client.get(f"{API}/demo-accounts", timeout=30)
        assert r.status_code == 200
        accounts = r.json()["accounts"]
        assert len(accounts) == 3
        ids = [a["id"] for a in accounts]
        assert ids == ["brightline", "nimbus", "zenith"] or set(ids) == {"brightline", "nimbus", "zenith"}
        for a in accounts:
            assert len(a["file_ids"]) == 3, f"{a['id']} should expose 3 file_ids"
            assert a["name"] and a["tagline"]


# ---------- Module: session / load-demo append semantics ----------
class TestLoadDemo:
    def test_init_with_demo_loads_brightline(self, client):
        sid = new_session()
        r = client.post(f"{API}/session/init?load_demo=true", json={"session_id": sid}, timeout=30)
        assert r.status_code == 200
        files = r.json()["files"]
        assert len(files) == 3
        assert all(f["is_demo"] for f in files)
        assert all(f["id"].startswith("demo-brightline") for f in files)

    def test_load_nimbus_appends_and_is_idempotent(self, client):
        sid = new_session()
        client.post(f"{API}/session/init?load_demo=true", json={"session_id": sid}, timeout=30)
        r = client.post(f"{API}/session/load-demo?account_id=nimbus", json={"session_id": sid}, timeout=30)
        assert r.status_code == 200
        files = r.json()["files"]
        ids = [f["id"] for f in files]
        assert len(ids) == 6, ids
        assert sum(1 for i in ids if i.startswith("demo-brightline")) == 3
        assert sum(1 for i in ids if i.startswith("demo-nimbus")) == 3

        # second call must not duplicate
        r2 = client.post(f"{API}/session/load-demo?account_id=nimbus", json={"session_id": sid}, timeout=30)
        ids2 = [f["id"] for f in r2.json()["files"]]
        assert len(ids2) == 6
        assert len(set(ids2)) == 6

        # load zenith -> 9
        r3 = client.post(f"{API}/session/load-demo?account_id=zenith", json={"session_id": sid}, timeout=30)
        ids3 = [f["id"] for f in r3.json()["files"]]
        assert len(ids3) == 9
        assert len(set(ids3)) == 9

    def test_delete_then_reload_restores_only_missing(self, client):
        sid = new_session()
        client.post(f"{API}/session/init?load_demo=true", json={"session_id": sid}, timeout=30)
        r = client.delete(f"{API}/file/{sid}/demo-brightline-email", timeout=30)
        assert r.status_code == 200
        assert len(r.json()["files"]) == 2
        r2 = client.post(f"{API}/session/load-demo?account_id=brightline", json={"session_id": sid}, timeout=30)
        ids = [f["id"] for f in r2.json()["files"]]
        assert len(ids) == 3 and "demo-brightline-email" in ids

    def test_upload_appends_without_removing_demo(self, client):
        sid = new_session()
        client.post(f"{API}/session/init?load_demo=true", json={"session_id": sid}, timeout=30)
        files = {"files": ("TEST_user_note.txt", b"Account: TestCo\nDeal stage: negotiation\nBudget approved for Q4.", "text/plain")}
        r = client.post(f"{API}/upload?session_id={sid}", files=files, timeout=60)
        assert r.status_code == 200
        out = r.json()["files"]
        assert len(out) == 4
        assert sum(1 for f in out if f["is_demo"]) == 3
        user = [f for f in out if not f["is_demo"]][0]
        assert user["filename"] == "TEST_user_note.txt"
        assert user["size"] > 0

        # file content + download still work
        c = client.get(f"{API}/file/{sid}/{user['id']}/content", timeout=30)
        assert c.status_code == 200 and "TestCo" in c.json()["content"]
        d = client.get(f"{API}/file/{sid}/{user['id']}/download", timeout=30)
        assert d.status_code == 200 and "attachment" in d.headers.get("content-disposition", "")

    def test_missing_file_404(self, client):
        sid = new_session()
        r = client.get(f"{API}/file/{sid}/nope/content", timeout=30)
        assert r.status_code == 404


# ---------- Module: SSE streaming brief ----------
def _consume_sse(sid, timeout=180):
    events = []
    with requests.get(f"{API}/brief/stream?session_id={sid}", stream=True, timeout=timeout) as r:
        assert r.status_code == 200, r.text[:300]
        headers = r.headers  # CaseInsensitiveDict
        buf = ""
        for raw in r.iter_content(chunk_size=1, decode_unicode=True):
            buf += raw
            while "\n\n" in buf:
                frame, buf = buf.split("\n\n", 1)
                ev, data = "message", ""
                for ln in frame.split("\n"):
                    if ln.startswith("event:"):
                        ev = ln[6:].strip()
                    elif ln.startswith("data:"):
                        data += ln[5:].strip()
                if data:
                    events.append((ev, json.loads(data)))
            if events and events[-1][0] == "done":
                break
    return headers, events


@pytest.fixture(scope="module")
def stream_result():
    sid = new_session()
    requests.post(f"{API}/session/init?load_demo=true", json={"session_id": sid}, timeout=30)
    headers, events = _consume_sse(sid)
    return sid, headers, events


class TestBriefStream:
    def test_stream_requires_sources(self):
        sid = new_session()
        r = requests.get(f"{API}/brief/stream?session_id={sid}", timeout=30)
        assert r.status_code == 400

    def test_headers(self, stream_result):
        _, headers, _ = stream_result
        assert "text/event-stream" in headers.get("content-type", "")
        # NOTE: backend sets X-Accel-Buffering: no (verified at origin :8001) but the
        # preview CDN/ingress strips it from the public response. Not a code defect.

    def test_stream_is_incremental(self):
        """Sections must arrive progressively, not all at once at the end."""
        import time
        sid = new_session()
        requests.post(f"{API}/session/init?load_demo=true", json={"session_id": sid}, timeout=30)
        stamps = []
        start = time.time()
        with requests.get(f"{API}/brief/stream?session_id={sid}", stream=True, timeout=180) as r:
            buf = ""
            for raw in r.iter_content(chunk_size=1, decode_unicode=True):
                buf += raw
                while "\n\n" in buf:
                    frame, buf = buf.split("\n\n", 1)
                    if frame.startswith("event: section"):
                        stamps.append(round(time.time() - start, 2))
                    if frame.startswith("event: done"):
                        buf = ""
                        break
                if len(stamps) == 5:
                    break
        assert len(stamps) == 5, stamps
        spread = stamps[-1] - stamps[0]
        assert spread > 0.2, f"sections arrived nearly simultaneously (buffered?): {stamps}"

    def test_event_sequence(self, stream_result):
        _, _, events = stream_result
        names = [e[0] for e in events]
        assert names[0] == "meta", names
        assert names[-1] == "done", names
        assert names.count("section") == 5, names
        assert names.count("done") == 1

    def test_meta_payload(self, stream_result):
        _, _, events = stream_result
        meta = events[0][1]
        assert len(meta["chunks"]) > 0
        assert all(k in meta["chunks"][0] for k in ("chunk_id", "file_id", "text", "source_label"))
        assert len(meta["files"]) == 3
        assert meta["account"] == "Brightline Analytics"

    def test_section_payloads(self, stream_result):
        _, _, events = stream_result
        sections = [p for n, p in events if n == "section"]
        got_ids = {s["id"] for s in sections}
        assert got_ids == EXPECTED_SECTIONS, got_ids
        for s in sections:
            assert s["title"]
            assert s["status"] in ("strong", "uncertain", "unsupported"), s["status"]
            assert 0.0 <= float(s["section_confidence"]) <= 1.0
            assert isinstance(s["insights"], list) and len(s["insights"]) > 0
            for ins in s["insights"]:
                assert ins["text"]
                assert isinstance(ins.get("chunk_ids", []), list)

    def test_done_overall_confidence(self, stream_result):
        _, _, events = stream_result
        done = events[-1][1]
        assert 0.0 <= float(done["overall_confidence"]) <= 1.0

    def test_intent_signals_flags_contradiction(self, stream_result):
        _, _, events = stream_result
        intent = [p for n, p in events if n == "section" and p["id"] == "intent_signals"][0]
        flags = [i.get("flag") for i in intent["insights"]]
        assert "contradiction" in flags, flags

    def test_chunk_ids_are_valid(self, stream_result):
        _, _, events = stream_result
        valid = {c["chunk_id"] for c in events[0][1]["chunks"]}
        for n, p in events:
            if n != "section":
                continue
            for ins in p["insights"]:
                for cid in ins.get("chunk_ids", []):
                    assert cid in valid, f"hallucinated chunk id {cid} in {p['id']}"

    def test_brief_persisted_after_stream(self, stream_result):
        sid, _, _ = stream_result
        r = requests.get(f"{API}/brief/{sid}", timeout=30)
        assert r.status_code == 200
        brief = r.json()["brief"]
        assert brief is not None
        assert len(brief["sections"]) == 5
        assert 0.0 <= brief["overall_confidence"] <= 1.0


# ---------- Module: chat + feedback regression ----------
class TestChatFeedback:
    def test_chat_grounded(self):
        sid = new_session()
        requests.post(f"{API}/session/init?load_demo=true", json={"session_id": sid}, timeout=30)
        r = requests.post(f"{API}/chat", json={"session_id": sid, "question": "What is the budget status?"}, timeout=180)
        assert r.status_code == 200
        reply = r.json()["reply"]
        assert "insufficient" in reply
        if not reply["insufficient"]:
            assert len(reply["answer_spans"]) > 0

    def test_chat_out_of_scope(self):
        sid = new_session()
        requests.post(f"{API}/session/init?load_demo=true", json={"session_id": sid}, timeout=30)
        r = requests.post(f"{API}/chat", json={"session_id": sid, "question": "Please send an email to the CFO"}, timeout=60)
        assert r.status_code == 200
        assert r.json()["reply"]["insufficient"] is True

    def test_chat_empty_question_400(self):
        sid = new_session()
        requests.post(f"{API}/session/init?load_demo=true", json={"session_id": sid}, timeout=30)
        r = requests.post(f"{API}/chat", json={"session_id": sid, "question": "  "}, timeout=30)
        assert r.status_code == 400

    def test_feedback(self):
        sid = new_session()
        r = requests.post(f"{API}/feedback", json={"session_id": sid, "vote": "up", "comment": "TEST_ok"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["feedback"]["vote"] == "up"
        bad = requests.post(f"{API}/feedback", json={"session_id": sid, "vote": "sideways"}, timeout=30)
        assert bad.status_code == 400
