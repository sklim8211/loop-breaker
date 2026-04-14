"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const userId = searchParams.get("uid");
  const paymentKey = searchParams.get("paymentKey");
  const orderId = searchParams.get("orderId");
  const amount = searchParams.get("amount");

  useEffect(() => {
    if (!paymentKey || !orderId || !amount || !userId) return;

    const confirm = async () => {
      const res = await fetch("/api/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentKey,
          orderId,
          amount: Number(amount),
          userId,
        }),
      });

      if (res.ok) {
        setTimeout(() => {
          router.push(`/?uid=${userId}`);
        }, 2000);
      }
    };

    confirm();
  }, [paymentKey, orderId, amount, userId, router]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-100 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white shadow-xl p-8 text-center space-y-4">
        <span className="font-medium tracking-[0.18em] text-sm text-slate-600">LOOP BREAKER</span>
        <h1 className="text-2xl font-bold text-slate-900">이어가기로 하셨군요</h1>
        <p className="text-base text-slate-600">내일부터 다시 찾아뵐게요.<br />멈추는 순간, 계속 함께할게요.</p>
      </div>
    </div>
  );
}

export default function PaymentSuccess() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">불러오는 중…</div>}>
      <PaymentSuccessContent />
    </Suspense>
  );
}