#!/usr/bin/env python3
"""Small authenticated HTTP bridge: browser -> Hermes -> OpenAI Codex OAuth."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json, os, subprocess, threading, time

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
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def _reply(self, status, payload):
        body = json_bytes(payload)
        self._headers(status)
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._headers(204)

    def do_GET(self):
        if self.path == "/health":
            self._reply(200, {"ok": True, "service": "codex-bridge", "model": MODEL})
        else:
            self._reply(404, {"error": "not_found"})

    def do_POST(self):
        if self.path != "/generate":
            self._reply(404, {"error": "not_found"})
            return
        expected = "Bearer " + TOKEN
        if self.headers.get("Authorization") != expected:
            self._reply(401, {"error": "unauthorized"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > MAX_PROMPT * 2:
                raise ValueError("prompt muito grande")
            data = json.loads(self.rfile.read(length))
            prompt = data.get("prompt", "")
            if not isinstance(prompt, str) or not prompt.strip():
                raise ValueError("prompt ausente")
            if len(prompt) > MAX_PROMPT:
                raise ValueError("prompt muito grande")
        except (ValueError, json.JSONDecodeError) as exc:
            self._reply(400, {"error": str(exc)})
            return
        global _last_request
        with _lock:
            now = time.monotonic()
            if now - _last_request < MIN_INTERVAL:
                self._reply(429, {"error": "aguarde antes de enviar outro pedido"})
                return
            _last_request = now
        try:
            text = run_hermes(prompt.strip())
            self._reply(200, {"text": text, "model": MODEL})
        except subprocess.TimeoutExpired:
            self._reply(504, {"error": "o Codex demorou mais que o limite configurado"})
        except Exception as exc:
            self._reply(502, {"error": str(exc)})

    def log_message(self, fmt, *args):
        print(fmt % args, flush=True)


if __name__ == "__main__":
    print(f"codex bridge listening on {HOST}:{PORT}", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
