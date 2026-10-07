import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpLeft,
  Check,
  FileCheck2,
  Plus,
  UserRound,
} from "lucide-react";
import { Me, money, serviceNames, stateNames, humanError, api } from "./lib";
import { Field, Busy, Empty } from "./ui";
export function StaffPage({
  me,
  tab,
  act,
  busy,
  online,
}: {
  me: Me;
  tab: string;
  act: (fn: () => Promise<any>) => void;
  busy: boolean;
  online: boolean;
}) {
  const [drivers, setDrivers] = useState<Record<string, any>[]>([]);
  const [selected, setSelected] = useState<Record<string, any> | null>(null);
  const [reason, setReason] = useState("");
  const [filter, setFilter] = useState("pending");
  const [reports, setReports] = useState<{ id: number; title: string }[]>([]);
  const [reportId, setReportId] = useState(1);
  const [report, setReport] = useState<{
    title: string;
    rows: Record<string, any>[];
  } | null>(null);
  const [error, setError] = useState("");
  async function refresh() {
    const result = await api<Record<string, any>[]>("/staff/drivers");
    setDrivers(result);
    setSelected((old) =>
      old ? (result.find((d) => d.id === old.id) ?? null) : null,
    );
  }
  useEffect(() => {
    if (tab === "home") refresh().catch((e) => setError(humanError(e.message)));
    if (tab === "reports")
      api("/staff/reports")
        .then(setReports)
        .catch((e) => setError(humanError(e.message)));
  }, [tab]);
  useEffect(() => {
    if (tab === "reports" && reports.length) {
      let valid = true;
      setReport(null);
      api(`/staff/reports/${reportId}`)
        .then((v) => {
          if (valid) setReport(v);
        })
        .catch((e) => {
          if (valid) setError(humanError(e.message));
        });
      return () => {
        valid = false;
      };
    }
  }, [tab, reportId, reports.length]);
  if (tab === "team")
    return (
      <div className="narrow">
        <div className="page-heading">
          <span className="eyebrow">همکاران بکسی</span>
          <h1>همکار جدید</h1>
          <p>حساب کارکنان را با دسترسی مشخص بسازید.</p>
        </div>
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const data = Object.fromEntries(f);
            act(async () => {
              const result = await api("/staff/employees", {
                ...data,
                salary: Number(data.salary),
              });
              window.alert(
                `حساب همکار ساخته شد. کد پرسنلی: ${money(result.code)}`,
              );
            });
          }}
        >
          <div className="form-grid">
            {[
              ["first_name", "نام"],
              ["last_name", "نام خانوادگی"],
              ["shaba", "شمارهٔ شبا"],
            ].map(([name, label]) => (
              <Field key={name} label={label}>
                <input
                  name={name}
                  required
                  maxLength={name === "shaba" ? 26 : 50}
                  dir={name === "shaba" ? "ltr" : undefined}
                />
              </Field>
            ))}
            <Field label="تاریخ تولد میلادی">
              <input
                type="date"
                name="birth"
                required
                defaultValue="1990-01-01"
              />
            </Field>
            <Field label="رمز عبور" hint="حداقل ۸ کاراکتر؛ مستقل از کد ملی">
              <input
                name="password"
                type="password"
                minLength={8}
                maxLength={128}
                required
                autoComplete="new-password"
              />
            </Field>
            <Field label="حقوق ماهانه، ریال">
              <input name="salary" type="number" min="0" required />
            </Field>
            <Field label="واحد">
              <select name="department">
                {[
                  ["support", "پشتیبانی"],
                  ["HR", "منابع انسانی"],
                  ["development", "توسعه"],
                  ["marketing", "بازاریابی"],
                  ["accounting", "حسابداری"],
                  ["finance", "مالی"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="سمت">
              <select name="position">
                <option value="basic employee">کارمند</option>
                <option value="department manager">مدیر واحد</option>
                <option value="programmer">برنامه‌نویس</option>
              </select>
            </Field>
            <Field label="سطح مهارت">
              <select name="proficiency">
                {[
                  ["basic", "پایه"],
                  ["intermediate", "متوسط"],
                  ["advanced", "پیشرفته"],
                  ["proficient", "مسلط"],
                  ["expert", "متخصص"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="تحصیلات">
              <input
                name="education"
                defaultValue="کارشناسی"
                maxLength={50}
                required
              />
            </Field>
          </div>
          <button className="primary" disabled={busy || !online}>
            ساخت حساب همکار
            <Plus size={18} />
          </button>
        </form>
      </div>
    );
  if (tab === "reports")
    return (
      <>
        <div className="page-heading">
          <span className="eyebrow">از داده تا دیدن</span>
          <h1>گزارش‌ها</h1>
          <p>۲۰ گزارش از سفرها، ناوگان و فعالیت بکسی</p>
        </div>
        <div className="panel">
          <Field label="انتخاب گزارش">
            <select
              value={reportId}
              onChange={(e) => setReportId(Number(e.target.value))}
            >
              {reports.map((r) => (
                <option value={r.id} key={r.id}>
                  {money(r.id)}. {r.title}
                </option>
              ))}
            </select>
          </Field>
          {error && <p className="inline-error">{error}</p>}
          {report ? (
            <>
              <h2>{report.title}</h2>
              {report.rows.length ? (
                <div
                  className="table-wrap"
                  tabIndex={0}
                  aria-label="جدول گزارش"
                >
                  <table>
                    <thead>
                      <tr>
                        {Object.keys(report.rows[0]).map((k) => (
                          <th key={k}>{columnName(k)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((r, i) => (
                        <tr key={i}>
                          {Object.entries(r).map(([k, v]) => (
                            <td key={k}>{displayValue(k, v)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="داده‌ای برای این گزارش نیست"
                  text="با ثبت فعالیت مرتبط، نتیجه اینجا نمایش داده می‌شود."
                />
              )}
            </>
          ) : (
            <div className="loading-line">
              <Busy />
              در حال دریافت گزارش
            </div>
          )}
        </div>
      </>
    );
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">اعتماد، از همین‌جا</span>
        <h1>بررسی رانندگان</h1>
        <p>مدارک را ببینید و نتیجهٔ بررسی را ثبت کنید.</p>
      </div>
      <div className="filter-row">
        {["pending", "approved", "rejected"].map((s) => (
          <button
            key={s}
            aria-pressed={filter === s}
            className={filter === s ? "filter active" : "filter"}
            onClick={() => {
              setFilter(s);
              setSelected(null);
            }}
          >
            {stateNames[s]}
            <span>
              {money(drivers.filter((d) => d.verification_status === s).length)}
            </span>
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      <div className="review-layout">
        <div>
          {drivers
            .filter((d) => d.verification_status === filter)
            .map((d) => (
              <button
                key={d.id}
                className={
                  "panel driver-row " +
                  (selected?.id === d.id ? "selected" : "")
                }
                onClick={() => {
                  setSelected(d);
                  setReason("");
                }}
              >
                <span className="avatar">
                  <UserRound size={22} />
                </span>
                <span>
                  <strong>
                    {d.first_name} {d.last_name}
                  </strong>
                  <small>راننده {money(d.id)}</small>
                </span>
                <ArrowLeft size={18} />
              </button>
            ))}
          {!drivers.filter((d) => d.verification_status === filter).length && (
            <Empty
              title="موردی برای بررسی نیست"
              text="رانندگان این گروه، اینجا نمایش داده می‌شوند."
              icon={FileCheck2}
            />
          )}
        </div>
        <section className="panel review-detail">
          {selected ? (
            <>
              <span className="eyebrow">پروندهٔ راننده</span>
              <h2>
                {selected.first_name} {selected.last_name}
              </h2>
              <span className={"status " + selected.verification_status}>
                {stateNames[selected.verification_status]}
              </span>
              <div className="document-previews">
                {[
                  ["national", "کارت ملی"],
                  ["license", "گواهینامه"],
                  ["judicial", "گواهی قضایی"],
                  ["vehicle", "کارت وسیله"],
                ].map(([kind, label]) => (
                  <a
                    key={kind}
                    href={`/api/documents/${selected.id}/${kind}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      src={`/api/documents/${selected.id}/${kind}`}
                      alt={label}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <span>
                      {label}
                      <ArrowUpLeft size={15} />
                    </span>
                  </a>
                ))}
              </div>
              {selected.verification_status === "pending" ? (
                <>
                  <Field label="دلیل رد، در صورت نیاز">
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={500}
                      rows={3}
                    />
                  </Field>
                  <div className="review-actions">
                    <button
                      className="primary"
                      disabled={busy || !online}
                      onClick={() =>
                        act(async () => {
                          await api(`/staff/drivers/${selected.id}/review`, {
                            approved: true,
                          });
                          await refresh();
                        })
                      }
                    >
                      تأیید راننده
                      <Check size={18} />
                    </button>
                    <button
                      className="secondary danger"
                      disabled={busy || !online || !reason.trim()}
                      onClick={() =>
                        act(async () => {
                          await api(`/staff/drivers/${selected.id}/review`, {
                            approved: false,
                            reason,
                          });
                          await refresh();
                        })
                      }
                    >
                      رد مدارک
                    </button>
                  </div>
                </>
              ) : (
                <p className="muted">
                  {selected.rejection_reason ||
                    "بررسی مدارک با موفقیت ثبت شده است."}
                </p>
              )}
            </>
          ) : (
            <Empty
              title="یک پرونده انتخاب کنید"
              text="مدارک و نتیجهٔ بررسی در این بخش قرار می‌گیرند."
              icon={FileCheck2}
            />
          )}
        </section>
      </div>
    </>
  );
}
export function columnName(key: string) {
  return (
    (
      {
        state: "وضعیت",
        requests: "درخواست",
        service_type: "سرویس",
        trips: "سفر",
        gross_irr: "درآمد ناخالص، ریال",
        net_irr: "سهم راننده، ریال",
        id: "شناسه",
        first_name: "نام",
        last_name: "نام خانوادگی",
        day: "روز",
        total: "کل",
        cancelled: "لغوشده",
        cancelled_percent: "درصد لغو",
        spent_irr: "هزینه، ریال",
        signup_time: "زمان ثبت‌نام",
        type: "نوع",
        transactions: "تراکنش",
        amount_irr: "مبلغ، ریال",
        client_id: "شناسهٔ مشتری",
        deposits: "واریز",
        deposited_irr: "واریز، ریال",
        driver_id: "شناسهٔ راننده",
        withdrawals: "برداشت",
        withdrawn_irr: "برداشت، ریال",
        service: "سرویس",
        vehicles: "وسیله",
        capacity: "ظرفیت",
        ratings: "امتیاز",
        average_rating: "میانگین امتیاز",
        average_seconds: "میانگین، ثانیه",
        department: "واحد",
        employees: "کارمند",
        salary_irr: "حقوق، ریال",
        reports: "گزارش",
        saved_addresses: "آدرس",
        month: "ماه",
        gross_income: "ناخالص، ریال",
        net_income: "خالص، ریال",
        active_requests: "درخواست فعال",
        referred_id: "معرفی‌شده",
        referrer_id: "معرف",
        depth: "سطح",
      } as Record<string, string>
    )[key] ?? key
  );
}
export function displayValue(key: string, value: unknown) {
  if (value == null) return "—";
  if (key === "state") return stateNames[String(value)] ?? String(value);
  if (key === "service_type" || key === "service")
    return serviceNames[String(value)] ?? String(value);
  if (typeof value === "number") return money(value);
  return String(value);
}
