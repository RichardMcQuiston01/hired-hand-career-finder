#!/usr/bin/env python3
"""Interactive helper: mints a Chrome Web Store API refresh token via the
OAuth 2.0 loopback flow, and stores it alongside the other deploy secrets
in apps/extension/.env.

Requires a Google Cloud OAuth client of type "Desktop app" (see
docs/CHROME_WEB_STORE_DEPLOY.md for the one-time setup). Uses only the
Python standard library -- no pip install needed.

Usage:
    cd apps/extension
    python3 scripts/get-refresh-token.py
"""

import http.server
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
SCOPE = "https://www.googleapis.com/auth/chromewebstore"
AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
REQUIRED_KEYS = ["CHROME_EXTENSION_ID", "CHROME_CLIENT_ID", "CHROME_CLIENT_SECRET"]
WAIT_TIMEOUT_SECONDS = 180


def read_env(path):
    values = {}
    order = []
    if path.exists():
        for line in path.read_text().splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, _, value = stripped.partition("=")
            key = key.strip()
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
                value = value[1:-1]
            values[key] = value
            order.append(key)
    return values, order


def write_env(path, values, order):
    lines = []
    seen = set()
    for key in order:
        if key in values:
            lines.append(f"{key}={values[key]}")
            seen.add(key)
    for key, value in values.items():
        if key not in seen:
            lines.append(f"{key}={value}")
    path.write_text("\n".join(lines) + "\n")


def prompt_for(key, current, secret=False):
    label = key.replace("_", " ").title()
    if current:
        shown = ("*" * 6 + current[-4:]) if secret and len(current) > 4 else current
        answer = input(f"{label} [{shown}] (Enter to keep, or type a new value): ").strip()
        return answer or current
    while True:
        answer = input(f"{label}: ").strip()
        if answer:
            return answer
        print("  This value is required.")


def main():
    values, order = read_env(ENV_PATH)
    print(f"Reading/writing secrets in {ENV_PATH}\n")
    for key in REQUIRED_KEYS:
        secret = "SECRET" in key
        values[key] = prompt_for(key, values.get(key, ""), secret=secret)
        if key not in order:
            order.append(key)
    write_env(ENV_PATH, values, order)

    client_id = values["CHROME_CLIENT_ID"]
    client_secret = values["CHROME_CLIENT_SECRET"]

    result = {}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            parsed = urllib.parse.urlparse(self.path)
            qs = urllib.parse.parse_qs(parsed.query)
            if "code" in qs:
                result["code"] = qs["code"][0]
                body = b"<html><body>Authorized \xe2\x80\x94 you can close this tab.</body></html>"
                self.send_response(200)
                self.send_header("Content-Type", "text/html")
                self.end_headers()
                self.wfile.write(body)
            elif "error" in qs:
                result["error"] = qs["error"][0]
                body = f"<html><body>Authorization failed: {qs['error'][0]}</body></html>".encode()
                self.send_response(200)
                self.send_header("Content-Type", "text/html")
                self.end_headers()
                self.wfile.write(body)
            else:
                self.send_response(404)
                self.end_headers()

        def log_message(self, format, *args):  # noqa: A002 - silence default access log
            pass

    server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
    port = server.server_address[1]
    redirect_uri = f"http://127.0.0.1:{port}"
    server.timeout = 5

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",
        "prompt": "consent",
    }
    auth_url = f"{AUTH_ENDPOINT}?{urllib.parse.urlencode(params)}"
    print(f"\nOpening your browser to authorize:\n{auth_url}\n")
    print("If it does not open automatically, copy/paste that URL into a browser.")
    webbrowser.open(auth_url)

    print("Waiting for authorization...")
    deadline = time.time() + WAIT_TIMEOUT_SECONDS
    while "code" not in result and "error" not in result and time.time() < deadline:
        server.handle_request()
    server.server_close()

    if "error" in result:
        sys.exit(f"Google returned an error: {result['error']}")
    if "code" not in result:
        sys.exit(f"Timed out waiting for authorization ({WAIT_TIMEOUT_SECONDS}s). Run the script again.")

    data = urllib.parse.urlencode(
        {
            "client_id": client_id,
            "client_secret": client_secret,
            "code": result["code"],
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
        }
    ).encode()

    req = urllib.request.Request(TOKEN_ENDPOINT, data=data, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            token_response = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"Token exchange failed ({e.code}): {e.read().decode()}")

    refresh_token = token_response.get("refresh_token")
    if not refresh_token:
        sys.exit(
            "No refresh_token in the response. This usually means you already "
            "authorized this app before -- go to https://myaccount.google.com/permissions, "
            "remove access for this app, and run the script again."
        )

    values["CHROME_REFRESH_TOKEN"] = refresh_token
    if "CHROME_REFRESH_TOKEN" not in order:
        order.append("CHROME_REFRESH_TOKEN")
    write_env(ENV_PATH, values, order)

    print(f"\nSuccess! CHROME_REFRESH_TOKEN written to {ENV_PATH}")
    print("Now copy all four values from .env into your repo's GitHub Actions secrets")
    print("(Settings -> Secrets and variables -> Actions):")
    for key in REQUIRED_KEYS + ["CHROME_REFRESH_TOKEN"]:
        print(f"  - {key}")


if __name__ == "__main__":
    main()
