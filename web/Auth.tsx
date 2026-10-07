import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpLeft,
  CarFront,
  Package,
  ShieldCheck,
} from "lucide-react";
import { freshDraft, api } from "./lib";
import { Field, Busy, Brand, RouteSketch } from "./ui";
export function Auth({
  onReady,
  run,
  busy,
  online,
}: {
  onReady: () => Promise<void>;
  run: (fn: () => Promise<void>) => void;
  busy: boolean;
  online: boolean;
}) {
  const [role, setRole] = useState<"client" | "driver" | "staff">("client");
  const [signup, setSignup] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const [sent, setSent] = useState(false);
  const [staffCode, setStaffCode] = useState("");
  const [password, setPassword] = useState("");
  async function send() {
    const result = await api("/auth/code", { phone });
    setDemoCode(result.demo_code);
    setSent(true);
  }
  async function verify() {
    await api("/auth/verify", { phone, code, role, signup });
    await onReady();
  }
  async function demo() {
    if (role === "staff") {
      await api("/auth/staff", { code: 9001, password: "BaxiDemo!2026" });
    } else {
      const number = role === "client" ? "09120000010" : "09120000030";
      const result = await api("/auth/code", { phone: number });
      await api("/auth/verify", {
        phone: number,
        code: result.demo_code,
        role,
      });
    }
    await onReady();
  }
  return (
    <main className="auth-layout">
      <section className="auth-main">
        <Brand />
        <div className="auth-copy">
          <span className="eyebrow">خوش اومدی به بکسی</span>
          <h1>
            سفر بعدی،
            <br />
            <em>ساده‌تر.</em>
          </h1>
          <p>
            برای رفتن، رسیدن و رساندن.
            <br />
            همه‌چیز از یک مسیر شروع می‌شه.
          </p>
        </div>
        <div className="auth-card">
          <div className="segmented" aria-label="نوع حساب">
            {(
              [
                ["client", "مسافر"],
                ["driver", "راننده"],
                ["staff", "همکاران"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={role === value}
                onClick={() => {
                  setRole(value);
                  setSent(false);
                  setSignup(false);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                if (role === "staff") {
                  await api("/auth/staff", {
                    code: Number(staffCode),
                    password,
                  });
                  await onReady();
                } else if (sent) {
                  await verify();
                } else {
                  await send();
                }
              });
            }}
          >
            {role === "staff" ? (
              <>
                <Field label="کد پرسنلی">
                  <input
                    inputMode="numeric"
                    required
                    value={staffCode}
                    onChange={(e) => setStaffCode(e.target.value)}
                    dir="ltr"
                    autoComplete="username"
                  />
                </Field>
                <Field label="رمز عبور">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </Field>
              </>
            ) : (
              <>
                {!sent ? (
                  <Field label="شمارهٔ موبایل">
                    <input
                      placeholder="۰۹۱۲ ۰۰۰ ۰۰ ۱۰"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      dir="ltr"
                    />
                  </Field>
                ) : (
                  <>
                    <div className="code-info">
                      کد تأیید شمارهٔ <bdi>{phone}</bdi>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setSent(false)}
                      >
                        ویرایش
                      </button>
                    </div>
                    <Field label="کد تأیید شش‌رقمی">
                      <input
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        required
                        maxLength={6}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        dir="ltr"
                        autoFocus
                      />
                    </Field>
                    <p className="demo-code">
                      کد آزمایشی: <bdi>{demoCode}</bdi> · اعتبار دو دقیقه
                    </p>
                  </>
                )}
              </>
            )}
            <button className="primary wide" disabled={busy || !online}>
              {busy ? (
                <Busy />
              ) : role === "staff" ? (
                "ورود به پنل"
              ) : sent ? (
                "تأیید و ادامه"
              ) : signup ? (
                "شروع ثبت‌نام"
              ) : (
                "دریافت کد ورود"
              )}
              <ArrowLeft size={18} />
            </button>
          </form>
          {role !== "staff" && (
            <button
              type="button"
              className="text-button center"
              onClick={() => {
                setSignup(!signup);
                setSent(false);
              }}
            >
              {signup ? "حساب داری؟ ورود" : "تازه اومدی؟ ساخت حساب"}
            </button>
          )}
          <div className="demo-entry">
            <span>فقط می‌خوای امتحانش کنی؟</span>
            <button
              className="secondary"
              disabled={busy || !online}
              onClick={() => run(demo)}
            >
              ورود با حساب نمونه
              <ArrowUpLeft size={16} />
            </button>
          </div>
        </div>
        <p className="auth-foot">
          پروژهٔ آموزشی دانشگاه بوعلی سینا · نسخهٔ آزمایشی
        </p>
      </section>
      <aside className="auth-visual">
        <RouteSketch draft={freshDraft()} />
        <div className="visual-services">
          <span>
            <CarFront />
            سفر شهری
          </span>
          <span>
            <ShieldCheck />
            سرویس بانوان
          </span>
          <span>
            <Package />
            بسته و بار
          </span>
        </div>
        <span className="visual-number">۰۱ / یک شروع تازه</span>
      </aside>
    </main>
  );
}
