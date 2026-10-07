"""Local configuration. Importing this module never opens a connection."""

import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def load_env(path=ROOT / ".env"):
    if path.exists():
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


load_env()


@dataclass(frozen=True)
class Settings:
    host: str
    port: int
    user: str
    password: str
    demo: bool
    neshan_key: str


def settings():
    return Settings(
        os.getenv("BAXI_DB_HOST", "127.0.0.1"),
        int(os.getenv("BAXI_DB_PORT", "3307")),
        os.getenv("BAXI_DB_USER", "baxi"),
        os.getenv("BAXI_DB_PASSWORD", ""),
        os.getenv("BAXI_DEMO_MODE", "true").lower() == "true",
        os.getenv("NESHAN_API_KEY", ""),
    )
