import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import crypto from "crypto";

function getSignature(apiSecret: string, date: string, salt: string) {
  return crypto
    .createHmac("sha256", apiSecret)
    .update(date + salt)
    .digest("hex");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 문자 알림 동의한 사용자 중 텔레그램 미연결 사용자만
  const { data: users, error } = await supabase
    .from("users")
    .select("id, phone_number, telegram_chat_id, sms_consent")
    .eq("sms_consent", true)
    .is("telegram_chat_id", null);

  if (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }

  const apiKey = process.env.SOLAPI_API_KEY!;
  const apiSecret = process.env.SOLAPI_API_SECRET!;
  const sender = process.env.SOLAPI_SENDER!;

  let sentCount = 0;
  let failCount = 0;

  for (const user of users ?? []) {
    const telegramLink = `https://loop-breaker-e1gt.vercel.app/?telegram=1&uid=${user.id}`;

    const text = `루프브레이커입니다.

텔레그램으로 받으시면
더 편리하고 안전해요.

✓ 전화번호 없이 연결돼요
✓ 암호화된 채널로 안전해요
✓ 버튼 하나로 바로 생각하러 가요
✓ 앞으로 더 다양한 알림을 먼저 받으세요

텔레그램이 없으시면 먼저 설치해 주세요.
앱스토어 또는 플레이스토어에서
"텔레그램" 검색 후 설치하시면 돼요.

설치 후 아래 링크 탭 하나면 끝이에요.
${telegramLink}

안 하셔도 괜찮아요.
문자 알림은 그대로 계속돼요.`;

    const date = new Date().toISOString();
    const salt = Math.random().toString(36).slice(2);
    const signature = getSignature(apiSecret, date, salt);

    const res = await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
      },
      body: JSON.stringify({
        message: {
          to: user.phone_number,
          from: sender,
          text,
        },
      }),
    });

    if (res.ok) {
      sentCount++;
    } else {
      const err = await res.json();
      console.error("발송 실패", user.phone_number, err);
      failCount++;
    }
  }

  return NextResponse.json({
    total: users?.length ?? 0,
    sentCount,
    failCount,
  });
}