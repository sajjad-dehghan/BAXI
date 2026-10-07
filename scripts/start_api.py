"""Single-process local demo; seeding is an explicit container setting."""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
if os.getenv("BAXI_SEED_DEMO", "false").lower() == "true":
    from seed_demo import seed

    seed()

import uvicorn

uvicorn.run("api:app", host="0.0.0.0", port=8000, workers=1, proxy_headers=False)
