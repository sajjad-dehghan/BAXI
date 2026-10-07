import { useState } from "react";
import { ArrowLeft, CarFront, Check, Star } from "lucide-react";
import { Role, Trip, money, serviceNames, stateNames, api } from "./lib";
import { Field } from "./ui";
export function TripCard({
  trip,
  role,
  act,
  busy,
  online,
}: {
  trip: Trip;
  role: Role;
  act: (fn: () => Promise<any>) => void;
  busy: boolean;
  online: boolean;
}) {
  const [rating, setRating] = useState(5);
  const [payment, setPayment] = useState("wallet-to-wallet");
  const paymentForTrip = trip.preferred_payment || payment;
  const active = ["requested", "accepted", "in_progress"].includes(trip.state);
  return (
    <article className={"panel trip-card " + (active ? "active-trip" : "")}>
      <div className="trip-card-top">
        <span className="trip-icon">
          <CarFront size={22} />
        </span>
        <div>
          <h3>{serviceNames[trip.service_type]}</h3>
          <span className="muted">
            سفر {money(trip.id)} ·{" "}
            {new Date(trip.request_time).toLocaleDateString("fa-IR")}
          </span>
        </div>
        <span className={"status " + trip.state}>{stateNames[trip.state]}</span>
      </div>
      <div className="trip-route">
        <div>
          <span className="dot purple" />
          <span>مبدأ · {trip.pickup_label || "نقطهٔ روی نقشه"}</span>
          <bdi>
            {Number(trip.pickup_latitude).toFixed(4)},{" "}
            {Number(trip.pickup_longitude).toFixed(4)}
          </bdi>
        </div>
        <div>
          <span className="dot dark" />
          <span>مقصد · {trip.dropoff_label || "نقطهٔ روی نقشه"}</span>
          <bdi>
            {Number(trip.dropoff_latitude).toFixed(4)},{" "}
            {Number(trip.dropoff_longitude).toFixed(4)}
          </bdi>
        </div>
      </div>
      <div className="trip-cost">
        <span>
          {role === "driver"
            ? `${trip.client_first_name} ${trip.client_last_name}`
            : "هزینهٔ سفر"}
        </span>
        <strong>
          {money(trip.cost)} <small>ریال</small>
        </strong>
      </div>
      {role === "client" && ["requested", "accepted"].includes(trip.state) && (
        <button
          className="secondary danger"
          disabled={busy || !online}
          onClick={() => {
            if (window.confirm("این درخواست لغو شود؟"))
              act(() => api(`/requests/${trip.id}/cancel`, {}));
          }}
        >
          لغو درخواست
        </button>
      )}
      {role === "driver" && trip.state === "requested" && (
        <button
          className="primary wide"
          disabled={busy || !online}
          onClick={() => act(() => api(`/requests/${trip.id}/accept`, {}))}
        >
          پذیرش درخواست
          <Check size={18} />
        </button>
      )}
      {role === "driver" && trip.state === "accepted" && (
        <button
          className="primary wide"
          disabled={busy || !online}
          onClick={() => act(() => api(`/requests/${trip.id}/start`, {}))}
        >
          شروع سفر
          <ArrowLeft size={18} />
        </button>
      )}
      {role === "driver" && trip.state === "in_progress" && (
        <div className="trip-actions">
          {trip.preferred_payment ? (
            <p className="muted">
              پرداخت انتخاب‌شدهٔ مسافر:{" "}
              <strong>
                {trip.preferred_payment === "cash" ? "نقدی" : "کیف پول"}
              </strong>
            </p>
          ) : (
            <Field label="روش پرداخت">
              <select
                value={payment}
                onChange={(e) => setPayment(e.target.value)}
              >
                <option value="wallet-to-wallet">کیف پول مسافر</option>
                <option value="cash">نقدی · ثبت آزمایشی</option>
              </select>
            </Field>
          )}
          <button
            className="primary"
            disabled={busy || !online}
            onClick={() =>
              act(() =>
                api(`/requests/${trip.id}/complete`, {
                  payment: paymentForTrip,
                }),
              )
            }
          >
            پایان سفر و تسویه
          </button>
        </div>
      )}
      {trip.state === "completed" && (
        <div className="rating-row">
          {(role === "client" ? trip.driver_rating : trip.client_rating) ==
          null ? (
            <>
              <Field
                label={
                  role === "client" ? "امتیاز به راننده" : "امتیاز به مسافر"
                }
              >
                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                >
                  {[5, 4, 3, 2, 1, 0].map((v) => (
                    <option key={v} value={v}>
                      {money(v)} ستاره
                    </option>
                  ))}
                </select>
              </Field>
              <button
                className="secondary"
                disabled={busy || !online}
                onClick={() =>
                  act(() => api(`/requests/${trip.id}/rating`, { rating }))
                }
              >
                ثبت امتیاز
                <Star size={15} />
              </button>
            </>
          ) : (
            <span className="rated">
              <Star size={16} />
              امتیاز شما:{" "}
              {money(
                role === "client" ? trip.driver_rating : trip.client_rating,
              )}
            </span>
          )}
        </div>
      )}
    </article>
  );
}
