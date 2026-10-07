import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CarFront,
  Check,
  ChevronDown,
  MapPin,
  Package,
  Pencil,
  ShieldCheck,
  Truck,
  Wallet,
} from "lucide-react";
import {
  api,
  BookingState,
  Draft,
  humanError,
  Me,
  money,
  toman,
  toIrr,
  Quote,
  serviceNames,
  Trip,
} from "../../shared/lib/client";
import { inTehran, Point } from "../../shared/map/serviceArea";
import { Busy, Field } from "../../shared/ui/ui";
import { PlaceSearch } from "../../shared/map/PlaceSearch";
import { FareDetails } from "../../shared/ui/FareDetails";
const RideMap = lazy(() =>
  import("../../shared/map/RoutePicker").then((module) => ({
    default: module.RideMap,
  })),
);
const services = [
  {
    id: "baxi",
    name: "بکسی",
    text: "سفر شهری",
    detail: "سفر روزمره با خودرو",
    icon: CarFront,
  },
  {
    id: "women",
    name: "بانوان",
    text: "همراه رانندهٔ خانم",
    detail: "ویژهٔ مسافران خانم",
    icon: ShieldCheck,
  },
  {
    id: "box",
    name: "باکس",
    text: "بسته‌های سبک",
    detail: "بسته تا ۲۰ کیلوگرم",
    icon: Package,
  },
  {
    id: "baar",
    name: "بار",
    text: "بارهای بزرگ‌تر",
    detail: "بار شهری تا ۲۰۰۰ کیلوگرم",
    icon: Truck,
  },
];
export function NewTrip({
  me,
  act,
  busy,
  online,
  booking,
  setBooking,
  onWallet,
  history,
}: {
  me: Me;
  act: (fn: () => Promise<any>) => void;
  busy: boolean;
  online: boolean;
  booking: BookingState;
  setBooking: (value: BookingState) => void;
  onWallet: () => void;
  history: Trip[];
}) {
  const { draft, stage } = booking;
  const [candidate, setCandidate] = useState<Point>(
    stage === "pickup" ? draft.pickup : draft.dropoff,
  );
  const [target, setTarget] = useState<Point>(candidate);
  const [label, setLabel] = useState(
    stage === "pickup" ? draft.pickup_label : draft.dropoff_label,
  );
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [quoteErrors, setQuoteErrors] = useState<Record<string, string>>({});
  const [quoteSignature, setQuoteSignature] = useState("");
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(Date.now());
  const heading = useRef<HTMLHeadingElement>(null);
  const paymentDialog = useRef<HTMLDialogElement>(null);
  const locationAttempt = useRef(0);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [stage]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(
    () => () => {
      locationAttempt.current++;
    },
    [],
  );
  const signature = JSON.stringify({
    pickup: draft.pickup,
    dropoff: draft.dropoff,
    round_trip: draft.round_trip,
    cargo_weight: draft.cargo_weight,
    cargo_value: draft.cargo_value,
    cargo_type: draft.cargo_type,
    client_helped: draft.client_helped,
  });
  useEffect(() => {
    setQuotes({});
    setQuoteErrors({});
    if (!online || stage !== "ready") return;
    let valid = true;
    const timer = setTimeout(async () => {
      const estimates = await Promise.allSettled(
        services.map(({ id }) =>
          api<Quote>("/quote", {
            ...draft,
            service: id,
            round_trip: ["baxi", "women"].includes(id) && draft.round_trip,
          }),
        ),
      );
      if (!valid) return;
      const result: Record<string, Quote> = {};
      const errors: Record<string, string> = {};
      estimates.forEach((value, index) => {
        if (value.status === "fulfilled")
          result[services[index].id] = value.value;
        else errors[services[index].id] = humanError(value.reason.message);
      });
      setQuotes(result);
      setQuoteErrors(errors);
      setQuoteSignature(signature);
      setNow(Date.now());
    }, 300);
    return () => {
      valid = false;
      clearTimeout(timer);
    };
  }, [signature, online, stage, revision]);
  function update(patch: Partial<Draft>) {
    setBooking({ ...booking, draft: { ...draft, ...patch } });
  }
  function edit(key: "pickup" | "dropoff") {
    locationAttempt.current++;
    setLocating(false);
    setLocationError("");
    setCandidate(draft[key]);
    setTarget([...draft[key]]);
    setLabel(draft[(key + "_label") as "pickup_label" | "dropoff_label"]);
    setBooking({ ...booking, stage: key });
  }
  function move(point: Point) {
    setCandidate(point);
    if (
      Math.abs(point[0] - target[0]) > 1e-6 ||
      Math.abs(point[1] - target[1]) > 1e-6
    )
      setLabel("نقطهٔ انتخاب‌شده روی نقشه");
  }
  function choose(point: Point, title: string) {
    setCandidate(point);
    setTarget(point);
    setLabel(title);
    setLocationError("");
  }
  const validPoint = inTehran(candidate);
  const samePoint =
    stage === "dropoff" &&
    Math.abs(candidate[0] - draft.pickup[0]) < 1e-7 &&
    Math.abs(candidate[1] - draft.pickup[1]) < 1e-7;
  function confirm() {
    if (!validPoint || samePoint || stage === "ready") return;
    const next = { ...draft, [stage]: candidate, [stage + "_label"]: label };
    const complete = stage === "dropoff" || booking.dropoffConfirmed;
    setBooking({
      ...booking,
      draft: next,
      pickupConfirmed: true,
      dropoffConfirmed: complete,
      stage: complete ? "ready" : "dropoff",
    });
    if (!complete) {
      setCandidate(candidate);
      setTarget([...candidate]);
      setLabel("نقطهٔ انتخاب‌شده روی نقشه");
    }
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
          setLocationError(
            "موقعیت شما خارج از تهران است. سرویس فقط داخل شهر تهران فعال است.",
          );
          return;
        }
        choose(point, "موقعیت انتخاب‌شدهٔ دستگاه");
      },
      () => {
        if (attempt === locationAttempt.current) {
          setLocating(false);
          setLocationError(
            "دسترسی به موقعیت ممکن نشد؛ نقطه را از نقشه انتخاب کن.",
          );
        }
      },
      { timeout: 10000, maximumAge: 0, enableHighAccuracy: true },
    );
  }
  const estimate =
    quoteSignature === signature ? quotes[draft.service] : undefined;
  const expired = !!estimate && now >= Date.parse(estimate.expires_at);
  const insufficient =
    draft.payment === "wallet-to-wallet" &&
    !!estimate &&
    Number(me.account?.wallet_balance ?? 0) < estimate.cost;
  const delivery = ["box", "baar"].includes(draft.service);
  const recent = history
    .filter((trip) => trip.state === "completed" && trip.dropoff_label)
    .filter(
      (trip, index, list) =>
        list.findIndex(
          (other) => other.dropoff_label === trip.dropoff_label,
        ) === index,
    )
    .slice(0, 3);
  return (
    <div className={"ride-shell booking-stage-" + stage}>
      <div className="ride-scene">
        <Suspense
          fallback={
            <div className="map-loading">
              <Busy /> در حال آماده‌سازی نقشه
            </div>
          }
        >
          <RideMap
            pickup={draft.pickup}
            dropoff={draft.dropoff}
            stage={stage}
            target={target}
            onMove={move}
            onLocate={locate}
            locating={locating}
          />
        </Suspense>
      </div>
      <section className="ride-sheet" aria-label="انتخاب مسیر و سرویس">
        <div className="sheet-handle" aria-hidden="true" />
        <div className="ride-sheet-content">
          <header className="ride-sheet-header">
            {stage !== "pickup" && (
              <button
                className="icon-button"
                aria-label="بازگشت به مرحلهٔ قبل"
                onClick={() => edit(stage === "ready" ? "dropoff" : "pickup")}
              >
                <ArrowRight size={22} />
              </button>
            )}
            <div>
              <h1 ref={heading} tabIndex={-1}>
                {stage === "pickup"
                  ? "مبدأ سفر کجاست؟"
                  : stage === "dropoff"
                    ? "کجا می‌ریم؟"
                    : "انتخاب سرویس"}
              </h1>
              <p>
                داخل شهر تهران <span>· نسخهٔ آزمایشی</span>
              </p>
            </div>
            <span className="step-count">
              {stage === "pickup" ? "۱" : stage === "dropoff" ? "۲" : "۳"} از ۳
            </span>
          </header>
          <div className="ride-stops" aria-label="مسیر انتخاب‌شده">
            {(["pickup", "dropoff"] as const).map((key) => (
              <button
                key={key}
                className={stage === key ? "current" : ""}
                disabled={key === "dropoff" && !booking.pickupConfirmed}
                onClick={() => edit(key)}
                aria-label={key === "pickup" ? "ویرایش مبدأ" : "ویرایش مقصد"}
              >
                <span className={"route-dot " + key} />
                <span>
                  <small>{key === "pickup" ? "مبدأ" : "مقصد"}</small>
                  <strong>
                    {stage === key
                      ? "روی نقشه انتخاب کن"
                      : booking[
                            key === "pickup"
                              ? "pickupConfirmed"
                              : "dropoffConfirmed"
                          ]
                        ? draft[
                            (key + "_label") as "pickup_label" | "dropoff_label"
                          ]
                        : "هنوز انتخاب نشده"}
                  </strong>
                </span>
                <Pencil size={15} />
              </button>
            ))}
          </div>
          <div className="ride-sheet-body" key={stage}>
            {stage !== "ready" ? (
              <>
                <PlaceSearch
                  stage={stage}
                  online={online}
                  onSelect={(place) => choose(place.point, place.label)}
                />
                <div
                  className="pin-selection"
                  data-latitude={candidate[0]}
                  data-longitude={candidate[1]}
                >
                  <MapPin size={21} />
                  <div>
                    <strong>{label}</strong>
                    <p aria-live="polite">
                      {!validPoint
                        ? "این نقطه خارج از محدودهٔ شهر تهران است."
                        : samePoint
                          ? "مقصد باید با مبدأ متفاوت باشد."
                          : "نقشه را جابه‌جا کن یا مکان را جست‌وجو کن."}
                    </p>
                  </div>
                </div>
                {locationError && (
                  <p className="inline-error" role="alert">
                    {locationError}
                  </p>
                )}
                {stage === "dropoff" && recent.length > 0 && (
                  <div className="recent-places">
                    <small>از سفرهای قبلی</small>
                    {recent.map((trip) => (
                      <button
                        key={trip.id}
                        onClick={() =>
                          choose(
                            [
                              Number(trip.dropoff_latitude),
                              Number(trip.dropoff_longitude),
                            ],
                            trip.dropoff_label,
                          )
                        }
                      >
                        <MapPin size={17} />
                        <span>{trip.dropoff_label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <p className="map-privacy-note">
                  نقطهٔ شروع نقشه، موقعیت دستگاه شما نیست. برای استفاده از GPS،
                  دکمهٔ موقعیت روی نقشه را بزنید.
                </p>
              </>
            ) : (
              <>
                <div className="ride-mode" aria-label="نوع درخواست">
                  <button
                    aria-pressed={!delivery}
                    onClick={() =>
                      update({
                        service: "baxi",
                        round_trip: false,
                        cargo_weight:
                          draft.cargo_weight > 0 ? draft.cargo_weight : 5,
                        cargo_value:
                          draft.cargo_value >= 0 ? draft.cargo_value : 0,
                      })
                    }
                  >
                    سفر
                  </button>
                  <button
                    aria-pressed={delivery}
                    onClick={() =>
                      update({ service: "box", round_trip: false })
                    }
                  >
                    ارسال بسته و بار
                  </button>
                </div>
                <div
                  className="ride-service-list"
                  role="radiogroup"
                  aria-label="انتخاب سرویس"
                >
                  {services
                    .filter(
                      ({ id }) => delivery === ["box", "baar"].includes(id),
                    )
                    .map(({ id, name, text, detail, icon: Icon }) => (
                      <label
                        key={id}
                        className={
                          "ride-service " +
                          (draft.service === id ? "selected" : "") +
                          (id === "women" && me.account?.sex !== "F"
                            ? " unavailable"
                            : "")
                        }
                      >
                        <input
                          type="radio"
                          name="ride-service"
                          value={id}
                          checked={draft.service === id}
                          disabled={id === "women" && me.account?.sex !== "F"}
                          onChange={() => update({ service: id })}
                        />
                        <span className="ride-vehicle">
                          <Icon size={34} strokeWidth={1.5} />
                        </span>
                        <span className="ride-service-copy">
                          <strong>{name}</strong>
                          <small>{text}</small>
                          <span>{id === "women" ? detail : ""}</span>
                        </span>
                        <span className="ride-service-price">
                          <strong>
                            {quoteSignature === signature && quotes[id]
                              ? toman(quotes[id].cost)
                              : "—"}
                          </strong>
                          <small>تومان</small>
                        </span>
                      </label>
                    ))}
                </div>
                {delivery ? (
                  <details className="ride-options" open>
                    <summary>
                      مشخصات بسته و بار
                      <ChevronDown size={16} />
                    </summary>
                    <div className="form-grid">
                      <Field label="وزن بار، کیلوگرم">
                        <input
                          type="number"
                          min={1}
                          max={draft.service === "box" ? 20 : 2000}
                          value={draft.cargo_weight}
                          onChange={(e) =>
                            update({ cargo_weight: Number(e.target.value) })
                          }
                        />
                      </Field>
                      <Field label="ارزش اظهارشدهٔ بار، تومان">
                        <input
                          type="number"
                          min={0}
                          max={100000000000}
                          step={1}
                          value={draft.cargo_value / 10}
                          onChange={(e) =>
                            /^\d*$/.test(e.target.value) &&
                            update({
                              cargo_value: toIrr(e.target.value || "0"),
                            })
                          }
                        />
                      </Field>
                      <Field label="نوع بار">
                        <select
                          value={draft.cargo_type}
                          onChange={(e) =>
                            update({ cargo_type: e.target.value })
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
                            update({ client_helped: e.target.checked })
                          }
                        />
                        در حمل بار کمک می‌کنم
                      </label>
                    )}
                  </details>
                ) : (
                  <label className="ride-return">
                    <input
                      type="checkbox"
                      checked={draft.round_trip}
                      onChange={(e) => update({ round_trip: e.target.checked })}
                    />
                    <span>
                      رفت و برگشت<small>هزینهٔ دو مسیر</small>
                    </span>
                  </label>
                )}
                {["box", "baar"].includes(draft.service) && (
                  <p className="fare-explanation">
                    ارزش بار صرفاً اظهار شماست؛ هزینهٔ بیمه دریافت نمی‌شود و
                    پوشش بیمهٔ واقعی نداریم.
                  </p>
                )}
                {estimate && (
                  <FareDetails
                    breakdown={estimate.breakdown}
                    cost={estimate.cost}
                    version={estimate.policy_version}
                  />
                )}
                <details className="fare-details">
                  <summary>دربارهٔ هزینه و مسیر</summary>
                  <p>
                    {estimate ? money(estimate.km) + " کیلومتر · " : ""}فاصلهٔ
                    مستقیم بین دو نقطه؛ خط‌چین مسیر خیابانی نیست. این نسخه
                    آموزشی است و پرداخت و بیمهٔ واقعی ندارد.
                  </p>
                  <p>
                    لغو پیش از شروع و انتظار رایگان است؛ هزینهٔ ترافیک، تقاضا،
                    عوارض و مالیات افزوده نداریم. قیمت پس از ثبت ثابت می‌ماند.
                  </p>
                </details>
                {expired && (
                  <p className="inline-error" role="status">
                    اعتبار پنج‌دقیقه‌ای قیمت تمام شده؛ قیمت تازه بگیر و دوباره
                    بررسی کن.
                  </p>
                )}
                {quoteErrors[draft.service] && (
                  <p className="inline-error" role="alert">
                    {quoteErrors[draft.service]}
                  </p>
                )}
                {quoteErrors[draft.service] && !estimate && (
                  <button
                    className="secondary"
                    disabled={busy || !online}
                    onClick={() => setRevision((value) => value + 1)}
                  >
                    دریافت دوبارهٔ قیمت
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        <footer className="ride-sheet-footer">
          {stage === "ready" ? (
            <>
              <button
                className="payment-trigger"
                onClick={() => paymentDialog.current?.showModal()}
                aria-label="تغییر روش پرداخت"
              >
                <Wallet size={19} />
                <span>{draft.payment === "cash" ? "نقدی" : "کیف پول"}</span>
                <ChevronDown size={17} />
              </button>
              {insufficient && (
                <p className="inline-error" role="alert">
                  موجودی کافی نیست؛ روش پرداخت را تغییر بده.
                </p>
              )}
              <div className="ride-total">
                <span>مبلغ نهایی {serviceNames[draft.service]}</span>
                <strong>
                  {estimate ? toman(estimate.cost) : "—"} <small>تومان</small>
                </strong>
              </div>
              <button
                data-testid="request-ride"
                className="primary wide"
                disabled={
                  busy || !online || !estimate || (!expired && insufficient)
                }
                onClick={() => {
                  if (expired) {
                    setRevision((value) => value + 1);
                    return;
                  }
                  act(async () => {
                    try {
                      await api("/requests", {
                        ...draft,
                        quote_id: estimate!.quote_id,
                      });
                    } catch (error) {
                      if (
                        /Quote expired|Invalid quote|Quote does not match/i.test(
                          (error as Error).message,
                        )
                      )
                        setRevision((value) => value + 1);
                      throw error;
                    }
                  });
                }}
              >
                {busy ? (
                  <Busy />
                ) : expired ? (
                  "دریافت قیمت تازه"
                ) : (
                  "درخواست " + serviceNames[draft.service]
                )}
                <Check size={18} />
              </button>
            </>
          ) : (
            <button
              className="primary wide"
              disabled={!validPoint || samePoint || locating}
              onClick={confirm}
            >
              {stage === "pickup" ? "تأیید مبدأ" : "تأیید مقصد"}
              <Check size={18} />
            </button>
          )}
          <small>
            {stage === "ready"
              ? "تومان · تعرفهٔ نمونه · اعتبار قیمت ۵ دقیقه"
              : "محل دقیق را قبل از تأیید روی نقشه بررسی کن"}
          </small>
        </footer>
      </section>
      <dialog
        ref={paymentDialog}
        className="cancel-dialog payment-dialog"
        aria-labelledby="payment-title"
      >
        <h2 id="payment-title">روش پرداخت سفر</h2>
        <fieldset className="ride-payment">
          <legend>روش پرداخت</legend>
          <label>
            <input
              type="radio"
              name="payment"
              checked={draft.payment === "wallet-to-wallet"}
              onChange={() => update({ payment: "wallet-to-wallet" })}
            />
            <Wallet size={19} />
            <span>
              کیف پول
              <small>
                موجودی {toman(Number(me.account?.wallet_balance ?? 0))} تومان
              </small>
            </span>
          </label>
          <label>
            <input
              type="radio"
              name="payment"
              checked={draft.payment === "cash"}
              onChange={() => update({ payment: "cash" })}
            />
            <span>
              نقدی<small>ثبت آزمایشی در پایان سفر</small>
            </span>
          </label>
        </fieldset>
        {insufficient && (
          <div className="wallet-shortfall" role="alert">
            <span>
              موجودی کیف پول کافی نیست؛ نقدی را انتخاب کن یا موجودی را افزایش
              بده.
            </span>
            <button
              className="text-button"
              onClick={() => {
                paymentDialog.current?.close();
                onWallet();
              }}
            >
              افزایش موجودی
            </button>
          </div>
        )}

        <button
          className="primary wide"
          onClick={() => paymentDialog.current?.close()}
        >
          تأیید روش پرداخت
        </button>
      </dialog>
    </div>
  );
}
