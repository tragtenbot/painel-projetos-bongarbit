#!/usr/bin/env python3
"""Drive-backed context and project storage for the Codex bridge."""
from __future__ import annotations
import io, json, os, re, time
from pathlib import Path
from typing import Any

from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload

GOOGLE_SCRIPT_DIR = "/root/.hermes/skills/productivity/productivity-service-operations/scripts/google-workspace"
import sys
if GOOGLE_SCRIPT_DIR not in sys.path:
    sys.path.insert(0, GOOGLE_SCRIPT_DIR)
import google_api

REFERENCE_FOLDER_ID = os.getenv("CODEX_REFERENCE_FOLDER_ID", "1OS4zRBdG2nG7R8Ax-Qt2mIlnp23acK47")
PROJECT_FOLDER_NAME = os.getenv("CODEX_PROJECT_FOLDER_NAME", "Projetos criados pelo Painel Bongarbit")
CACHE_PATH = Path(os.getenv("CODEX_CONTEXT_CACHE", "/root/.hermes/codex-bridge-context.json"))
MAX_SOURCE_CHARS = 28000
MAX_CONTEXT_CHARS = 52000

EXCLUDE_RE = re.compile(r"(dados pessoais|rg novo|copia_cpf|cartao_cnpj|cnpj\.pdf|cpf|notas fiscais|alterac.?o.*batebit|ata_eleicao|confirmacao de inscricao|estatuto|contrato social|ccmei)", re.I)
PRIORITY_RE = re.compile(r"(edital|regulamento|faq|formulario|lei|decreto|resolu|sumula|in_min|manual|projeto|ficha|contexto|possibilidades|briefing|bongarbit|engome|agbau|botoes|xamba|sankofa|rumos|funcultura|metodologia|portfolio|curriculo)", re.I)
TEXT_MIMES = {"text/plain", "text/markdown", "text/csv", "application/rtf"}
GOOGLE_DOC = "application/vnd.google-apps.document"
FOLDER = "application/vnd.google-apps.folder"


def drive_service():
    return build("drive", "v3", credentials=google_api.get_credentials())


def docs_service():
    return build("docs", "v1", credentials=google_api.get_credentials())


def all_files(service, parent_id: str) -> list[dict[str, Any]]:
    output = []
    stack = [parent_id]
    while stack:
        parent = stack.pop()
        token = None
        while True:
            result = service.files().list(
                q=f"'{parent}' in parents and trashed=false",
                fields="nextPageToken,files(id,name,mimeType,modifiedTime,size,webViewLink,parents)",
                pageSize=1000,
                pageToken=token,
            ).execute()
            for item in result.get("files", []):
                output.append(item)
                if item["mimeType"] == FOLDER:
                    stack.append(item["id"])
            token = result.get("nextPageToken")
            if not token:
                break
    return output


def download_bytes(service, file_id: str, mime: str) -> bytes:
    if mime == GOOGLE_DOC:
        return service.files().export(fileId=file_id, mimeType="text/plain").execute()
    request = service.files().get_media(fileId=file_id)
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return buf.getvalue()


def decode_file(item: dict[str, Any], raw: bytes) -> str:
    mime, name = item.get("mimeType", ""), item.get("name", "")
    if mime in TEXT_MIMES or name.lower().endswith((".txt", ".md", ".csv", ".rtf")):
        return raw.decode("utf-8", errors="replace")
    if mime == "application/pdf" or name.lower().endswith(".pdf"):
        try:
            from pypdf import PdfReader
            return "\n".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(raw)).pages)
        except Exception:
            return ""
    if mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document" or name.lower().endswith(".docx"):
        try:
            from docx import Document
            return "\n".join(p.text for p in Document(io.BytesIO(raw)).paragraphs)
        except Exception:
            return ""
    return ""


def should_include(item: dict[str, Any]) -> bool:
    name = item.get("name", "")
    if item.get("mimeType") == FOLDER or EXCLUDE_RE.search(name):
        return False
    return bool(PRIORITY_RE.search(name) or item.get("mimeType") in TEXT_MIMES or item.get("mimeType") == GOOGLE_DOC)


def sync_context() -> dict[str, Any]:
    service = drive_service()
    files = all_files(service, REFERENCE_FOLDER_ID)
    sources, skipped = [], 0
    for item in files:
        if not should_include(item):
            skipped += 1
            continue
        try:
            text = decode_file(item, download_bytes(service, item["id"], item["mimeType"]))
        except Exception as exc:
            text = f"[Não foi possível extrair este arquivo: {exc}]"
        text = text.strip()
        if not text:
            skipped += 1
            continue
        sources.append({
            "id": item["id"], "name": item["name"], "mimeType": item["mimeType"],
            "modifiedTime": item.get("modifiedTime"), "webViewLink": item.get("webViewLink"),
            "text": text[:MAX_SOURCE_CHARS],
        })
    sources.sort(key=lambda x: (0 if PRIORITY_RE.search(x["name"]) else 1, x["name"].lower()))
    payload = {"reference_folder_id": REFERENCE_FOLDER_ID, "source_count": len(sources), "skipped": skipped, "sources": sources}
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return payload


