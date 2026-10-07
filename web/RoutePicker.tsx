import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { Feature, Polygon } from "geojson";
import { Check, LocateFixed, MapPin, Pencil } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { Draft } from "./lib";
import { inTehran, Point, tehranArea, tehranBounds } from "./serviceArea";

type Stage = "pickup" | "dropoff" | "ready";
function MapCanvas({
  pickup,
  dropoff,
  stage,
  target,
  onMove,
  onTileError,
}: {
  pickup: Point;
  dropoff: Point;
  stage: Stage;
  target: Point;
  onMove: (point: Point) => void;
  onTileError: (error: boolean) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<L.LayerGroup | null>(null);
  const callbacks = useRef({ onMove, onTileError, stage });
  callbacks.current = { onMove, onTileError, stage };
  useEffect(() => {
    const instance = L.map(host.current!, {
      center: pickup,
      zoom: 15,
      minZoom: 11,
      maxZoom: 18,
      maxBounds: L.latLngBounds(tehranBounds).pad(0.03),
      maxBoundsViscosity: 1,
      zoomControl: false,
    });
    map.current = instance;
    L.control
      .zoom({
        position: "bottomleft",
        zoomInTitle: "بزرگ‌نمایی",
        zoomOutTitle: "کوچک‌نمایی",
      })
      .addTo(instance);
    instance.attributionControl.setPrefix(false);
    let failedTiles = false;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    })
      .on("loading", () => {
        failedTiles = false;
      })
      .on("tileerror", () => {
        failedTiles = true;
        callbacks.current.onTileError(true);
      })
      .on("load", () => callbacks.current.onTileError(failedTiles))
      .addTo(instance);
    L.geoJSON(tehranArea as Feature<Polygon>, {
      style: { color: "#7040bd", weight: 2, opacity: 0.6, fill: false },
      interactive: false,
    }).addTo(instance);
    layers.current = L.layerGroup().addTo(instance);
    instance.on("moveend", () => {
      if (callbacks.current.stage === "ready") return;
      const center = instance.getCenter();
      callbacks.current.onMove([center.lat, center.lng]);
    });
    instance.on("click", (event: L.LeafletMouseEvent) => {
      if (callbacks.current.stage !== "ready") instance.panTo(event.latlng);
    });
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(host.current!);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!map.current || !layers.current) return;
    const instance = map.current;
    const group = layers.current;
    group.clearLayers();
    function marker(point: Point, kind: "pickup" | "dropoff") {
      L.marker(point, {
        icon: L.divIcon({
          className: `stop-marker ${kind}`,
          html: kind === "pickup" ? "۱" : "۲",
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
        title: kind === "pickup" ? "مبدأ انتخاب‌شده" : "مقصد انتخاب‌شده",
        keyboard: false,
      }).addTo(group);
    }
    if (stage !== "pickup") marker(pickup, "pickup");
    if (stage === "ready") {
      marker(dropoff, "dropoff");
      L.polyline([pickup, dropoff], {
        color: "#7040bd",
        weight: 3,
        dashArray: "6 8",
        interactive: false,
      }).addTo(group);
      instance.fitBounds(L.latLngBounds([pickup, dropoff]), {
        padding: [65, 65],
        maxZoom: 15,
        animate: false,
      });
    } else
      instance.setView(target, Math.max(instance.getZoom(), 15), {
        animate: false,
      });
  }, [stage, target]);
  return (
    <div
      ref={host}
      className="city-map"
      aria-label="نقشهٔ تهران؛ با کلیدهای جهت‌نما یا کشیدن نقشه موقعیت را انتخاب کنید"
    />
  );
}

