import json
import asyncio
import urllib.parse
import urllib.request
import uuid


BASE = "http://127.0.0.1:8000"


def req(method: str, path: str, *, headers: dict[str, str] | None = None, body=None):
    url = BASE + path
    data = None
    hdrs = dict(headers or {})
    if body is not None:
        if isinstance(body, (dict, list)):
            data = json.dumps(body).encode("utf-8")
            hdrs.setdefault("Content-Type", "application/json")
        elif isinstance(body, (bytes, bytearray)):
            data = body
        else:
            data = str(body).encode("utf-8")
    r = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            b = resp.read()
            ct = resp.headers.get("content-type", "")
            if not b:
                return resp.status, None
            if "application/json" in ct:
                return resp.status, json.loads(b.decode("utf-8"))
            return resp.status, b.decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        b = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {path} -> {e.code}: {b}") from None


def main() -> None:
    email = f"test_links_{uuid.uuid4().hex[:8]}@example.com"
    password = "Passw0rd!123"

    status, _ = req("POST", "/register", body={"email": email, "password": password})
    if status not in (200, 201):
        raise RuntimeError(f"register status {status}")

    form = urllib.parse.urlencode({"username": email, "password": password}).encode("utf-8")
    status, login = req(
        "POST",
        "/login",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        body=form,
    )
    assert status == 200, status
    token = login["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    status, proj = req(
        "POST",
        "/projects",
        headers=headers,
        body={"name": "Links Test", "description": "", "kind": "general"},
    )
    assert status in (200, 201), (status, proj)
    project_id = proj["id"]

    status, t1 = req(
        "POST",
        "/tasks",
        headers=headers,
        body={"project_id": project_id, "title": "Task A", "status": "todo"},
    )
    status, t2 = req(
        "POST",
        "/tasks",
        headers=headers,
        body={"project_id": project_id, "title": "Task B", "status": "todo"},
    )
    a, b = t1["id"], t2["id"]

    async def ws_expect(event_type: str, action_coro):
        import websockets

        ws_url = f"ws://127.0.0.1:8000/ws/{project_id}?token={urllib.parse.quote(token)}"
        async with websockets.connect(ws_url, open_timeout=10) as ws:
            # run action, then read events until found or timeout
            await action_coro()
            deadline = asyncio.get_running_loop().time() + 5.0
            while True:
                timeout = max(0.1, deadline - asyncio.get_running_loop().time())
                if timeout <= 0:
                    raise AssertionError(f"WS event not received: {event_type}")
                raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
                msg = json.loads(raw)
                if msg.get("type") == event_type:
                    return msg

    status, links0 = req(
        "GET",
        f"/task-links?{urllib.parse.urlencode({'project_id': project_id})}",
        headers=headers,
    )
    assert links0 == [], links0

    async def action_create_blocks():
        s, _ = req(
            "POST",
            "/task-links",
            headers=headers,
            body={"project_id": project_id, "from_task_id": a, "to_task_id": b, "type": "blocks"},
        )
        assert s in (200, 201), s

    ws_msg = asyncio.run(ws_expect("link_created", action_create_blocks))
    assert ws_msg.get("project_id") == project_id
    assert ws_msg.get("from_task_id") == a and ws_msg.get("to_task_id") == b
    assert ws_msg.get("link_type") == "blocks"

    status, links1 = req(
        "GET",
        f"/task-links?{urllib.parse.urlencode({'project_id': project_id})}",
        headers=headers,
    )
    assert len(links1) == 1, links1
    assert links1[0]["type"] == "blocks"
    assert links1[0]["from_task_id"] == a and links1[0]["to_task_id"] == b

    async def action_delete_blocks():
        s, _ = req(
            "DELETE",
            f"/task-links?{urllib.parse.urlencode({'project_id': project_id, 'from_task_id': a, 'to_task_id': b, 'type': 'blocks'})}",
            headers=headers,
        )
        assert s == 204, s

    ws_msg = asyncio.run(ws_expect("link_deleted", action_delete_blocks))
    assert ws_msg.get("project_id") == project_id
    assert ws_msg.get("from_task_id") == a and ws_msg.get("to_task_id") == b
    assert ws_msg.get("link_type") == "blocks"

    status, _ = req(
        "POST",
        "/task-links",
        headers=headers,
        body={"project_id": project_id, "from_task_id": a, "to_task_id": b, "type": "relates"},
    )
    assert status in (200, 201), status

    status, links2 = req(
        "GET",
        f"/task-links?{urllib.parse.urlencode({'project_id': project_id})}",
        headers=headers,
    )
    assert len(links2) == 2, links2
    pairs = {(l["from_task_id"], l["to_task_id"]) for l in links2}
    assert (a, b) in pairs and (b, a) in pairs, pairs

    status, _ = req(
        "DELETE",
        f"/task-links?{urllib.parse.urlencode({'project_id': project_id, 'from_task_id': a, 'to_task_id': b, 'type': 'relates'})}",
        headers=headers,
    )
    assert status == 204, status

    status, links3 = req(
        "GET",
        f"/task-links?{urllib.parse.urlencode({'project_id': project_id})}",
        headers=headers,
    )
    assert links3 == [], links3

    print("OK: feature2 link CRUD + WS", {"project_id": project_id, "taskA": a, "taskB": b})


if __name__ == "__main__":
    main()

