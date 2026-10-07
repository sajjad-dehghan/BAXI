# BAXI backend

The `baxi` Python package separates HTTP endpoints, application use cases, security/configuration, database access, geographic rules and pricing. Tests live beside the backend, split into `unit` and `integration`.

Run from the **repository root**, with the Python environment activated and local MySQL initialized:

```sh
python backend/scripts/seed_demo.py
python -m uvicorn baxi.api:app --app-dir backend --host 127.0.0.1 --port 8000
```

Root `pyproject.toml` supplies pytest's package search path. The API resolves the root `.env`, shared boundary and document directories from its source location, not the shell's working directory. Scripts bootstrap the backend package path explicitly. Keep one API worker for the current process-local sessions and rate limits.

[Full setup](../README.md#develop-locally) · [Structure and placement rules](../docs/repository-structure.md) · [Database](../docs/database.md)
