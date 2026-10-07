import { useEffect, useRef, useState } from "react";
import { Plus, Wallet } from "lucide-react";
import { Me, money, api } from "./lib";
import { Field, Busy, Empty } from "./ui";
export function WalletPage({
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
  const [amount, setAmount] = useState("100000");
  const pending = useRef<{ amount: number; key: string } | null>(null);
  const [transactions, setTransactions] = useState<Record<string, any>[]>([]);
  useEffect(() => {
    api("/wallet")
      .then(setTransactions)
      .catch(() => {});
  }, [me.account?.wallet_balance]);
  return (
    <div className="narrow">
      <div className="page-heading">
        <span className="eyebrow">همه‌چیز روشن</span>
        <h1>کیف پول</h1>
        <p>موجودی و تراکنش‌های حساب شما</p>
      </div>
      <div className="wallet-card">
        <Wallet size={26} />
        <span>موجودی فعلی</span>
        <strong>
          {money(me.account?.wallet_balance ?? 0)}
          <small>ریال</small>
        </strong>
        <span className="wallet-caption">حساب آزمایشی بکسی</span>
      </div>
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          const value = Number(amount);
          if (!pending.current || pending.current.amount !== value) {
            pending.current = {
              amount: value,
              key: crypto.randomUUID().replaceAll("-", ""),
            };
          }
          const transfer = pending.current;
          act(async () => {
            await api("/wallet/demo", transfer);
            pending.current = null;
          });
        }}
      >
        <h2>{me.role === "client" ? "افزایش موجودی" : "برداشت از کیف پول"}</h2>
        <Field label="مبلغ، ریال">
          <input
            type="number"
            min="1"
            max="1000000000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </Field>
        <button className="primary wide" disabled={busy || !online || !me.demo}>
          {busy ? (
            <Busy />
          ) : me.role === "client" ? (
            "شارژ آزمایشی"
          ) : (
            "برداشت آزمایشی"
          )}
          <Plus size={18} />
        </button>
        <p className="muted small">
          این عملیات شبیه‌سازی است؛ هیچ پول واقعی دریافت یا پرداخت نمی‌شود.
        </p>
      </form>
      <div className="section-title">
        <h2>تراکنش‌های اخیر</h2>
      </div>
      {transactions.length ? (
        <div className="panel transaction-list">
          {transactions.map((t) => (
            <div key={t.tracking_code}>
              <span>
                <strong>
                  {t.type === "card-to-wallet" ? "شارژ کیف پول" : "برداشت"}
                </strong>
                <small>{new Date(t.time).toLocaleDateString("fa-IR")}</small>
              </span>
              <bdi>{money(t.amount)} ریال</bdi>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="هنوز تراکنشی ثبت نشده"
          text="شارژ و برداشت‌های آزمایشی اینجا نمایش داده می‌شوند."
          icon={Wallet}
        />
      )}
    </div>
  );
}
