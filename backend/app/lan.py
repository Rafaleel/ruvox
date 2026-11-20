"""Phone access over the local network (opt-in): host rules, pairing and the cookie.

Threat model (D15): the API can spend the owner's API key, so it must not answer to
web pages (DNS rebinding) or to strangers on the Wi-Fi. Only IP-literal hosts are
accepted, and a non-loopback client needs a cookie obtained with a 6-digit code shown
on the desktop. Anyone paired can use the API key; unpairing rotates the secret.
"""

import hashlib
import hmac
import ipaddress
import secrets
import socket
import time

COOKIE = "ruvox_device"
LOOPBACK_CLIENTS = {"127.0.0.1", "::1"}
MAX_FAILURES = 5
WINDOW_SECONDS = 60.0


def host_allowed(host_header: str, lan: bool) -> bool:
    """`localhost`, loopback IPs, and (LAN mode) private IPs. Never other domain names."""
    host = host_header.strip().lower()
    if host.startswith("["):  # [::1]:8000
        name = host[1:].split("]", 1)[0]
    elif host.count(":") == 1:
        name = host.split(":", 1)[0]
    else:
        name = host
    if name == "localhost":
        return True
    try:
        address = ipaddress.ip_address(name)
    except ValueError:
        return False
    return address.is_loopback or (lan and address.is_private)


def lan_ip() -> str | None:
    """The address a phone on the same network would use; no packet is sent."""
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("10.255.255.255", 1))
        address: str = probe.getsockname()[0]
    except OSError:
        return None
    finally:
        probe.close()
    return None if address.startswith("127.") else address


def new_secret() -> str:
    return secrets.token_hex(32)


def new_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


class PairingState:
    def __init__(self, secret: str) -> None:
        self.secret = secret
        self.code = new_code()
        self._failures: dict[str, list[float]] = {}

    def token(self) -> str:
        return hmac.new(
            bytes.fromhex(self.secret), b"ruvox-paired", hashlib.sha256
        ).hexdigest()

    def valid(self, cookie: str | None) -> bool:
        # compare_digest raises on non-ASCII str: compare bytes
        return bool(cookie) and hmac.compare_digest(
            (cookie or "").encode(), self.token().encode()
        )

    def rotate(self, secret: str) -> None:
        self.secret = secret
        self.code = new_code()

    def blocked(self, who: str, now: float | None = None) -> bool:
        now = time.monotonic() if now is None else now
        recent = [t for t in self._failures.get(who, []) if now - t < WINDOW_SECONDS]
        self._failures[who] = recent
        return len(recent) >= MAX_FAILURES

    def try_pair(self, who: str, code: str, now: float | None = None) -> bool:
        """True and a fresh code on success; failures are counted per client."""
        now = time.monotonic() if now is None else now
        if self.blocked(who, now):
            return False
        if hmac.compare_digest(code.strip().encode(), self.code.encode()):
            self._failures.pop(who, None)
            self.code = new_code()  # one code pairs one device
            return True
        self._failures.setdefault(who, []).append(now)
        return False
