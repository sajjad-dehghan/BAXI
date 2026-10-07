import React, { useEffect, useRef, useState } from "react";
import {
  CarFront,
  CheckCircle2,
  Download,
  FileCheck2,
  History,
  LogOut,
  UserRound,
  UsersRound,
  Wallet,
  WifiOff,
  X,
} from "lucide-react";
import {
  Me,
  Trip,
  stateNames,
  humanError,
  api,
  freshBooking,
} from "../shared/lib/client";
import { Busy, Brand, Empty } from "../shared/ui/ui";
import { Auth } from "../features/auth/Auth";
import { Register } from "../features/auth/Register";
import { NewTrip } from "../features/booking/NewTrip";
import { PassengerJourney } from "../features/trips/PassengerJourney";
import { TripCard } from "../shared/ui/TripCard";
import { DriverHome } from "../features/driver/DriverHome";
import { WalletPage } from "../features/wallet/WalletPage";
import { StaffPage } from "../features/staff/StaffPage";
import { createRoot } from "react-dom/client";
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/500.css";
import "@fontsource/vazirmatn/600.css";
import "@fontsource/vazirmatn/700.css";
import "./styles.css";
function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [tab, setTab] = useState("home");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [booking, setBooking] = useState(freshBooking);
  const [receiptId, setReceiptId] = useState<number | null>(null);
  const previousTrip = useRef<number | null>(null);
  const [install, setInstall] = useState<any>(null);
  const [installHelp, setInstallHelp] = useState(false);
  const lock = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (installHelp) dialog.current?.showModal();
  }, [installHelp]);
  async function refresh() {
    const current = await api<Me>("/me");
    setMe(current);
    if (current.role === "client" || current.role === "driver")
      setTrips(await api("/history"));
  }
  useEffect(() => {
    api<Me>("/me")
      .then(async (value) => {
        setMe(value);
        if (value.role === "client" || value.role === "driver")
          setTrips(await api("/history"));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    const on = () => setOnline(true),
      off = () => setOnline(false),
      prompt = (e: Event) => {
        e.preventDefault();
        setInstall(e);
      };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("beforeinstallprompt", prompt);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("beforeinstallprompt", prompt);
    };
  }, []);
  useEffect(() => {
    if (!online || !me || !["client", "driver"].includes(me.role)) return;
    const timer = setInterval(() => {
      if (!lock.current) refresh().catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [online, me?.role]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  function run(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    Promise.resolve()
      .then(fn)
      .catch((e) => setError(humanError(e.message)))
      .finally(() => {
        lock.current = false;
        setBusy(false);
      });
  }
  function act(fn: () => Promise<any>) {
    run(async () => {
      await fn();
      await refresh();
      setToast("با موفقیت ثبت شد.");
    });
  }
  async function logout() {
    await api("/auth/logout", {});
    setMe(null);
    setTrips([]);
    setBooking(freshBooking());
    setReceiptId(null);
    previousTrip.current = null;
    setTab("home");
    setToast("");
  }
  const nav =
    me?.role === "staff"
      ? [
          { id: "home", label: "بررسی رانندگان", icon: FileCheck2 },
          ...(me.manager
            ? [
                { id: "reports", label: "گزارش‌ها", icon: History },
                { id: "team", label: "همکار جدید", icon: UsersRound },
              ]
            : []),
        ]
      : [
          {
            id: "home",
            label:
              me?.role === "driver"
                ? "درخواست‌ها"
                : trips.some((trip) =>
                      ["requested", "accepted", "in_progress"].includes(
                        trip.state,
                      ),
                    )
                  ? "سفر فعلی"
                  : "سفر جدید",
            icon: CarFront,
          },
          { id: "history", label: "سفرهای من", icon: History },
          { id: "wallet", label: "کیف پول", icon: Wallet },
          { id: "account", label: "حساب من", icon: UserRound },
        ];
  const active = trips.find((t) =>
    ["requested", "accepted", "in_progress"].includes(t.state),
  );
  const receipt = trips.find(
    (trip) => trip.id === receiptId && trip.state === "completed",
  );
  const riderHome = me?.role === "client" && tab === "home";
  useEffect(() => {
    if (me?.role !== "client") return;
    if (active) {
      if (previousTrip.current !== active.id) {
        setBooking(freshBooking());
        setReceiptId(null);
      }
      previousTrip.current = active.id;
    } else if (previousTrip.current !== null) {
      const finished = trips.find((trip) => trip.id === previousTrip.current);
      if (finished?.state === "completed") setReceiptId(finished.id);
      previousTrip.current = null;
    }
  }, [trips, me?.role]);
  if (loading)
    return (
      <div className="initial-loading">
        <Brand />
        <Busy />
        <p>یک لحظه تا شروع…</p>
      </div>
    );
  return (
    <>
      {!online && (
        <div className="offline-banner" role="status">
          <WifiOff size={17} />
          آفلاین هستید. برای ثبت درخواست و دریافت اطلاعات تازه، دوباره متصل
          شوید.
        </div>
      )}
      {error && (
        <div className="alert" role="alert">
          <span>{error}</span>
          <button
            className="icon-button"
            onClick={() => setError("")}
            aria-label="بستن پیام خطا"
          >
            <X size={18} />
          </button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {toast}
        </div>
      )}
      {!me ? (
        <Auth onReady={refresh} run={run} busy={busy} online={online} />
      ) : me.role.startsWith("pending_") ? (
        <div className="register-shell">
          <Brand />
          <Register
            me={me}
            onReady={refresh}
            run={run}
            busy={busy}
            online={online}
          />
          <button
            className="text-button"
            disabled={busy || !online}
            onClick={() => run(logout)}
          >
            بازگشت به ورود
          </button>
        </div>
      ) : (
        <div className={"app-shell " + (riderHome ? "rider-home" : "")}>
          <aside className="sidebar">
            <Brand />
            <nav aria-label="ناوبری اصلی">
              {nav.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  aria-current={tab === id ? "page" : undefined}
                  className={tab === id ? "nav-item active" : "nav-item"}
                  onClick={() => {
                    setTab(id);
                    if (id === "home" && me.role === "client" && !active)
                      setReceiptId(null);
                    setError("");
                  }}
                >
                  <Icon size={21} />
                  <span>{label}</span>
                  {tab === id && <span className="nav-indicator" />}
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <div className="demo-label">
                <span className="dot purple" />
                نسخهٔ آزمایشی
              </div>
              <button
                className="nav-item"
                onClick={() => {
                  if (install) {
                    install.prompt();
                    setInstall(null);
                  } else setInstallHelp(true);
                }}
              >
                <Download size={20} />
                <span>نصب بکسی</span>
              </button>
              <button
                className="nav-item"
                disabled={busy || !online}
                onClick={() => run(logout)}
              >
                <LogOut size={20} />
                <span>خروج از حساب</span>
              </button>
            </div>
          </aside>
          <div className="app-body">
            <header className="topbar">
              <div className="mobile-brand">
                <Brand />
              </div>
              <span className="topbar-greeting">
                {me.role === "staff" ? "پنل همکاران" : "همراه هر مسیر"}
              </span>
              <div className="account-chip">
                <span className="avatar">
                  <UserRound size={18} />
                </span>
                <span>
                  {me.account?.first_name} {me.account?.last_name}
                  <small>
                    {me.role === "client"
                      ? "مسافر"
                      : me.role === "driver"
                        ? "راننده"
                        : me.manager
                          ? "مدیر منابع انسانی"
                          : "کارشناس"}
                  </small>
                </span>
                {me.role === "staff" && (
                  <button
                    className="icon-button mobile-logout"
                    disabled={busy || !online}
                    onClick={() => run(logout)}
                    aria-label="خروج از حساب"
                  >
                    <LogOut size={19} />
                  </button>
                )}
              </div>
            </header>
            <main
              className={"workspace " + (riderHome ? "rider-workspace" : "")}
              id="main-content"
            >
              {me.role === "staff" ? (
                <StaffPage
                  me={me}
                  tab={tab}
                  act={act}
                  busy={busy}
                  online={online}
                />
              ) : tab === "home" ? (
                me.role === "driver" ? (
                  <DriverHome
                    me={me}
                    history={trips}
                    act={act}
                    busy={busy}
                    online={online}
                  />
                ) : active || receipt ? (
                  <PassengerJourney
                    trip={(active || receipt)!}
                    act={act}
                    busy={busy}
                    online={online}
                    onNewTrip={() => {
                      setReceiptId(null);
                      setBooking(freshBooking());
                    }}
                  />
                ) : (
                  <NewTrip
                    me={me}
                    act={act}
                    busy={busy}
                    online={online}
                    booking={booking}
                    setBooking={setBooking}
                    history={trips}
                    onWallet={() => setTab("wallet")}
                  />
                )
              ) : tab === "history" ? (
                <>
                  <div className="page-heading">
                    <span className="eyebrow">مسیرهایی که رفتیم</span>
                    <h1>سفرهای من</h1>
                    <p>از اولین درخواست تا آخرین رسیدن</p>
                  </div>
                  {trips.length ? (
                    <div className="trip-grid">
                      {trips.map((t) => (
                        <TripCard
                          key={t.id}
                          trip={t}
                          role={me.role}
                          act={act}
                          busy={busy}
                          online={online}
                        />
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title="اولین سفرت در راهه"
                      text="بعد از ثبت درخواست، جزئیات سفر اینجا نمایش داده می‌شود."
                    />
                  )}
                </>
              ) : tab === "wallet" ? (
                <WalletPage me={me} act={act} busy={busy} online={online} />
              ) : (
                <div className="narrow">
                  <div className="page-heading">
                    <span className="eyebrow">شما در بکسی</span>
                    <h1>حساب من</h1>
                  </div>
                  <div className="panel profile-panel">
                    <span className="avatar large">
                      <UserRound size={36} />
                    </span>
                    <h2>
                      {me.account?.first_name} {me.account?.last_name}
                    </h2>
                    <p>
                      <bdi>۰{me.account?.phone_number}</bdi>
                    </p>
                    {me.role === "driver" && (
                      <span
                        className={"status " + me.account?.verification_status}
                      >
                        {stateNames[me.account?.verification_status]}
                      </span>
                    )}
                    <button
                      className="secondary"
                      onClick={() => setInstallHelp(true)}
                    >
                      <Download size={18} />
                      نصب روی دستگاه
                    </button>
                    <button
                      className="text-button danger"
                      disabled={busy || !online}
                      onClick={() => run(logout)}
                    >
                      خروج از حساب
                    </button>
                  </div>
                </div>
              )}
            </main>
            <footer className="workspace-footer">
              <span>بکسی · از اینجا تا اونجا</span>
              <span>نمونهٔ آموزشی · بدون پرداخت واقعی</span>
            </footer>
          </div>
          <nav className="mobile-nav" aria-label="ناوبری موبایل">
            {nav.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                aria-current={tab === id ? "page" : undefined}
                onClick={() => {
                  setTab(id);
                  if (id === "home" && me.role === "client" && !active)
                    setReceiptId(null);
                }}
                className={tab === id ? "active" : ""}
              >
                <Icon size={21} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
      )}
      {installHelp && (
        <dialog
          ref={dialog}
          className="install-dialog"
          aria-labelledby="install-title"
          onClose={() => setInstallHelp(false)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setInstallHelp(false);
          }}
        >
          <section className="panel modal">
            <button
              className="icon-button modal-close"
              aria-label="بستن راهنمای نصب"
              onClick={() => setInstallHelp(false)}
            >
              <X size={20} />
            </button>
            <Download size={30} />
            <h2 id="install-title">بکسی، روی دستگاه شما</h2>
            <p>
              در Chrome یا Edge، از منوی مرورگر «نصب برنامه» را انتخاب کنید.
            </p>
            <p>
              در iPhone، این صفحه را در Safari باز کنید؛ از منوی اشتراک‌گذاری،
              «Add to Home Screen» را بزنید.
            </p>
            <button
              className="primary wide"
              onClick={() => setInstallHelp(false)}
            >
              متوجه شدم
            </button>
          </section>
        </dialog>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(() => {}),
  );
}
