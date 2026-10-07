import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  CarFront,
  Check,
  MapPin,
  ReceiptText,
  ShieldCheck,
  Star,
  UserRound,
  X,
} from "lucide-react";
import { api, money, toman, serviceNames, Trip } from "../../shared/lib/client";
import { Busy } from "../../shared/ui/ui";
import { FareDetails } from "../../shared/ui/FareDetails";
const JourneyMap = lazy(() =>
  import("../../shared/map/RoutePicker").then((module) => ({
    default: module.JourneyMap,
  })),
);
export function PassengerJourney({
  trip,
  act,
  busy,
  online,
  onNewTrip,
}: {
  trip: Trip;
  act: (fn: () => Promise<any>) => void;
  busy: boolean;
  online: boolean;
  onNewTrip: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [rating, setRating] = useState(5);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [trip.state]);
  const completed = trip.state === "completed";
  const assigned = !!trip.assigned_driver_id;
  const title =
    {
      requested: "در انتظار راننده",
      accepted: "راننده سفرت را پذیرفت",
      in_progress: "در مسیر مقصد",
      completed: "رسیدی؛ سفر تمام شد",
    }[trip.state as string] ?? "وضعیت سفر";
  const payment = trip.method_of_payment || trip.preferred_payment;
  const facts = (
    <div className="journey-facts">
      <div>
        <span>سرویس</span>
        <strong>{serviceNames[trip.service_type]}</strong>
      </div>
      <div>
        <span>{completed ? "مبلغ ثبت‌شدهٔ سفر" : "هزینهٔ سفر"}</span>
        <strong>{toman(trip.cost)} تومان</strong>
      </div>
      <div>
        <span>روش پرداخت</span>
        <strong>
          {payment === "cash"
            ? "نقدی · ثبت آزمایشی"
            : payment === "wallet-to-wallet"
              ? "کیف پول"
              : "در پایان سفر مشخص می‌شود"}
        </strong>
      </div>
    </div>
  );
  return (
    <div className={"ride-shell journey-state-" + trip.state}>
      <div className="ride-scene">
        <Suspense
          fallback={
            <div className="map-loading">
              <Busy />
            </div>
          }
        >
          <JourneyMap
            pickup={[
              Number(trip.pickup_latitude),
              Number(trip.pickup_longitude),
            ]}
            dropoff={[
              Number(trip.dropoff_latitude),
              Number(trip.dropoff_longitude),
            ]}
          />
        </Suspense>
        <span className="map-distance-note">خط‌چین: اتصال مستقیم دو نقطه</span>
      </div>
      <section className="ride-sheet journey-sheet" aria-label="وضعیت سفر">
        <div className="sheet-handle" aria-hidden="true" />
        <header className="journey-heading">
          <span className={"journey-state-icon " + trip.state}>
            {completed ? (
              <Check size={25} />
            ) : assigned ? (
              <CarFront size={25} />
            ) : (
              <span className="waiting-pulse" />
            )}
          </span>
          <div>
            <h1 ref={heading} tabIndex={-1}>
              {title}
            </h1>
            <p>
              {completed
                ? "رسید سفر و امتیاز شما"
                : trip.state === "requested"
                  ? "درخواست ثبت شده؛ منتظر پذیرش راننده هستیم."
                  : trip.state === "accepted"
                    ? "مشخصات وسیله را پیش از سوار شدن بررسی کن."
                    : "وضعیت و جزئیات سفرت همین‌جاست."}
            </p>
          </div>
        </header>
        <div className="ride-sheet-body" key={trip.state}>
          {completed && facts}
          {completed && (
            <div className="receipt-rating">
              {trip.driver_rating == null ? (
                <>
                  <h2>سفرت چطور بود؟</h2>
                  <div
                    className="star-rating"
                    role="radiogroup"
                    aria-label="امتیاز به راننده"
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <label key={value}>
                        <input
                          type="radio"
                          name="driver-rating"
                          checked={rating === value}
                          onChange={() => setRating(value)}
                          aria-label={money(value) + " ستاره"}
                        />
                        <Star
                          size={31}
                          fill={value <= rating ? "currentColor" : "none"}
                        />
                      </label>
                    ))}
                  </div>
                  <button
                    className="secondary wide"
                    disabled={busy || !online}
                    onClick={() =>
                      act(() => api(`/requests/${trip.id}/rating`, { rating }))
                    }
                  >
                    ثبت امتیاز
                    <Star size={18} />
                  </button>
                </>
              ) : (
                <p className="rated">
                  <Star size={20} fill="currentColor" />
                  امتیاز شما: {money(trip.driver_rating)}
                </p>
              )}
            </div>
          )}
          {!completed &&
            (assigned ? (
              <div className="assigned-driver">
                <div className="driver-identity">
                  <span className="driver-avatar">
                    <UserRound size={28} />
                  </span>
                  <div>
                    <small>رانندهٔ سفر شما</small>
                    <h2>
                      {trip.driver_first_name} {trip.driver_last_name}
                    </h2>
                    <p>
                      {trip.vehicle_name} · {trip.vehicle_color}
                    </p>
                  </div>
                </div>
                <div className="vehicle-plate">
                  <CarFront size={19} />
                  <span>پلاک وسیله</span>
                  <bdi>{trip.vehicle_plate}</bdi>
                </div>
              </div>
            ) : (
              <div className="waiting-copy">
                <ShieldCheck size={22} />
                <p>
                  بعد از پذیرش، نام راننده و مشخصات وسیله اینجا نمایش داده
                  می‌شود.
                </p>
              </div>
            ))}
          {!completed && (
            <div className="journey-route">
              {(["pickup", "dropoff"] as const).map((key) => (
                <div key={key}>
                  <span className={"route-dot " + key} />
                  <span>
                    <small>{key === "pickup" ? "مبدأ" : "مقصد"}</small>
                    <strong>
                      {trip[key + "_label"] || "نقطهٔ ثبت‌شده روی نقشه"}
                    </strong>
                  </span>
                </div>
              ))}
            </div>
          )}
          {!completed && facts}
          <FareDetails
            breakdown={trip.pricing_breakdown}
            cost={trip.cost}
            version={trip.policy_version}
          />
          <details className="journey-details">
            <summary>
              <MapPin size={16} /> جزئیات مسیر
            </summary>
            <p>سفر {money(trip.id)} · تهران</p>
            {completed && (
              <>
                <p>
                  راننده: {trip.driver_first_name} {trip.driver_last_name} ·{" "}
                  {trip.vehicle_name} · {trip.vehicle_color} ·{" "}
                  <bdi>{trip.vehicle_plate}</bdi>
                </p>
                <p>مبدأ: {trip.pickup_label || "نقطهٔ روی نقشه"}</p>
                <p>مقصد: {trip.dropoff_label || "نقطهٔ روی نقشه"}</p>
              </>
            )}
            <bdi>
              مبدأ: {Number(trip.pickup_latitude).toFixed(5)},{" "}
              {Number(trip.pickup_longitude).toFixed(5)}
              <br />
              مقصد: {Number(trip.dropoff_latitude).toFixed(5)},{" "}
              {Number(trip.dropoff_longitude).toFixed(5)}
            </bdi>
            <p>
              خط روی نقشه فاصلهٔ مستقیم است؛ مسیریابی خیابانی و موقعیت زندهٔ
              راننده در این نسخه فعال نیست.
            </p>
          </details>
        </div>
        <footer className="ride-sheet-footer">
          {completed ? (
            <button className="primary wide" onClick={onNewTrip}>
              سفر جدید
              <ReceiptText size={19} />
            </button>
          ) : ["requested", "accepted"].includes(trip.state) ? (
            <>
              <button
                className="secondary wide"
                disabled={busy || !online}
                onClick={() => dialog.current?.showModal()}
              >
                لغو درخواست
              </button>
              <small>تا پیش از شروع سفر می‌توانی درخواست را لغو کنی.</small>
            </>
          ) : (
            <small>نسخهٔ آموزشی · بدون پرداخت واقعی</small>
          )}
        </footer>
      </section>
      <dialog
        ref={dialog}
        className="cancel-dialog"
        aria-labelledby="cancel-title"
      >
        <button
          className="icon-button dialog-close"
          onClick={() => dialog.current?.close()}
          aria-label="بستن پنجرهٔ لغو"
        >
          <X size={20} />
        </button>
        <h2 id="cancel-title">درخواست را لغو می‌کنی؟</h2>
        <p>
          با لغو، این درخواست بسته می‌شود. برای سفر بعدی باید دوباره درخواست
          بدهی.
        </p>
        <button
          autoFocus
          className="primary wide"
          onClick={() => dialog.current?.close()}
        >
          ادامهٔ سفر
        </button>
        <button
          className="text-button danger wide"
          disabled={busy || !online}
          onClick={() => {
            dialog.current?.close();
            act(() => api(`/requests/${trip.id}/cancel`, {}));
          }}
        >
          بله، لغو درخواست
        </button>
      </dialog>
    </div>
  );
}
