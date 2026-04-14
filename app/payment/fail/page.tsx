"use client";

import { useRouter } from "next/navigation";

export default function PaymentFail() {
  const router = useRouter();

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-100 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white shadow-xl p-8 text-center space-y-6">
        <span className="font-medium tracking-[0.18em] text-sm text-slate-600">LOOP BREAKER</span>
        <h1 className="text-2xl font-bold text-slate-900">결제가 완료되지 않았어요</h1>
        <p className="text-base text-slate-600">다시 시도하시거나<br />나중에 이어가셔도 괜찮아요</p>
        <button
          className="h-14 w-full rounded-2xl bg-slate-900 text-base text-white shadow-sm hover:bg-slate-800"
          onClick={() => router.back()}
        >
          돌아가기
        </button>
      </div>
    </div>
  );
}