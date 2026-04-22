import json
import urllib.parse
import urllib.request
import urllib.error
import uuid


BASE = "http://127.0.0.1:8000"


def req(method: str, path: str, headers=None, body=None):
    data = None
    hdrs = dict(headers or {})
    if body is not None:
        if isinstance(body, (dict, list)):
            data = json.dumps(body).encode("utf-8")
            hdrs["Content-Type"] = "application/json"
        elif isinstance(body, (bytes, bytearray)):
            data = body
        else:
            data = str(body).encode("utf-8")
    r = urllib.request.Request(BASE + path, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            b = resp.read()
            if not b:
                return resp.status, None
            return resp.status, json.loads(b.decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {path} -> {e.code}: {e.read().decode('utf-8', errors='replace')}") from None


def main() -> None:
    email = f"cmt_{uuid.uuid4().hex[:8]}@example.com"
    pw = "Passw0rd!123"
    req("POST", "/register", body={"email": email, "password": pw})

    form = urllib.parse.urlencode({"username": email, "password": pw}).encode("utf-8")
    _, login = req(
        "POST",
        "/login",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        body=form,
    )
    token = login["access_token"]
    H = {"Authorization": f"Bearer {token}"}

    _, proj = req("POST", "/projects", headers=H, body={"name": "C", "description": "", "kind": "general"})
    _, task = req("POST", "/tasks", headers=H, body={"project_id": proj["id"], "title": "T", "status": "todo"})

    _, cl0 = req("GET", f"/comments?{urllib.parse.urlencode({'task_id': task['id']})}", headers=H)
    assert cl0 == [], cl0

    _, c = req(
        "POST",
        "/comments",
        headers=H,
        body={"task_id": task["id"], "body": "hi @someone@example.com @Someone@example.com"},
    )
    assert c["mentions"] == ["someone@example.com"], c

    _, cl1 = req("GET", f"/comments?{urllib.parse.urlencode({'task_id': task['id']})}", headers=H)
    assert len(cl1) == 1, cl1

    # timeline: should include comment_created
    _, tl1 = req("GET", f"/timeline?{urllib.parse.urlencode({'task_id': task['id']})}", headers=H)
    assert any(ev["type"] == "comment_created" for ev in tl1), tl1

    status, _ = req("DELETE", f"/comments/{c['id']}", headers=H)
    assert status == 204, status

    # timeline: should include comment_deleted snapshot even though comment removed
    _, tl2 = req("GET", f"/timeline?{urllib.parse.urlencode({'task_id': task['id']})}", headers=H)
    assert any(ev["type"] == "comment_deleted" for ev in tl2), tl2

    _, cl2 = req("GET", f"/comments?{urllib.parse.urlencode({'task_id': task['id']})}", headers=H)
    assert cl2 == [], cl2

    print("OK: feature4 comments", {"task_id": task["id"], "project_id": proj["id"]})


if __name__ == "__main__":
    main()

