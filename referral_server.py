"""Dependency-free PillowFlow referral API and static file server."""

from __future__ import annotations

import json
import os
import sqlite3
import uuid
import csv
import io
import smtplib
import ssl
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from email.message import EmailMessage
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("PILLOWFLOW_REFERRALS_DB", ROOT / "referrals.db"))
ADMIN_TOKEN = os.environ.get("PILLOWFLOW_ADMIN_TOKEN", "")
SMTP_HOST = os.environ.get("PILLOWFLOW_SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("PILLOWFLOW_SMTP_PORT", "587"))
SMTP_USER = os.environ.get("PILLOWFLOW_SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("PILLOWFLOW_SMTP_PASSWORD", "")
SMTP_SECURITY = os.environ.get("PILLOWFLOW_SMTP_SECURITY", "starttls").lower()
SMTP_FROM = os.environ.get("PILLOWFLOW_SMTP_FROM", SMTP_USER or "connect@pillowflow.com")
NOTIFY_TO = os.environ.get("PILLOWFLOW_NOTIFY_TO", "connect@pillowflow.com")
ALLOWED_ORIGINS = {
    value.strip()
    for value in os.environ.get(
        "PILLOWFLOW_ALLOWED_ORIGINS",
        "https://pillowflow.com,https://www.pillowflow.com,https://pillowflow.us,https://www.pillowflow.us,https://refer.pillowflow.us,http://localhost:8000,http://127.0.0.1:8000",
    ).split(",")
    if value.strip()
}

REFERRAL_TYPES = {"driver_referral", "fleet_referral", "creator_referral"}
STATUSES = {"submitted", "reviewing", "approved", "code_created", "converted", "reward_pending", "paid", "rejected"}
PAYOUT_STATUSES = {"not_ready", "pending", "paid", "cancelled"}
RATE_LIMIT_MAX = max(1, int(os.environ.get("PILLOWFLOW_RATE_LIMIT_MAX", "5")))
RATE_LIMIT_WINDOW = max(1, int(os.environ.get("PILLOWFLOW_RATE_LIMIT_WINDOW", "600")))
TRUST_PROXY = os.environ.get("PILLOWFLOW_TRUST_PROXY", "0") == "1"
RATE_LIMITS: dict[str, deque[float]] = defaultdict(deque)
RATE_LIMIT_LOCK = threading.Lock()
PUBLIC_COLUMNS = (
    "referral_type", "referrer_name", "referrer_email", "referrer_phone",
    "referred_name", "referred_email", "referred_phone", "company_name",
    "company_website", "fleet_size", "decision_maker_name",
    "decision_maker_contact", "creator_social_link", "creator_audience_type",
    "creator_audience_size", "reason", "source_site",
)
ADMIN_COLUMNS = {"status", "reward_amount", "payout_status", "admin_notes"}


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def clean(value: object, limit: int = 1000) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text[:limit] or None


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as connection:
        connection.executescript((ROOT / "schema.sql").read_text(encoding="utf-8"))


def validate_submission(data: dict) -> list[str]:
    referral_type = data.get("referral_type")
    required = ["referrer_name", "referrer_email", "referrer_phone", "source_site"]
    if data.get("source_site") not in {"pillowflow.com", "pillowflow.us"}:
        return ["Invalid source site."]
    if referral_type == "driver_referral":
        required += ["referred_name"]
        if not (clean(data.get("referred_email")) or clean(data.get("referred_phone"))):
            return ["Referred driver email or phone is required."]
    elif referral_type == "fleet_referral":
        required += ["company_name", "company_website", "fleet_size", "decision_maker_name", "decision_maker_contact", "reason"]
    elif referral_type == "creator_referral":
        required += ["creator_social_link", "creator_audience_type", "creator_audience_size", "reason"]
    else:
        return ["Invalid referral type."]
    return [f"{field.replace('_', ' ').title()} is required." for field in required if not clean(data.get(field))]


def send_referral_notification(record: dict) -> bool:
    """Send a best-effort notification after the database transaction succeeds."""
    if not SMTP_HOST:
        return False
    message = EmailMessage()
    message["Subject"] = "REFERRAL"
    message["From"] = SMTP_FROM
    message["To"] = NOTIFY_TO
    lines = ["PillowFlow Founding Drivers", ""]
    for key, value in record.items():
        if value is not None:
            lines.append(f"{key.replace('_', ' ').title()}: {value}")
    message.set_content("\n".join(lines))
    context = ssl.create_default_context()
    if SMTP_SECURITY == "ssl":
        client = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=10, context=context)
    else:
        client = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10)
    try:
        if SMTP_SECURITY == "starttls":
            client.starttls(context=context)
        if SMTP_USER:
            client.login(SMTP_USER, SMTP_PASSWORD)
        client.send_message(message)
        return True
    finally:
        client.quit()


