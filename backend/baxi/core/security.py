"""Password hashing and explicit Iranian mobile-number normalization."""

import hashlib
import hmac
import secrets


def normalize_phone(value):
    digits = (
        str(value)
        .strip()
        .translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789"))
    )
    digits = digits.replace(" ", "").replace("-", "")
    if digits.startswith("+98"):
        digits = digits[3:]
    elif digits.startswith("0098"):
        digits = digits[4:]
    elif digits.startswith("0"):
        digits = digits[1:]
    if (
        len(digits) != 10
        or not digits.isascii()
        or not digits.isdigit()
        or not digits.startswith("9")
    ):
        raise ValueError("Enter a valid Iranian mobile number, e.g. 09120000010.")
    return digits


def hash_password(password):
    if not isinstance(password, str) or len(password) < 8:
        raise ValueError("Staff passwords must contain at least 8 characters.")
    salt = secrets.token_hex(16)
    digest = hashlib.scrypt(
        password.encode(), salt=salt.encode(), n=16384, r=8, p=1
    ).hex()
    return f"scrypt${salt}${digest}"


def verify_password(password, encoded):
    try:
        algorithm, salt, digest = encoded.split("$")
        if algorithm != "scrypt":
            return False
        actual = hashlib.scrypt(
            password.encode(), salt=salt.encode(), n=16384, r=8, p=1
        ).hex()
        return hmac.compare_digest(actual, digest)
    except (AttributeError, TypeError, ValueError):
        return False
