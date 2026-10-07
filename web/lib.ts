export type Role =
  "client" | "driver" | "staff" | "pending_client" | "pending_driver";
export type Me = {
  role: Role;
  account?: Record<string, any>;
  phone?: string;
  manager?: boolean;
  demo: boolean;
};
export type Trip = Record<string, any>;
export type Draft = {
  service: string;
  pickup: [number, number];
  dropoff: [number, number];
  round_trip: boolean;
  cargo_weight: number;
  cargo_value: number;
  cargo_type: string;
  client_helped: boolean;
  payment: "wallet-to-wallet" | "cash";
  pickup_label: string;
  dropoff_label: string;
};
export type BookingState = {
  draft: Draft;
  stage: "pickup" | "dropoff" | "ready";
  pickupConfirmed: boolean;
  dropoffConfirmed: boolean;
};
export const freshBooking = (): BookingState => ({
  draft: freshDraft(),
  stage: "pickup",
  pickupConfirmed: false,
  dropoffConfirmed: false,
});
export const money = (value: number) =>
  new Intl.NumberFormat("fa-IR").format(value);
export const serviceNames: Record<string, string> = {
  baxi: "بکسی",
  women: "بکسی بانوان",
  box: "بکسی باکس",
  baar: "بکسی بار",
};
export const stateNames: Record<string, string> = {
  requested: "در انتظار راننده",
  accepted: "راننده پذیرفته",
  in_progress: "در حال سفر",
  completed: "تکمیل‌شده",
  cancelled: "لغوشده",
  pending: "در انتظار بررسی",
  approved: "تأییدشده",
  rejected: "ردشده",
};
export const freshDraft = (): Draft => ({
  service: "baxi",
  pickup: [35.7005, 51.3376],
  dropoff: [35.7005, 51.3376],
  round_trip: false,
  cargo_weight: 5,
  cargo_value: 100000,
  cargo_type: "unfragile",
  client_helped: false,
  payment: "wallet-to-wallet",
  pickup_label: "نقطهٔ انتخاب‌شده روی نقشه",
  dropoff_label: "نقطهٔ انتخاب‌شده روی نقشه",
});

export function humanError(raw: string): string {
  const rules: [RegExp, string][] = [
    [
      /Insufficient wallet/i,
      "موجودی کیف پول کافی نیست؛ نقدی را انتخاب کن یا کیف پول را شارژ کن.",
    ],
    [/selected payment/i, "روش پرداخت باید همان انتخاب مسافر باشد."],
    [/Cargo weight|Cargo value/i, "وزن و ارزش بار را با عدد معتبر وارد کن."],
    [/within Tehran/i, "سرویس فقط در محدودهٔ شهر تهران فعال است."],
    [
      /Failed to fetch|NetworkError|Load failed/i,
      "ارتباط برقرار نشد. اتصال اینترنت را بررسی کنید.",
    ],
    [
      /No account|Account not found/i,
      "برای این شماره و نقش، حسابی پیدا نشد. ابتدا ثبت‌نام کنید.",
    ],
    [
      /already exists/i,
      "این حساب قبلاً ثبت شده است. گزینهٔ ورود را انتخاب کنید.",
    ],
    [/Incorrect personnel/i, "کد پرسنلی یا رمز عبور نادرست است."],
    [/valid Iranian/i, "شمارهٔ موبایل معتبر وارد کنید؛ مانند ۰۹۱۲۰۰۰۰۰۱۰."],
    [/Wait 30/i, "برای دریافت دوبارهٔ کد، ۳۰ ثانیه صبر کنید."],
    [
      /finish or cancel|current request/i,
      "ابتدا سفر فعلی را تمام یا لغو کنید.",
    ],
    [
      /no longer available/i,
      "این درخواست دیگر در دسترس نیست. فهرست را تازه کنید.",
    ],
    [/approved by staff|not approved/i, "حساب راننده هنوز تأیید نشده است."],
    [
      /cannot request|not eligible|cannot register/i,
      "این سرویس برای مشخصات حساب شما در دسترس نیست.",
    ],
    [/already been reviewed/i, "این راننده قبلاً بررسی شده است."],
    [
      /already recorded|cannot be rated/i,
      "امتیاز این سفر قبلاً ثبت شده یا سفر هنوز تمام نشده است.",
    ],
    [/more than 5 km/i, "مبدأ بیشتر از ۵ کیلومتر با موقعیت شما فاصله دارد."],
    [/capacity/i, "وزن بار باید معتبر و متناسب با ظرفیت وسیله باشد."],
    [/Rejection reason/i, "دلیل رد مدارک را وارد کنید."],
    [
      /Age must/i,
      "تاریخ تولد میلادی و سن مجاز را بررسی کنید. حداقل سن مسافر ۱۵ و راننده ۱۸ سال است.",
    ],
    [/IBAN/i, "شمارهٔ شبا باید IR و ۲۴ رقم باشد؛ کد ملی هم ۱۰ رقم است."],
    [
      /Coordinates|finite/i,
      "عرض جغرافیایی باید بین ۹۰− و ۹۰ و طول بین ۱۸۰− و ۱۸۰ باشد.",
    ],
    [/Pickup and destination/i, "مبدأ و مقصد نباید یکسان باشند."],
    [
      /document|Upload all/i,
      "هر چهار مدرک معتبر را بارگذاری کنید؛ PNG، JPEG یا PDF تا ۱۰ مگابایت.",
    ],
    [
      /No payment|requires demo|SMS delivery/i,
      "این قابلیت فقط در نسخهٔ آزمایشی در دسترس است.",
    ],
    [
      /requires an HR|Only HR/i,
      "برای این عملیات دسترسی منابع انسانی لازم است.",
    ],
  ];
  return (
    rules.find(([pattern]) => pattern.test(raw))?.[1] ??
    (/[\u0600-\u06ff]/.test(raw)
      ? raw
      : "عملیات انجام نشد. اطلاعات را بررسی و دوباره تلاش کنید.")
  );
}
export async function api<T = any>(path: string, data?: unknown): Promise<T> {
  if (!navigator.onLine) throw new Error("Failed to fetch");
  const multipart = data instanceof FormData;
  const response = await fetch("/api" + path, {
    method: data === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers:
      data === undefined
        ? {}
        : multipart
          ? { "X-Baxi-Request": "1" }
          : { "Content-Type": "application/json", "X-Baxi-Request": "1" },
    body:
      data === undefined ? undefined : multipart ? data : JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      typeof result.detail === "string"
        ? result.detail
        : "اطلاعات واردشده معتبر نیست. فیلدها را بررسی کنید.",
    );
  return result;
}
