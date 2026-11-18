#!/usr/bin/env python3
"""Small authenticated HTTP bridge: browser -> Hermes -> OpenAI Codex OAuth."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json, os, subprocess, threading, time, sys
from urllib.parse import unquote, urlsplit
sys.path.insert(0, "/opt/codex-bridge")
import drive_context

HOST = "127.0.0.1"
PORT = int(os.getenv("CODEX_BRIDGE_PORT", "8789"))
TOKEN = os.environ["CODEX_BRIDGE_TOKEN"]
ALLOWED_ORIGIN = os.getenv("CODEX_BRIDGE_ORIGIN", "https://tragtenbot.github.io")
MODEL = os.getenv("CODEX_BRIDGE_MODEL", "gpt-5.6-luna")
MAX_PROMPT = int(os.getenv("CODEX_BRIDGE_MAX_PROMPT", "18000"))
TIMEOUT = int(os.getenv("CODEX_BRIDGE_TIMEOUT", "180"))
MIN_INTERVAL = float(os.getenv("CODEX_BRIDGE_MIN_INTERVAL", "2"))
_last_request = 0.0
_lock = threading.Lock()


def json_bytes(payload):
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


def run_hermes(prompt):
    command = [
        "/usr/local/bin/hermes", "chat", "-q", prompt,
        "--provider", "openai-codex", "--model", MODEL, "--quiet",
    ]
    completed = subprocess.run(command, capture_output=True, text=True, timeout=TIMEOUT, check=False)
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "Hermes retornou erro").strip()[-2000:]
        raise RuntimeError(detail)
    lines = [line for line in completed.stdout.splitlines() if not line.startswith("session_id:")]
    text = "\n".join(lines).strip()
    if not text:
        raise RuntimeError("Hermes retornou uma resposta vazia")
    return text


class Handler(BaseHTTPRequestHandler):
    server_version = "CodexBridge/1.0"

    def _headers(self, status=200, content_type="application/json; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        self.end_headers()

    def _reply(self, status, payload):
        body = json_bytes(payload)
        self._headers(status)
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._headers(204)

    def _authorized(self):
        return self.headers.get("Authorization") == "Bearer " + TOKEN

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length > MAX_PROMPT * 4:
            raise ValueError("pedido muito grande")
        return json.loads(self.rfile.read(length))

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/health":
            self._reply(200, {"ok": True, "service": "codex-bridge", "model": MODEL})
            return
        if not self._authorized():
            self._reply(401, {"error": "unauthorized"})
            return
        if path == "/projects":
            self._reply(200, {"projects": drive_context.project_files()})
            return
        if path.startswith("/projects/"):
            project_path = path.split("/", 3)
            try:
                project_id = unquote(project_path[2])
                if len(project_path) == 4 and project_path[3] == "qa":
                    self._reply(200, drive_context.get_qa(project_id))
                elif len(project_path) == 4 and project_path[3] == "tasks":
                    self._reply(200, drive_context.get_tasks(project_id))
                else:
                    self._reply(200, drive_context.get_project(project_id))
            except Exception as exc:
                self._reply(404, {"error": str(exc)})
            return
        self._reply(404, {"error": "not_found"})

    def do_POST(self):
        if not self._authorized():
            self._reply(401, {"error": "unauthorized"})
            return
        try:
            data = self._read_json()
        except (ValueError, json.JSONDecodeError) as exc:
            self._reply(400, {"error": str(exc)})
            return
        if self.path == "/projects":
            try:
                name = str(data.get("name", "Projeto sem título")).strip()[:180]
                text = str(data.get("text", ""))
                if not text.strip(): raise ValueError("projeto vazio")
                self._reply(201, drive_context.create_project(name, text))
            except Exception as exc:
                self._reply(502, {"error": str(exc)})
            return
        if self.path.startswith("/projects/"):
            project_path = self.path.split("/", 3)
            try:
                project_id = unquote(project_path[2])
                payload = data
                if len(project_path) == 4 and project_path[3] == "qa":
                    result = drive_context.append_qa(project_id, str(payload.get("question", "")), str(payload.get("answer", "")))
                elif len(project_path) == 4 and project_path[3] == "tasks":
                    result = drive_context.save_tasks(project_id, payload.get("tasks", []))
                else:
                    self._reply(404, {"error": "not_found"})
                    return
                self._reply(200, result)
            except Exception as exc:
                self._reply(502, {"error": str(exc)})
            return
        if self.path != "/generate":
            self._reply(404, {"error": "not_found"})
            return
        prompt = data.get("prompt", "")
        if not isinstance(prompt, str) or not prompt.strip():
            self._reply(400, {"error": "prompt ausente"})
            return
        if len(prompt) > MAX_PROMPT:
            self._reply(400, {"error": "prompt muito grande"})
            return
        global _last_request
        with _lock:
            now = time.monotonic()
            if now - _last_request < MIN_INTERVAL:
                self._reply(429, {"error": "aguarde antes de enviar outro pedido"})
                return
            _last_request = now
        try:
            project_text = ""
            if data.get("project_id"):
                project_text = drive_context.get_project(str(data["project_id"])).get("text", "")
            full_prompt = drive_context.context_prompt(prompt.strip(), project_text, str(data.get("draft_context", "")))
            text = run_hermes(full_prompt)
            self._reply(200, {"text": text, "model": MODEL, "context_sources": drive_context.load_context().get("source_count", 0)})
        except subprocess.TimeoutExpired:
            self._reply(504, {"error": "o Codex demorou mais que o limite configurado"})
        except Exception as exc:
            self._reply(502, {"error": str(exc)})

    def do_PUT(self):
        if not self._authorized():
            self._reply(401, {"error": "unauthorized"})
            return
        if not self.path.startswith("/projects/"):
            self._reply(404, {"error": "not_found"})
            return
        try:
            data = self._read_json()
            project_id = unquote(self.path.split("/", 2)[2])
            result = drive_context.update_project(project_id, str(data.get("name", "Projeto sem título"))[:180], str(data.get("text", "")))
            self._reply(200, result)
        except Exception as exc:
            self._reply(502, {"error": str(exc)})

    def log_message(self, fmt, *args):
        print(fmt % args, flush=True)


if __name__ == "__main__":
    print(f"codex bridge listening on {HOST}:{PORT}", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