class ReferralHandler(SimpleHTTPRequestHandler):
    server_version = "PillowFlowReferrals/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/":
            self.send_response(HTTPStatus.FOUND)
            self.send_header("Location", os.environ.get("PILLOWFLOW_LANDING_PAGE", "/referral.html"))
            self.end_headers()
            return
        if parsed.path == "/healthz":
            try:
                with connect() as connection:
                    connection.execute("SELECT 1").fetchone()
                return self.send_json(HTTPStatus.OK, {"status": "ok", "database": "ready", "email": "configured" if SMTP_HOST else "not_configured"})
            except sqlite3.Error:
                return self.send_json(HTTPStatus.SERVICE_UNAVAILABLE, {"status": "error", "database": "unavailable"})
        if parsed.path == "/api/referrals.csv":
            return self.export_referrals(parse_qs(parsed.query))
        if parsed.path == "/api/referrals":
            return self.list_referrals(parse_qs(parsed.query))
        if parsed.path.startswith("/api/referrals/"):
            return self.get_referral(parsed.path.rsplit("/", 1)[-1])
        super().do_GET()

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/api/referrals":
            return self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found."})
        retry_after = self.rate_limit_retry_after()
        if retry_after:
            return self.send_json(
                HTTPStatus.TOO_MANY_REQUESTS,
                {"error": "Too many submissions. Please try again later."},
                {"Retry-After": str(retry_after)},
            )
        data = self.read_json()
        if data is None:
            return
        if clean(data.get("website")):
            return self.send_json(
                HTTPStatus.CREATED,
                {"id": str(uuid.uuid4()), "status": "submitted", "payout_status": "not_ready"},
            )
        errors = validate_submission(data)
        if errors:
            return self.send_json(HTTPStatus.BAD_REQUEST, {"error": " ".join(errors)})
        record = {column: clean(data.get(column)) for column in PUBLIC_COLUMNS}
        record["id"] = str(uuid.uuid4())
        record["created_at"] = record["updated_at"] = now()
        columns = ["id", "created_at", "updated_at", *PUBLIC_COLUMNS]
        placeholders = ", ".join("?" for _ in columns)
        with connect() as connection:
            connection.execute(
                f"INSERT INTO referrals ({', '.join(columns)}) VALUES ({placeholders})",
                [record[column] for column in columns],
            )
        notification_sent = False
        try:
            notification_sent = send_referral_notification(record)
        except (OSError, smtplib.SMTPException) as error:
            print(f"Referral {record['id']} saved; email notification failed: {type(error).__name__}")
        self.send_json(HTTPStatus.CREATED, {"id": record["id"], "status": "submitted", "payout_status": "not_ready", "notification_sent": notification_sent})

    def do_PATCH(self) -> None:
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/referrals/"):
            return self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found."})
        if not self.authorized():
            return
        referral_id = parsed.path.rsplit("/", 1)[-1]
        data = self.read_json()
        if data is None:
            return
        updates = {key: data[key] for key in ADMIN_COLUMNS if key in data}
        if not updates:
            return self.send_json(HTTPStatus.BAD_REQUEST, {"error": "No editable fields supplied."})
        if "status" in updates and updates["status"] not in STATUSES:
            return self.send_json(HTTPStatus.BAD_REQUEST, {"error": "Invalid status."})
        if "payout_status" in updates and updates["payout_status"] not in PAYOUT_STATUSES:
            return self.send_json(HTTPStatus.BAD_REQUEST, {"error": "Invalid payout status."})
        if "reward_amount" in updates:
            try:
                updates["reward_amount"] = round(float(updates["reward_amount"]), 2)
                if updates["reward_amount"] < 0:
                    raise ValueError
            except (TypeError, ValueError):
                return self.send_json(HTTPStatus.BAD_REQUEST, {"error": "Reward amount must be zero or greater."})
        if "admin_notes" in updates:
            updates["admin_notes"] = clean(updates["admin_notes"], 5000)
        updates["updated_at"] = now()
        assignments = ", ".join(f"{column} = ?" for column in updates)
        with connect() as connection:
            cursor = connection.execute(
                f"UPDATE referrals SET {assignments} WHERE id = ?",
                [*updates.values(), referral_id],
            )
        if cursor.rowcount == 0:
            return self.send_json(HTTPStatus.NOT_FOUND, {"error": "Referral not found."})
        self.send_json(HTTPStatus.OK, {"id": referral_id, **updates})

    def list_referrals(self, query: dict[str, list[str]]) -> None:
        if not self.authorized():
            return
        result = self.filtered_referrals(query)
        if isinstance(result, tuple):
            return self.send_json(HTTPStatus.BAD_REQUEST, {"error": result[0]})
        self.send_json(HTTPStatus.OK, {"referrals": result})

    def filtered_referrals(self, query: dict[str, list[str]]) -> list[dict] | tuple[str]:
        clauses, values = [], []
        referral_type = query.get("referral_type", [""])[0]
        status = query.get("status", [""])[0]
        if referral_type:
            if referral_type not in REFERRAL_TYPES:
                return ("Invalid referral type.",)
            clauses.append("referral_type = ?")
            values.append(referral_type)
        if status:
            if status not in STATUSES:
                return ("Invalid status.",)
            clauses.append("status = ?")
            values.append(status)
        where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
        with connect() as connection:
            rows = connection.execute(
                f"SELECT * FROM referrals{where} ORDER BY created_at DESC LIMIT 500", values
            ).fetchall()
        return [dict(row) for row in rows]

    def export_referrals(self, query: dict[str, list[str]]) -> None:
        if not self.authorized():
            return
        result = self.filtered_referrals(query)
        if isinstance(result, tuple):
            return self.send_json(HTTPStatus.BAD_REQUEST, {"error": result[0]})
        output = io.StringIO(newline="")
        with connect() as connection:
            columns = [row[1] for row in connection.execute("PRAGMA table_info(referrals)").fetchall()]
        writer = csv.DictWriter(output, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(result)
        body = output.getvalue().encode("utf-8-sig")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Disposition", 'attachment; filename="pillowflow-referrals.csv"')
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def get_referral(self, referral_id: str) -> None:
        if not self.authorized():
            return
        with connect() as connection:
            row = connection.execute("SELECT * FROM referrals WHERE id = ?", (referral_id,)).fetchone()
        if row is None:
            return self.send_json(HTTPStatus.NOT_FOUND, {"error": "Referral not found."})
        self.send_json(HTTPStatus.OK, dict(row))

    def authorized(self) -> bool:
        if not ADMIN_TOKEN:
            self.send_json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "Admin access is not configured."})
            return False
        if self.headers.get("Authorization") != f"Bearer {ADMIN_TOKEN}":
            self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Valid admin token required."})
            return False
        return True

    def client_ip(self) -> str:
        if TRUST_PROXY:
            forwarded = self.headers.get("X-Forwarded-For", "").split(",", 1)[0].strip()
            if forwarded:
                return forwarded
        return self.client_address[0]

    def rate_limit_retry_after(self) -> int:
        current = time.monotonic()
        ip = self.client_ip()
        with RATE_LIMIT_LOCK:
            attempts = RATE_LIMITS[ip]
            while attempts and current - attempts[0] >= RATE_LIMIT_WINDOW:
                attempts.popleft()
            if len(attempts) >= RATE_LIMIT_MAX:
                return max(1, int(RATE_LIMIT_WINDOW - (current - attempts[0])))
            attempts.append(current)
        return 0

    def read_json(self) -> dict | None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 50_000:
                raise ValueError
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError
            return data
        except (ValueError, json.JSONDecodeError):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "Invalid request body."})
            return None

    def send_json(self, status: HTTPStatus, payload: dict, headers: dict[str, str] | None = None) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    initialize_database()
    host = os.environ.get("PILLOWFLOW_HOST", "127.0.0.1")
    port = int(os.environ.get("PILLOWFLOW_PORT", os.environ.get("PORT", "8000")))
    print(f"PillowFlow referrals running at http://{host}:{port}")
    ThreadingHTTPServer((host, port), ReferralHandler).serve_forever()
