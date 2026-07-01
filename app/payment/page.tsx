"use client";
import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function PaymentContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("uid");
  const router = useRouter();

  useEffect(() => {
    if (userId) {
      router.replace(`/?auto=1&uid=${userId}`);
    } else {
      router.replace("/");
    }
  }, [userId, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      불러오는 중…
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
