"""Parameterized repository API; business transactions live in services.py."""

from baxi.db.session import session
from baxi.db.session import transaction as transaction


def rows(sql, params=(), schema="baxi_users"):
    with session(schema, dictionary=True) as (_, cursor):
        cursor.execute(sql, params)
        return cursor.fetchall()


def one(sql, params=(), schema="baxi_users"):
    result = rows(sql, params, schema)
    return result[0] if result else None


def execute(sql, params=(), schema="baxi_users"):
    with session(schema) as (_, cursor):
        cursor.execute(sql, params)
        return cursor.lastrowid, cursor.rowcount