def load_context(force=False) -> dict[str, Any]:
    stale = not CACHE_PATH.exists() or (time.time() - CACHE_PATH.stat().st_mtime > 6 * 3600)
    if force or stale:
        try:
            return sync_context()
        except Exception:
            if CACHE_PATH.exists():
                return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
            raise
    try:
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return sync_context()


def context_prompt(user_prompt: str, project_text: str = "", draft_text: str = "") -> str:
    data = load_context()
    parts = [
        "Você é o redator estratégico de propostas culturais do Bongarbit.",
        "Use prioritariamente o edital, regulamento, FAQ, formulário e critérios de avaliação presentes no contexto.",
        "Depois use os projetos anteriores e referências para adaptar linguagem, escopo e soluções.",
        "Maximize aderência aos critérios do edital sem inventar fatos, números, parcerias, resultados ou requisitos.",
        "Quando houver conflito, o edital vigente prevalece sobre projetos antigos e referências.",
        "Responda em português brasileiro. Seja claro, específico, verificável e compatível com o campo solicitado.",
        "Se faltar informação, marque [CONFIRMAR] em vez de preencher por suposição.",
        "\nPEDIDO ATUAL:\n" + user_prompt,
    ]
    cumulative = draft_text or project_text
    if cumulative:
        parts.append("\n\nCONTEXTO CUMULATIVO DO SITE — preservar e considerar todos os textos anteriores e suas alterações:\n" + cumulative[:60000])
    chars = sum(len(p) for p in parts)
    for source in data.get("sources", []):
        block = f"\n\n--- FONTE: {source['name']} ---\n{source['text']}"
        if chars + len(block) > MAX_CONTEXT_CHARS:
            break
        parts.append(block)
        chars += len(block)
    return "".join(parts)


def ensure_project_folder() -> dict[str, Any]:
    service = drive_service()
    q = f"'{REFERENCE_FOLDER_ID}' in parents and name='{PROJECT_FOLDER_NAME}' and mimeType='{FOLDER}' and trashed=false"
    found = service.files().list(q=q, fields="files(id,name,webViewLink,parents)", pageSize=10).execute().get("files", [])
    if found:
        return found[0]
    return service.files().create(body={"name": PROJECT_FOLDER_NAME, "mimeType": FOLDER, "parents": [REFERENCE_FOLDER_ID]}, fields="id,name,webViewLink,parents").execute()


def project_files() -> list[dict[str, Any]]:
    folder = ensure_project_folder()
    service = drive_service()
    result = service.files().list(
        q=f"'{folder['id']}' in parents and trashed=false and mimeType='{GOOGLE_DOC}'",
        orderBy="modifiedTime desc", fields="files(id,name,modifiedTime,webViewLink,parents)", pageSize=100,
    ).execute()
    return result.get("files", [])


def get_project(project_id: str) -> dict[str, Any]:
    doc = docs_service().documents().get(documentId=project_id).execute()
    text = []
    for content in doc.get("body", {}).get("content", []):
        for element in content.get("paragraph", {}).get("elements", []):
            text.append(element.get("textRun", {}).get("content", ""))
    meta = drive_service().files().get(fileId=project_id, fields="id,name,modifiedTime,webViewLink,parents").execute()
    meta["text"] = "".join(text)
    return meta


def create_project(name: str, text: str) -> dict[str, Any]:
    folder = ensure_project_folder()
    doc = docs_service().documents().create(body={"title": name}).execute()
    project_id = doc["documentId"]
    docs_service().documents().batchUpdate(documentId=project_id, body={"requests": [{"insertText": {"location": {"index": 1}, "text": text}}]}).execute()
    service = drive_service()
    service.files().update(fileId=project_id, addParents=folder["id"], fields="id,name,webViewLink,parents").execute()
    return get_project(project_id)


def update_project(project_id: str, name: str, text: str) -> dict[str, Any]:
    doc = docs_service().documents().get(documentId=project_id).execute()
    content = doc.get("body", {}).get("content", [])
    end_index = content[-1].get("endIndex", 2) if content else 2
    requests = []
    if end_index > 2:
        requests.append({"deleteContentRange": {"range": {"startIndex": 1, "endIndex": end_index - 1}}})
    requests.append({"insertText": {"location": {"index": 1}, "text": text}})
    docs_service().documents().batchUpdate(documentId=project_id, body={"requests": requests}).execute()
    drive_service().files().update(fileId=project_id, body={"name": name}, fields="id,name,modifiedTime,webViewLink,parents").execute()
    return get_project(project_id)
