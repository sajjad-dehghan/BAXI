import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { CarFront, FileCheck2, MapPin } from "lucide-react";
import { Me, Trip, stateNames, humanError, api } from "../../shared/lib/client";
import { Busy, Empty } from "../../shared/ui/ui";
import { TripCard } from "../../shared/ui/TripCard";
import { inTehran, Point } from "../../shared/map/serviceArea";
const RideMap = lazy(() =>
  import("../../shared/map/RoutePicker").then((module) => ({
    default: module.RideMap,
  })),
);
export function DriverHome({
  me,
  history,
  act,
  busy,
  online,
}: {
  me: Me;
  history: Trip[];
  act: (fn: () => Promise<any>) => void;
  busy: boolean;
  online: boolean;
}) {
  const [location, setLocation] = useState<[number, number]>([
    Number(me.account?.latitude) || 35.7005,
    Number(me.account?.longitude) || 51.3376,
  ]);
  const [candidate, setCandidate] = useState<Point>(location);
  const [target, setTarget] = useState<Point>(location);
  const locationDialog = useRef<HTMLDialogElement>(null);
  const [locationError, setLocationError] = useState("");
  const [locating, setLocating] = useState(false);
  const locationAttempt = useRef(0);
  useEffect(
    () => () => {
      locationAttempt.current++;
    },
    [],
  );
  function closeLocation() {
    locationAttempt.current++;
    setLocating(false);
    locationDialog.current?.close();
  }
  function locate() {
    if (!navigator.geolocation) {
      setLocationError("موقعیت دستگاه در دسترس نیست؛ از نقشه انتخاب کن.");
      return;
    }
    const attempt = ++locationAttempt.current;
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (attempt !== locationAttempt.current) return;
        setLocating(false);
        const point: Point = [
          position.coords.latitude,
          position.coords.longitude,
        ];
        if (!inTehran(point)) {
          setLocationError("موقعیت شما خارج از تهران است.");
          return;
        }
        setCandidate(point);
        setTarget(point);
      },
      () => {
        if (attempt === locationAttempt.current) {
          setLocating(false);
          setLocationError("موقعیت دریافت نشد؛ از روی نقشه انتخاب کن.");
        }
      },
      { timeout: 10000, maximumAge: 0 },
    );
  }
  const [available, setAvailable] = useState<Trip[]>([]);
  const [onDuty, setOnDuty] = useState(false);
  const [loadError, setLoadError] = useState("");
  const active = history.find((t) =>
    ["accepted", "in_progress"].includes(t.state),
  );
  useEffect(() => {
    if (active) {
      setAvailable([]);
      return;
    }
    if (!onDuty || !online) return;
    let valid = true;
    async function refresh() {
      try {
        const result = await api<Trip[]>("/available", {
          latitude: location[0],
          longitude: location[1],
        });
        if (valid) {
          setAvailable(result);
          setLoadError("");
        }
      } catch (e) {
        if (valid) setLoadError(humanError((e as Error).message));
      }
    }
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => {
      valid = false;
      clearInterval(timer);
    };
  }, [onDuty, online, !!active, JSON.stringify(location)]);
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">همراه مسیرها</span>
        <h1>سلام، {me.account?.first_name}</h1>
        <p>درخواست‌های نزدیکت رو ببین و سفر بعدی رو شروع کن.</p>
      </div>
      {me.account?.verification_status !== "approved" ? (
        <div className="panel verification-notice">
          <FileCheck2 size={32} />
          <h2>{stateNames[me.account?.verification_status]}</h2>
          <p>
            {me.account?.rejection_reason ||
              "مدارک شما برای همکاران ارسال شده است. پس از تأیید، درخواست‌های سفر در دسترس خواهند بود."}
          </p>
        </div>
      ) : active ? (
        <TripCard
          trip={active}
          role="driver"
          act={act}
          busy={busy}
          online={online}
        />
      ) : (
        <>
          <div className="panel duty-panel">
            <div>
              <span className={"duty-dot " + (onDuty ? "on" : "")} />
              <strong>
                {onDuty ? "آمادهٔ دریافت درخواست" : "فعلاً خارج از سرویس"}
              </strong>
              <p>درخواست‌های واجد شرایط، تا شعاع ۵ کیلومتر</p>
            </div>
            <button
              className={onDuty ? "secondary" : "primary"}
              disabled={!online}
              onClick={() => setOnDuty(!onDuty)}
            >
              {onDuty ? "خروج از سرویس" : "شروع کار"}
            </button>
          </div>
          <div className="panel driver-location-summary">
            <MapPin size={22} />
            <div>
              <strong>موقعیت دریافت درخواست</strong>
              <p>
                نقطهٔ نمونهٔ شروع: میدان آزادی تهران؛ موقعیتت را بررسی و اصلاح
                کن.
              </p>
            </div>
            <button
              className="secondary"
              onClick={() => {
                setCandidate(location);
                setTarget([...location]);
                setLocationError("");
                locationDialog.current?.showModal();
              }}
            >
              تغییر موقعیت
            </button>
          </div>
          <dialog
            ref={locationDialog}
            className="driver-location-dialog"
            aria-labelledby="driver-location-title"
            onCancel={() => {
              locationAttempt.current++;
              setLocating(false);
            }}
          >
            <header>
              <h2 id="driver-location-title">موقعیت راننده در تهران</h2>
              <button className="text-button" onClick={closeLocation}>
                بازگشت
              </button>
            </header>
            <div className="driver-location-map">
              <Suspense fallback={<Busy />}>
                <RideMap
                  pickup={location}
                  dropoff={location}
                  stage="pickup"
                  target={target}
                  onMove={setCandidate}
                  onLocate={locate}
                  locating={locating}
                />
              </Suspense>
            </div>
            <p>
              نقشه را جابه‌جا کن یا از موقعیت دستگاه استفاده کن. نقطهٔ نمونه،
              موقعیت واقعی دستگاه نیست.
            </p>
            {locationError && (
              <p className="inline-error" role="alert">
                {locationError}
              </p>
            )}
            {!inTehran(candidate) && (
              <p className="inline-error" role="alert">
                نقطه باید داخل شهر تهران باشد.
              </p>
            )}
            <button
              className="primary wide"
              disabled={locating || !inTehran(candidate)}
              onClick={() => {
                setLocation(candidate);
                closeLocation();
              }}
            >
              تأیید موقعیت راننده
            </button>
          </dialog>
          {loadError && (
            <p role="alert" className="inline-error">
              {loadError}
            </p>
          )}
          {onDuty && available.length ? (
            <div className="trip-grid">
              {available.map((t) => (
                <TripCard
                  key={t.id}
                  trip={t}
                  role="driver"
                  act={act}
                  busy={busy}
                  online={online}
                />
              ))}
            </div>
          ) : (
            <Empty
              title={onDuty ? "هنوز درخواستی نیست" : "هر وقت آماده‌ای، شروع کن"}
              text={
                onDuty
                  ? "با رسیدن یک درخواست مناسب، همین‌جا نمایش داده می‌شود."
                  : "موقعیتت را بررسی کن و وارد سرویس شو."
              }
              icon={CarFront}
            />
          )}
        </>
      )}
    </>
  );
}
