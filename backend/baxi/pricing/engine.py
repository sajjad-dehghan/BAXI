"""Versioned educational tariffs. All amounts, including line items, are integer IRR."""

import hashlib
import json
from decimal import ROUND_HALF_UP, Decimal
from functools import lru_cache
from pathlib import Path


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def validate_policy(policy):
    if (
        not isinstance(policy.get("version"), str)
        or not 1 <= len(policy["version"]) <= 64
        or policy.get("currency") != "IRR"
        or policy.get("basis") != "geodesic"
        or policy.get("quote_seconds") != 300
        or policy.get("rounding_irr") != 10000
        or set(policy.get("services", {})) != {"baxi", "women", "box", "baar"}
    ):
        raise ValueError("Invalid pricing policy")
    for name, rate in policy["services"].items():
        for key in ("base_irr", "per_km_irr", "minimum_irr", "commission_bps"):
            if type(rate.get(key)) is not int or not 0 <= rate[key] <= 10**9:
                raise ValueError("Invalid tariff amount")
        if (
            not rate["minimum_irr"]
            or not rate["per_km_irr"]
            or rate["commission_bps"] > 10000
        ):
            raise ValueError("Invalid minimum, distance rate or commission")
        bands = rate.get("weight_bands")
        if not isinstance(bands, list) or bool(bands) != (name in {"box", "baar"}):
            raise ValueError("Invalid weight bands")
        previous_limit, previous_factor = 0, 10000
        for limit, factor in bands:
            if (
                type(limit) is not int
                or type(factor) is not int
                or not previous_limit < limit <= 100000
                or not previous_factor <= factor <= 100000
            ):
                raise ValueError("Invalid weight bands")
            previous_limit, previous_factor = limit, factor
    if policy["services"]["baxi"] != policy["services"]["women"]:
        raise ValueError("Passenger and women tariffs must match")
    return policy


@lru_cache(maxsize=1)
def _policy_text():
    policy = validate_policy(
        json.loads(Path(__file__).with_name("policy.json").read_text(encoding="utf-8"))
    )
    return canonical(policy)


def load_policy():
    # Callers cannot mutate the cached policy shared by other requests.
    return json.loads(_policy_text())


def policy_hash(policy):
    return hashlib.sha256(canonical(policy).encode("utf-8")).hexdigest()


def calculate(service, distance_km, round_trip=False, cargo_weight=1, policy=None):
    policy = validate_policy(policy) if policy is not None else load_policy()
    if service not in policy["services"]:
        raise ValueError("Unknown service")
    distance = Decimal(str(distance_km))
    if not distance.is_finite() or distance <= 0:
        raise ValueError("Distance must be positive and finite")
    rate = policy["services"][service]
    if service in {"box", "baar"} and round_trip:
        raise ValueError("Round trips are available for passenger services only.")
    factor = 10000
    if rate["weight_bands"]:
        if type(cargo_weight) is not int or cargo_weight < 1:
            raise ValueError("Cargo weight must be a positive whole number")
        factor = next(
            (factor for limit, factor in rate["weight_bands"] if cargo_weight <= limit),
            None,
        )
        if factor is None:
            raise ValueError(
                f"Cargo weight exceeds service maximum: {rate['weight_bands'][-1][0]} kg"
            )
    base = rate["base_irr"]
    km_cost = int(
        (distance * rate["per_km_irr"]).quantize(Decimal(1), rounding=ROUND_HALF_UP)
    )
    minimum_topup = max(0, rate["minimum_irr"] - base - km_cost)
    subtotal = base + km_cost + minimum_topup
    weighted = int(
        (Decimal(subtotal) * factor / 10000).quantize(
            Decimal(1), rounding=ROUND_HALF_UP
        )
    )
    rounded = (
        int(
            (Decimal(weighted) / policy["rounding_irr"]).quantize(
                Decimal(1), rounding=ROUND_HALF_UP
            )
        )
        * policy["rounding_irr"]
    )
    cost = rounded * (2 if round_trip else 1)
    amounts = {
        "base": base,
        "distance": km_cost,
        "minimum_topup": minimum_topup,
        "weight": weighted - subtotal,
        "rounding": rounded - weighted,
        "return": rounded if round_trip else 0,
    }
    net = cost * (10000 - rate["commission_bps"]) // 10000
    return {
        "cost": cost,
        "insurance": 0,
        "km": float(distance),
        "policy_version": policy["version"],
        "basis": policy["basis"],
        "currency": "IRR",
        "breakdown": [
            {"code": code, "amount_irr": amount} for code, amount in amounts.items()
        ],
        "commission_bps": rate["commission_bps"],
        "commission_irr": cost - net,
        "driver_net_irr": net,
    }
