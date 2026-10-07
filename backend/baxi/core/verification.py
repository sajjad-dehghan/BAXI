"""Demo OTPs: two minute expiry, single use, five attempts, resend cooldown."""

import hmac
import secrets
import time

from baxi.core.config import settings
from baxi.core.security import normalize_phone


class VerificationCodes:
    def __init__(self, clock=time.monotonic):
        self.clock = clock
        self._codes = {}
        self._last_sent = {}

    def issue(self, phone):
        if not settings().demo:
            raise ValueError(
                "SMS delivery is not implemented. Use the local demo mode."
            )
        phone = normalize_phone(phone)
        now = self.clock()
        self._codes = {
            key: value
            for key, value in self._codes.items()
            if value[1] > now and value[2] > 0
        }
        self._last_sent = {
            key: value for key, value in self._last_sent.items() if now - value < 120
        }
        if len(self._codes) >= 10000:
            raise ValueError("Too many active verification codes. Try again later.")
        if phone in self._last_sent and self.clock() - self._last_sent[phone] < 30:
            raise ValueError("Wait 30 seconds before requesting another code.")
        code = f"{secrets.randbelow(1000000):06d}"
        self._codes[phone] = [code, self.clock() + 120, 5]
        self._last_sent[phone] = self.clock()
        print(f"[LOCAL DEMO ONLY] OTP for 0{phone}: {code}")
        return code

    def verify(self, phone, code):
        phone = normalize_phone(phone)
        record = self._codes.get(phone)
        if not record or self.clock() >= record[1] or record[2] <= 0:
            self._codes.pop(phone, None)
            return False
        record[2] -= 1
        if hmac.compare_digest(str(code), record[0]):
            del self._codes[phone]
            return True
        return False
