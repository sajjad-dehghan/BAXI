import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { Feature, Polygon } from "geojson";
import { LocateFixed, MapPin } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { Point, tehranArea, tehranBounds } from "./serviceArea";

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
  const updating = useRef(false);
  const selection = useRef<Point>(target);
  const callbacks = useRef({ onMove, onTileError, stage });
  callbacks.current = { onMove, onTileError, stage };
  const route = useRef({ pickup, dropoff });
  route.current = { pickup, dropoff };
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
      if (updating.current || callbacks.current.stage === "ready") return;
      const center = instance.getCenter();
      selection.current = [center.lat, center.lng];
      callbacks.current.onMove([center.lat, center.lng]);
    });
    instance.on("click", (event: L.LeafletMouseEvent) => {
      if (callbacks.current.stage !== "ready") instance.panTo(event.latlng);
    });
    const observer = new ResizeObserver(() => {
      updating.current = true;
      instance.invalidateSize({ pan: false });
      if (callbacks.current.stage === "ready")
        instance.fitBounds(
          L.latLngBounds([route.current.pickup, route.current.dropoff]),
          { padding: [45, 45], maxZoom: 15, animate: false },
        );
      else
        instance.setView(selection.current, instance.getZoom(), {
          animate: false,
        });
      updating.current = false;
    });
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
    updating.current = true;
    selection.current = target;
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
    updating.current = false;
  }, [stage, target]);
  return (
    <div
      ref={host}
      className="city-map"
      aria-label="نقشهٔ تهران؛ با کلیدهای جهت‌نما یا کشیدن نقشه موقعیت را انتخاب کنید"
    />
  );
}

export function RideMap({
  pickup,
  dropoff,
  stage,
  target,
  onMove,
  onLocate,
  locating = false,
}: {
  pickup: Point;
  dropoff: Point;
  stage: Stage;
  target: Point;
  onMove: (point: Point) => void;
  onLocate?: () => void;
  locating?: boolean;
}) {
  const [tileError, setTileError] = useState(false);
  return (
    <div className={"map-viewport " + stage}>
      <MapCanvas
        pickup={pickup}
        dropoff={dropoff}
        stage={stage}
        target={target}
        onMove={onMove}
        onTileError={setTileError}
      />
      <span className="tehran-badge">تهران</span>
      {stage !== "ready" && (
        <div className="center-pin" aria-hidden="true">
          <span>{stage === "pickup" ? "مبدأ" : "مقصد"}</span>
          <MapPin
            size={44}
            fill={stage === "pickup" ? "#7040bd" : "#17191c"}
            color="white"
            strokeWidth={1.5}
          />
          <i />
        </div>
      )}
      {onLocate && stage !== "ready" && (
        <button
          className="locate-button"
          aria-label="استفاده از موقعیت من"
          disabled={locating}
          onClick={onLocate}
        >
          <LocateFixed size={22} />
        </button>
      )}
      {tileError && (
        <p className="tile-notice" role="status">
          نقشه بارگذاری نشد؛ اتصال اینترنت را بررسی کنید.
        </p>
      )}
    </div>
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
    <RideMap
      pickup={pickup}
      dropoff={dropoff}
      stage="ready"
      target={pickup}
      onMove={() => {}}
    />
  );
}
