import { lazy, Suspense, useEffect, useState } from "react";
import {
  ArrowLeft,
  CarFront,
  Check,
  Package,
  ShieldCheck,
  Truck,
} from "lucide-react";
import {
  Me,
  Draft,
  money,
  serviceNames,
  freshDraft,
  humanError,
  api,
} from "./lib";
import { Field, Busy } from "./ui";
const RoutePicker = lazy(() =>
  import("./RoutePicker").then((module) => ({ default: module.RoutePicker })),
);
export function NewTrip({
  me,
  act,
  busy,
  online,
}: {
  me: Me;
  act: (fn: () => Promise<any>) => void;
  busy: boolean;
  online: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(freshDraft);
  const [routeReady, setRouteReady] = useState(false);
  const [estimate, setEstimate] = useState<{
    cost: number;
    km: number;
    insurance: number;
  } | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const signature = JSON.stringify(draft);
  useEffect(() => {
    setEstimate(null);
    setQuoteError("");
    let valid = true;
    const timer = setTimeout(() => {
      if (online && routeReady)
        api("/quote", draft)
          .then((value) => {
            if (valid) setEstimate(value);
          })
          .catch((e) => {
            if (valid) setQuoteError(humanError(e.message));
          });
    }, 350);
    return () => {
      valid = false;
      clearTimeout(timer);
    };
  }, [signature, online, routeReady]);
  const services = [
    { id: "baxi", name: "بکسی", text: "سفر شهری", icon: CarFront },
    {
      id: "women",
      name: "بانوان",
      text: "همراه رانندهٔ خانم",
      icon: ShieldCheck,
    },
    { id: "box", name: "باکس", text: "بسته‌های سبک", icon: Package },
    { id: "baar", name: "بار", text: "بارهای بزرگ‌تر", icon: Truck },
  ];
  return (
    <div className="map-booking">
      <section className="booking-form">
        <div className="page-heading">
          <span className="eyebrow">یک مسیر تازه</span>
          <h1>کجا می‌ریم؟</h1>
          <p>مسیرت رو مشخص کن؛ بقیه‌اش با بکسی.</p>
        </div>
        <div className="map-booking-grid">
          <Suspense
            fallback={
              <div className="panel">
                <Busy /> در حال آماده‌سازی نقشه
              </div>
            }
          >
            <RoutePicker
              draft={draft}
              onReady={setRouteReady}
              onChange={(key, point) =>
                setDraft((old) => ({ ...old, [key]: point }))
              }
            />
          </Suspense>
          <div className="booking-options">
            <div className="section-title">
              <h2>چطور می‌خوای بری؟</h2>
              <span>۴ سرویس، یک انتخاب</span>
            </div>
            <div className="service-grid" aria-label="نوع سرویس">
              {services.map(({ id, name, text, icon: Icon }) => (
                <button
                  key={id}
                  aria-pressed={draft.service === id}
                  disabled={id === "women" && me.account?.sex !== "F"}
                  className={
                    "service " + (draft.service === id ? "selected" : "")
                  }
                  onClick={() =>
                    setDraft((old) => ({
                      ...old,
                      service: id,
                      round_trip: false,
                    }))
                  }
                >
                  <span className="service-icon">
                    <Icon size={26} strokeWidth={1.6} />
                  </span>
                  <span>
                    <strong>{name}</strong>
                    <small>{text}</small>
                  </span>
                  <span className="service-check">
                    {draft.service === id && <Check size={13} />}
                  </span>
                </button>
              ))}
            </div>
            {draft.service === "baxi" || draft.service === "women" ? (
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={draft.round_trip}
                  onChange={(e) =>
                    setDraft((old) => ({
                      ...old,
                      round_trip: e.target.checked,
                    }))
                  }
                />
                <span>رفت و برگشت</span>
                <small>هزینهٔ دو مسیر محاسبه می‌شود</small>
              </label>
            ) : (
              <div className="panel cargo-options">
                <div className="form-grid">
                  <Field label="وزن بار، کیلوگرم">
                    <input
                      type="number"
                      min="1"
                      max="100000"
                      value={draft.cargo_weight}
                      onChange={(e) =>
                        setDraft((old) => ({
                          ...old,
                          cargo_weight: Number(e.target.value),
                        }))
                      }
                    />
                  </Field>
                  <Field label="ارزش بار، ریال">
                    <input
                      type="number"
                      min="0"
                      value={draft.cargo_value}
                      onChange={(e) =>
                        setDraft((old) => ({
                          ...old,
                          cargo_value: Number(e.target.value),
                        }))
                      }
                    />
                  </Field>
                  <Field label="نوع بار">
                    <select
                      value={draft.cargo_type}
                      onChange={(e) =>
                        setDraft((old) => ({
                          ...old,
                          cargo_type: e.target.value,
                        }))
                      }
                    >
                      <option value="unfragile">معمولی</option>
                      <option value="fragile">شکستنی</option>
                    </select>
                  </Field>
                </div>
                {draft.service === "baar" && (
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={draft.client_helped}
                      onChange={(e) =>
                        setDraft((old) => ({
                          ...old,
                          client_helped: e.target.checked,
                        }))
                      }
                    />
                    در حمل بار کمک می‌کنم
                  </label>
                )}
              </div>
            )}
            <div className="fare-row">
              <div>
                <span>برآورد هزینه</span>
                <small>
                  {estimate
                    ? `${money(estimate.km)} کیلومتر · فاصلهٔ مستقیم`
                    : "بر پایهٔ فاصلهٔ مستقیم"}
                </small>
              </div>
              <strong>
                {estimate ? money(estimate.cost) : "—"}
                <small>ریال</small>
              </strong>
            </div>
            {estimate && estimate.insurance > 0 && (
              <p className="muted">
                شامل {money(estimate.insurance)} ریال بیمهٔ آزمایشی، معادل ۲٪
                ارزش بار
              </p>
            )}
            {quoteError && (
              <p className="inline-error" role="alert">
                {quoteError}
              </p>
            )}
            <button
              className="primary wide booking-submit"
              disabled={busy || !online || !routeReady || !estimate}
              onClick={() => act(() => api("/requests", draft))}
            >
              {busy ? <Busy /> : "درخواست " + serviceNames[draft.service]}
              <ArrowLeft size={20} />
            </button>
            <p className="booking-note">
              <ShieldCheck size={14} />
              نسخهٔ آموزشی؛ درخواست‌ها به سرویس واقعی ارسال نمی‌شوند.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
