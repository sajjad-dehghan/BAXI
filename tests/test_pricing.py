from decimal import Decimal

import pytest

from pricing import calculate, load_policy, validate_policy


@pytest.mark.parametrize(
    "service,expected",
    [("baxi", 500000), ("women", 500000), ("box", 350000), ("baar", 1200000)],
)
def test_example_five_km_and_exact_line_item_sum(service, expected):
    price = calculate(service, 5)
    assert price["cost"] == expected
    assert sum(line["amount_irr"] for line in price["breakdown"]) == expected
    assert price["driver_net_irr"] + price["commission_irr"] == expected
    assert price["insurance"] == 0


@pytest.mark.parametrize(
    "service,weight,expected",
    [
        ("box", 1, 300000),
        ("box", 5, 300000),
        ("box", 6, 380000),
        ("box", 10, 380000),
        ("box", 11, 450000),
        ("box", 20, 450000),
        ("baar", 1, 1000000),
        ("baar", 500, 1000000),
        ("baar", 501, 1250000),
        ("baar", 1000, 1250000),
        ("baar", 1001, 1500000),
        ("baar", 2000, 1500000),
    ],
)
def test_weight_band_boundaries_apply_after_minimum(service, weight, expected):
    price = calculate(service, 1, cargo_weight=weight)
    assert price["cost"] == expected
    assert sum(line["amount_irr"] for line in price["breakdown"]) == expected


@pytest.mark.parametrize(
    "service,weight",
    [("box", 0), ("box", 21), ("baar", 2001), ("box", True), ("box", 1.5)],
)
def test_unserviceable_weight_cannot_be_quoted(service, weight):
    with pytest.raises(ValueError, match="Cargo weight"):
        calculate(service, 1, cargo_weight=weight)


def test_round_half_up_return_and_tiny_distances():
    assert calculate("baxi", Decimal("7.25"))["cost"] == 640000
    assert calculate("baxi", Decimal("7.249"))["cost"] == 630000
    assert calculate("baxi", Decimal("0.00000001"))["cost"] == 400000
    for service in ("baxi", "women"):
        price = calculate(service, "7.25", round_trip=True)
        assert price["cost"] == 1280000
        assert sum(line["amount_irr"] for line in price["breakdown"]) == price["cost"]
    with pytest.raises(ValueError):
        calculate("box", 1, round_trip=True)


def test_policy_is_validated_and_callers_cannot_mutate_shared_defaults():
    policy = load_policy()
    policy["services"]["baxi"]["commission_bps"] = 3333
    with pytest.raises(ValueError, match="must match"):
        validate_policy(policy)
    policy["services"]["women"]["commission_bps"] = 3333
    price = calculate("baxi", 5, policy=policy)
    assert price["driver_net_irr"] == 333350
    assert load_policy()["services"]["baxi"]["commission_bps"] == 2000
    for value in [0, -1, "NaN", "Infinity"]:
        with pytest.raises(ValueError):
            calculate("baxi", value)
