from unittest.mock import Mock

import pytest
import requests

import places


@pytest.fixture(autouse=True)
def geocoder(monkeypatch):
    places._cache.clear()
    monkeypatch.setattr(places, "_last_request", 0)
    monkeypatch.setattr(places.time, "monotonic", lambda: 100.0)
    response = Mock()
    response.json.return_value = [
        {"lat": "35.7005", "lon": "51.3376", "display_name": "میدان آزادی"},
        {"lat": "34.798", "lon": "48.515", "display_name": "همدان"},
    ]
    request = Mock(return_value=response)
    monkeypatch.setattr(places.requests, "get", request)
    return request, response


def test_filters_city_caches_normalized_query_and_identifies_application(geocoder):
    request, _ = geocoder
    result = places.search_places(" میدان   آزادی ")
    assert result == [{"label": "میدان آزادی", "point": [35.7005, 51.3376]}]
    assert places.search_places("میدان آزادی") == result
    request.assert_called_once()
    assert request.call_args.kwargs["params"]["bounded"] == 1
    assert "BAXI-Tehran-Demo" in request.call_args.kwargs["headers"]["User-Agent"]


def test_rate_limit_shared_between_distinct_queries(geocoder):
    places.search_places("آزادی")
    with pytest.raises(ValueError, match="یک ثانیه"):
        places.search_places("انقلاب")
    assert geocoder[0].call_count == 1


@pytest.mark.parametrize("payload", [{"error": "unavailable"}, [{}], [None]])
def test_invalid_response_keeps_map_fallback(geocoder, payload):
    geocoder[1].json.return_value = payload
    with pytest.raises(ValueError, match="نقشه"):
        places.search_places("آزادی")
    assert not places._cache


def test_provider_failure_and_busy_lock_do_not_send_extra_requests(geocoder):
    geocoder[0].side_effect = requests.Timeout()
    with pytest.raises(ValueError, match="نقشه"):
        places.search_places("آزادی")
    with places._lock:
        with pytest.raises(ValueError, match="قبلی"):
            places.search_places("انقلاب")
    assert geocoder[0].call_count == 1


def test_provider_can_be_switched_without_client_update(geocoder, monkeypatch):
    monkeypatch.setenv("BAXI_GEOCODER_URL", "https://geocoder.example/")
    places.search_places("آزادی")
    assert geocoder[0].call_args.args == ("https://geocoder.example/search",)


@pytest.mark.parametrize("query", ["", "ا", "a" * 121])
def test_invalid_search_never_contacts_provider(geocoder, query):
    with pytest.raises(ValueError):
        places.search_places(query)
    geocoder[0].assert_not_called()
