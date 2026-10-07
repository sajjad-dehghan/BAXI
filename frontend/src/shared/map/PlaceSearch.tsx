import { useEffect, useRef, useState } from "react";
import { MapPin, Search, X } from "lucide-react";
import { api, humanError } from "../lib/client";
import { Point } from "./serviceArea";
import { Busy } from "../ui/ui";

type Place = { label: string; point: Point };
export function PlaceSearch({
  onSelect,
  stage,
  online,
}: {
  onSelect: (place: Place) => void;
  stage: string;
  online: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const inFlight = useRef(false);
  useEffect(() => {
    sequence.current++;
    setQuery("");
    setResults(null);
    setError("");
    setBusy(false);
  }, [stage]);
  async function search() {
    if (inFlight.current) return;
    inFlight.current = true;
    const request = ++sequence.current;
    setBusy(true);
    setError("");
    setResults(null);
    try {
      const places = await api<Place[]>(
        "/places?q=" + encodeURIComponent(query.trim()),
      );
      if (request === sequence.current) setResults(places);
    } catch (e) {
      if (request === sequence.current)
        setError(humanError((e as Error).message));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="place-search">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && online && query.trim().length >= 2) void search();
        }}
      >
        <label className="search-input">
          <Search size={19} />
          <input
            aria-label="جست‌وجوی مکان در تهران"
            placeholder="خیابان یا مکان عمومی در تهران"
            maxLength={120}
            value={query}
            onChange={(e) => {
              sequence.current++;
              setQuery(e.target.value);
              setResults(null);
              setError("");
            }}
          />
        </label>
        <button
          className="search-submit"
          type="submit"
          disabled={busy || !online || query.trim().length < 2}
          aria-label="جست‌وجوی مکان"
        >
          {busy ? <Busy /> : <Search size={20} />}
        </button>
      </form>
      <small className="search-guidance">
        نام خیابان یا مکان عمومی؛ اطلاعات شخصی وارد نکن.
      </small>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {results && (
        <div className="search-results">
          <div className="search-results-head" aria-live="polite">
            <span>
              {results.length
                ? "نتیجه‌های داخل تهران"
                : "نتیجه‌ای در تهران پیدا نشد؛ از نقشه انتخاب کن."}
            </span>
            <button
              className="icon-button"
              onClick={() => setResults(null)}
              aria-label="بستن نتیجه‌های جست‌وجو"
            >
              <X size={17} />
            </button>
          </div>
          <ul>
            {results.map((place, index) => (
              <li key={index}>
                <button
                  onClick={() => {
                    onSelect(place);
                    setResults(null);
                    setQuery("");
                  }}
                >
                  <MapPin size={19} />
                  <span>{place.label}</span>
                </button>
              </li>
            ))}
          </ul>
          <small>
            جست‌وجوی مکان عمومی ·{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              © OpenStreetMap
            </a>
          </small>
        </div>
      )}
    </div>
  );
}
