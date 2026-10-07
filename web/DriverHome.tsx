import { useEffect, useState } from "react";
import { CarFront, ChevronDown, FileCheck2 } from "lucide-react";
import { Me, Trip, stateNames, humanError, api } from "./lib";
import { Field, Empty } from "./ui";
import { TripCard } from "./TripCard";
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
  const [location, setLocation] = useState<[number, number]>([34.798, 48.515]);
  const [available, setAvailable] = useState<Trip[]>([]);
  const [onDuty, setOnDuty] = useState(false);
  const [loadError, setLoadError] = useState("");
  const active = history.find((t) =>
    ["accepted", "in_progress"].includes(t.state),
  );
  useEffect(() => {
    if (!onDuty || !online || active) return;
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
          <details className="panel coordinate-editor">
            <summary>
              موقعیت راننده
              <ChevronDown size={16} />
            </summary>
            <div className="form-grid">
              {[0, 1].map((i) => (
                <Field
                  key={i}
                  label={i === 0 ? "عرض جغرافیایی" : "طول جغرافیایی"}
                >
                  <input
                    type="number"
                    step="any"
                    dir="ltr"
                    value={location[i]}
                    onChange={(e) =>
                      setLocation(
                        (old) =>
                          old.map((v, j) =>
                            i === j ? Number(e.target.value) : v,
                          ) as [number, number],
                      )
                    }
                  />
                </Field>
              ))}
            </div>
          </details>
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