export function RoutePicker({
  draft,
  onChange,
  onReady,
}: {
  draft: Draft;
  onChange: (key: "pickup" | "dropoff", point: Point) => void;
  onReady: (ready: boolean) => void;
}) {
  const [stage, setStage] = useState<Stage>("pickup");
  const [candidate, setCandidate] = useState<Point>(draft.pickup);
  const [target, setTarget] = useState<Point>(draft.pickup);
  const [error, setError] = useState("");
  const [tileError, setTileError] = useState(false);
  const [locating, setLocating] = useState(false);
  const allowed = inTehran(candidate);
  const identical =
    stage === "dropoff" &&
    Math.abs(candidate[0] - draft.pickup[0]) < 1e-7 &&
    Math.abs(candidate[1] - draft.pickup[1]) < 1e-7;
  function edit(key: "pickup" | "dropoff") {
    setStage(key);
    setCandidate(draft[key]);
    setTarget([...draft[key]]);
    setError("");
    onReady(false);
  }
  function confirm() {
    if (stage === "ready" || !allowed || identical) return;
    onChange(stage, candidate);
    setError("");
    if (stage === "pickup") {
      setStage("dropoff");
      setCandidate(draft.dropoff);
      setTarget([...draft.dropoff]);
    } else {
      setStage("ready");
      onReady(true);
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      setError("موقعیت مکانی در این مرورگر در دسترس نیست.");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const point: Point = [
          position.coords.latitude,
          position.coords.longitude,
        ];
        if (!inTehran(point)) {
          setError(
            "موقعیت شما خارج از تهران است. سرویس فقط داخل شهر تهران فعال است.",
          );
          return;
        }
        setCandidate(point);
        setTarget(point);
      },
      () => {
        setLocating(false);
        setError("دسترسی به موقعیت ممکن نشد. نقطه را روی نقشه انتخاب کنید.");
      },
      { timeout: 10000, maximumAge: 0, enableHighAccuracy: true },
    );
  }
  return (
    <section className="route-picker" aria-label="انتخاب مسیر روی نقشه">
      <div className="route-steps">
        {(["pickup", "dropoff"] as const).map((key, i) => (
          <button
            key={key}
            className={"route-step " + (stage === key ? "current" : "")}
            onClick={() => edit(key)}
            aria-current={stage === key ? "step" : undefined}
            disabled={locating || (key === "dropoff" && stage === "pickup")}
          >
            <span className={"stop-number " + key}>
              {i + 1 === 1 ? "۱" : "۲"}
            </span>
            <span>
              <small>{key === "pickup" ? "مبدأ" : "مقصد"}</small>
              <strong>
                {stage === key
                  ? "روی نقشه انتخاب کن"
                  : stage === "ready" ||
                      (key === "pickup" && stage === "dropoff")
                    ? "موقعیت انتخاب شد"
                    : "قدم بعدی"}
              </strong>
            </span>
            {stage === "ready" ? (
              <Pencil size={15} />
            ) : key === "pickup" && stage === "dropoff" ? (
              <Check size={17} />
            ) : null}
          </button>
        ))}
      </div>
      <div className={"map-viewport " + stage}>
        <MapCanvas
          pickup={draft.pickup}
          dropoff={draft.dropoff}
          stage={stage}
          target={target}
          onMove={setCandidate}
          onTileError={setTileError}
        />
        <span className="tehran-badge">فقط شهر تهران</span>
        {stage !== "ready" && (
          <div className="center-pin" aria-hidden="true">
            <span>{stage === "pickup" ? "مبدأ" : "مقصد"}</span>
            <MapPin
              size={42}
              fill={stage === "pickup" ? "#7040bd" : "#292334"}
              color="white"
              strokeWidth={1.5}
            />
            <i />
          </div>
        )}
        {stage !== "ready" && (
          <button
            className="locate-button"
            aria-label="استفاده از موقعیت من"
            disabled={locating}
            onClick={locate}
          >
            <LocateFixed size={21} />
          </button>
        )}
        {tileError && (
          <p className="tile-notice" role="status">
            نقشه بارگذاری نشد؛ اتصال اینترنت را بررسی کنید.
          </p>
        )}
      </div>
      <div
        className="map-confirm"
        data-latitude={candidate[0]}
        data-longitude={candidate[1]}
      >
        <p aria-live="polite">
          {stage === "ready"
            ? "مبدأ و مقصد آماده‌اند؛ سرویس را انتخاب کن."
            : !allowed
              ? "این نقطه خارج از محدودهٔ شهر تهران است."
              : identical
                ? "مقصد باید با مبدأ متفاوت باشد."
                : `نقشه را جابه‌جا کن تا پین روی ${stage === "pickup" ? "مبدأ" : "مقصد"} قرار بگیرد.`}
        </p>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        {stage !== "ready" ? (
          <button
            className="primary wide"
            onClick={confirm}
            disabled={!allowed || identical || locating}
          >
            {stage === "pickup" ? "تأیید مبدأ" : "تأیید مقصد"}
            <Check size={18} />
          </button>
        ) : (
          <small className="muted">
            خط‌چین، فاصلهٔ مستقیم را نشان می‌دهد؛ مسیر خیابانی نیست.
          </small>
        )}
      </div>
    </section>
  );
}

export function JourneyMap({
  pickup,
  dropoff,
}: {
  pickup: Point;
  dropoff: Point;
}) {
  return (
    <section className="route-picker journey-map" aria-label="مبدأ و مقصد سفر">
      <div className="map-viewport ready">
        <MapCanvas
          pickup={pickup}
          dropoff={dropoff}
          stage="ready"
          target={pickup}
          onMove={() => {}}
          onTileError={() => {}}
        />
        <span className="tehran-badge">تهران</span>
      </div>
      <p className="journey-caption">۱ مبدأ · ۲ مقصد · خط‌چین: فاصلهٔ مستقیم</p>
    </section>
  );
}
