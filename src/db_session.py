"""Short-lived sessions and one shared transaction for multi-step operations."""

from contextlib import contextmanager
from contextvars import ContextVar

import mysql.connector

from config import settings

_active = ContextVar("baxi_transaction", default=None)


def create_connection(schema):
    if schema not in {"baxi_users", "baxi_staff"}:
        raise ValueError("Unknown BAXI schema")
    cfg = settings()
    if not cfg.password:
        raise RuntimeError("Set BAXI_DB_PASSWORD in .env before using the database.")
    return mysql.connector.connect(
        host=cfg.host,
        port=cfg.port,
        user=cfg.user,
        password=cfg.password,
        database=schema,
        connection_timeout=5,
        charset="utf8mb4",
    )


@contextmanager
def session(schema="baxi_users", dictionary=False):
    shared = _active.get()
    if shared and shared[0] != schema:
        raise RuntimeError("Cannot change schema inside this transaction")
    connection = shared[1] if shared else create_connection(schema)
    cursor = None
    try:
        cursor = connection.cursor(dictionary=dictionary)
        yield connection, cursor
        if not shared:
            connection.commit()
    except Exception:
        if not shared:
            connection.rollback()
        raise
    finally:
        if cursor is not None:
            cursor.close()
        if not shared:
            connection.close()


@contextmanager
def transaction(schema="baxi_users"):
    shared = _active.get()
    if shared:
        if shared[0] != schema:
            raise RuntimeError("Cannot change schema inside this transaction")
        yield shared[1]
        return
    connection = create_connection(schema)
    token = _active.set((schema, connection))
    try:
        connection.start_transaction()
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        _active.reset(token)
        connection.close()
