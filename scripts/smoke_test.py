import json
import sys
import time

import requests


BASE = "http://127.0.0.1:8000"


def post(path: str, payload: dict):
    r = requests.post(BASE + path, json=payload, timeout=10)
    r.raise_for_status()
    return r.json()


def get(path: str):
    r = requests.get(BASE + path, timeout=10)
    r.raise_for_status()
    return r.json()


def main():
    print("[smoke] creating session for user1")
    sess = post("/session", {"user_id": "user1"})
    session_id = sess["session_id"]
    print(f"[smoke] session_id: {session_id}")

    print("[smoke] ingesting entry")
    ing = post("/ingest", {"text": "I felt anxious about exams", "user_id": "user1", "session_id": session_id})
    trace_id = ing["trace_id"]
    print(f"[smoke] trace_id: {trace_id}")

    print("[smoke] waiting for orchestrator result")
    deadline = time.time() + 60
    result = None
    while time.time() < deadline:
        try:
            res = get(f"/result/{trace_id}")
            if res and ("past" in res or "error" in res):
                result = res
                break
        except Exception:
            pass
        time.sleep(1.0)

    if not result:
        print("[smoke] no result within timeout", file=sys.stderr)
        sys.exit(2)

    if "error" in result:
        print(f"[smoke] orchestrator error: {result['error']}")
    else:
        print("[smoke] Past:")
        print(json.dumps(result.get("past", {}), indent=2))
        print("[smoke] Present:")
        print(json.dumps(result.get("present", {}), indent=2))
        print("[smoke] Future:")
        print(json.dumps(result.get("future", {}), indent=2))
        print("[smoke] Integration:")
        print(json.dumps(result.get("integration", {}), indent=2))

    print("[smoke] sending rating 4")
    _ = post("/eval", {"trace_id": trace_id, "user_id": "user1", "rating": 4, "comments": "smoke"})

    print("[smoke] enqueue long_healing_journey")
    job = post(f"/tasks/journey/{session_id}", {})
    print(f"[smoke] job_id: {job.get('job_id')}")

    print("[smoke] pause session")
    _ = post(f"/session/{session_id}/pause", {})
    time.sleep(1.0)
    print("[smoke] resume session")
    _ = post(f"/session/{session_id}/resume", {})

    print("[smoke] done")


if __name__ == "__main__":
    main()