import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Me, serviceNames, api } from "../../shared/lib/client";
import { Field, Busy } from "../../shared/ui/ui";
export function Register({
  me,
  onReady,
  run,
  busy,
  online,
}: {
  me: Me;
  onReady: () => Promise<void>;
  run: (fn: () => Promise<void>) => void;
  busy: boolean;
  online: boolean;
}) {
  const driver = me.role === "pending_driver";
  const [docs, setDocs] = useState<Record<string, string>>({});
  const [service, setService] = useState("baxi");
  const [sex, setSex] = useState("M");
  async function submit(form: HTMLFormElement) {
    const f = new FormData(form);
    await api("/register", {
      first_name: f.get("first_name"),
      last_name: f.get("last_name"),
      birth: f.get("birth"),
      sex,
      ...(driver
        ? {
            shaba: f.get("shaba"),
            national_code: f.get("national_code"),
            service,
            documents: docs,
            vehicle: {
              name: f.get("vehicle_name"),
              color: f.get("vehicle_color"),
              plate: f.get("plate"),
              capacity: f.get("capacity"),
              year: f.get("year"),
              fuel: f.get("fuel"),
            },
          }
        : {}),
    });
    await onReady();
  }
  return (
    <section className="registration panel">
      <span className="eyebrow">یک قدم تا شروع</span>
      <h1>{driver ? "مشخصات راننده" : "حساب جدید شما"}</h1>
      <p className="muted">
        شمارهٔ تأییدشده: <bdi>۰{me.phone}</bdi>
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          run(() => submit(form));
        }}
      >
        <div className="form-grid">
          <Field label="نام">
            <input
              name="first_name"
              required
              maxLength={50}
              autoComplete="given-name"
            />
          </Field>
          <Field label="نام خانوادگی">
            <input
              name="last_name"
              required
              maxLength={50}
              autoComplete="family-name"
            />
          </Field>
          <Field
            label="تاریخ تولد میلادی"
            hint={driver ? "حداقل سن ۱۸ سال" : "حداقل سن ۱۵ سال"}
          >
            <input
              type="date"
              name="birth"
              required
              dir="ltr"
              defaultValue="1995-05-23"
            />
          </Field>
          <Field label="جنسیت">
            <select value={sex} onChange={(e) => setSex(e.target.value)}>
              <option value="M">مرد</option>
              <option value="F">زن</option>
            </select>
          </Field>
        </div>
        {driver && (
          <>
            <h2>وسیله و مدارک</h2>
            <div className="form-grid">
              <Field label="نوع سرویس">
                <select
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                >
                  {Object.entries(serviceNames)
                    .filter(([v]) => v !== "women" || sex === "F")
                    .map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="نام وسیله">
                <input name="vehicle_name" required maxLength={50} />
              </Field>
              <Field label="رنگ">
                <input name="vehicle_color" required maxLength={50} />
              </Field>
              <Field label="پلاک">
                <input name="plate" required maxLength={20} />
              </Field>
              <Field
                label={
                  service === "box" || service === "baar"
                    ? "ظرفیت بار، کیلوگرم"
                    : "ظرفیت مسافر"
                }
              >
                <input
                  name="capacity"
                  type="number"
                  min="1"
                  max="100000"
                  required
                  defaultValue="4"
                />
              </Field>
              <Field label="سال تولید میلادی">
                <input
                  name="year"
                  type="number"
                  min="1950"
                  max={new Date().getFullYear() + 1}
                  required
                  defaultValue="2020"
                />
              </Field>
              <Field label="سوخت">
                <select name="fuel">
                  <option value="gasoline">بنزین</option>
                  <option value="CNG">گاز</option>
                  <option value="dual">دوگانه</option>
                  <option value="electricity">برقی</option>
                </select>
              </Field>
              <Field label="کد ملی">
                <input
                  name="national_code"
                  pattern="[0-9]{10}"
                  required
                  inputMode="numeric"
                  dir="ltr"
                />
              </Field>
              <Field label="شمارهٔ شبا">
                <input
                  name="shaba"
                  pattern="IR[0-9]{24}"
                  placeholder="IR…"
                  required
                  dir="ltr"
                />
              </Field>
            </div>
            <div className="document-inputs">
              {Object.entries({
                national: "کارت ملی",
                license: "گواهینامه",
                judicial: "گواهی قضایی",
                vehicle: "کارت وسیله",
              }).map(([kind, label]) => (
                <Field key={kind} label={label}>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file)
                        run(async () => {
                          const form = new FormData();
                          form.append("file", file);
                          const result = await api("/documents", form);
                          setDocs((old) => ({ ...old, [kind]: result.path }));
                        });
                    }}
                  />
                  {docs[kind] && (
                    <small className="success-text">مدرک آماده است</small>
                  )}
                </Field>
              ))}
            </div>
            {me.demo && (
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setDocs(
                    Object.fromEntries(
                      ["national", "license", "judicial", "vehicle"].map(
                        (k) => [k, `assets/demo-documents/${k}.svg`],
                      ),
                    ),
                  )
                }
              >
                استفاده از مدارک ساختگی دمو
              </button>
            )}
            <p className="muted">
              حساب راننده پس از بررسی مدارک توسط همکاران فعال می‌شود.
            </p>
          </>
        )}
        <button
          className="primary"
          disabled={
            busy || !online || (driver && Object.keys(docs).length !== 4)
          }
        >
          {busy ? <Busy /> : "ساخت حساب"}
          <ArrowLeft size={18} />
        </button>
      </form>
    </section>
  );
}
