import { FareLine, toman } from "./lib";

const labels: Record<string, string> = {
  base: "ورودی سرویس",
  distance: "هزینهٔ مسافت",
  minimum_topup: "تکمیل حداقل کرایه",
  weight: "اضافهٔ وزن بار",
  rounding: "تعدیل گردکردن",
  return: "مسیر برگشت",
};

export function FareDetails({
  breakdown,
  cost,
  version,
}: {
  breakdown?: FareLine[] | string | null;
  cost: number;
  version?: string;
}) {
  const lines: FareLine[] =
    typeof breakdown === "string" ? JSON.parse(breakdown) : (breakdown ?? []);
  return (
    <details className="fare-details">
      <summary>جزئیات قیمت</summary>
      {lines.length ? (
        <dl className="fare-lines">
          {lines
            .filter(
              (line) =>
                line.amount_irr !== 0 ||
                ["base", "distance"].includes(line.code),
            )
            .map((line) => (
              <div key={line.code}>
                <dt>{labels[line.code] ?? line.code}</dt>
                <dd>
                  <bdi>{toman(line.amount_irr)}</bdi> تومان
                </dd>
              </div>
            ))}
          <div className="fare-sum">
            <dt>مبلغ نهایی</dt>
            <dd>
              <bdi>{toman(cost)}</bdi> تومان
            </dd>
          </div>
        </dl>
      ) : (
        <p>برای این سفر قدیمی ریز محاسبه ثبت نشده است؛ مبلغ اصلی حفظ شده.</p>
      )}
      {version && (
        <p data-policy-version={version}>
          تعرفهٔ نمونه؛ این مبلغ پس از ثبت درخواست ثابت می‌ماند.
        </p>
      )}
    </details>
  );
}
