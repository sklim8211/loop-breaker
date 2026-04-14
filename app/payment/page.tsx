"use client";

import { useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function PaymentContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("uid");
  const paymentWidgetRef = useRef<any>(null);

  useEffect(() => {
    if (!userId) return;

    const script = document.createElement("script");
    script.src = "https://js.tosspayments.com/v1/payment-widget";
    script.onload = async () => {
      const clientKey = process.env.NEXT_PUBLIC_TOSSPAYMENTS_CLIENT_KEY!;
      const paymentWidget = (window as any).PaymentWidget(clientKey, (window as any).PaymentWidget.ANONYMOUS);
      paymentWidgetRef.current = paymentWidget;

      await paymentWidget.renderPaymentMethods(
        "#payment-widget",
        { value: 2900 },
        { variantKey: "DEFAULT" }
      );
    };
    document.head.appendChild(script);
  }, [userId]);

  const handlePayment = async () => {
    const paymentWidget = paymentWidgetRef.current;
    if (!paymentWidget) return;

    await paymentWidget.requestPayment({
      orderId: `order_${Date.now()}`,
      orderName: "루프브레이커 월 구독",
      successUrl: `${window.location.origin}/payment/success?uid=${userId}`,
      failUrl: `${window.location.origin}/payment/fail`,
      customerName: "사용자",
    });
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-100 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white shadow-xl p-8">
        <div className="mb-6">
          <span className="font-medium tracking-[0.18em] text-sm text-slate-600">LOOP BREAKER</span>
        </div>

        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">이어가기로 하셨군요</h1>
            <p className="text-base text-slate-600">월 2,900원으로 계속 받아보실 수 있어요</p>
          </div>

          <div id="payment-widget" className="w-full" />

          <button
            className="h-14 w-full rounded-2xl bg-slate-900 text-base text-white shadow-sm hover:bg-slate-800"
            onClick={handlePayment}
          >
            결제하기
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">불러오는 중…</div>}>
      <PaymentContent />
    </Suspense>
  );
}