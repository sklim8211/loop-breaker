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

  const apiKey = process.env.SOLAPI_API_KEY!;
  const apiSecret = process.env.SOLAPI_API_SECRET!;
  const sender = process.env.SOLAPI_SENDER!;

  const { data: users } = await supabase
    .from("users")
    .select("id, phone_number, sms_consent")
    .eq("sms_consent", true);

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);

  let sentCount = 0;
  let skippedCount = 0;

  for (const user of users ?? []) {
    // 이미 보냈는지 체크
    const { data: alreadySent } = await supabase
      .from("report_send_logs")
      .select("id")
      .eq("user_id", user.id)
      .eq("report_type", "weekly")
      .gte("sent_at", weekAgo.toISOString())
      .limit(1);

    if (alreadySent && alreadySent.length > 0) {
      skippedCount++;
      continue;
    }

    // 로그 집계
    const { data: logs } = await supabase
      .from("pause_logs")
      .select("action_type")
      .eq("user_id", user.id)
      .gte("created_at", weekAgo.toISOString());

    const stopCount =
      logs?.filter((x) => x.action_type === "pause").length ?? 0;

    let text = "";

if (stopCount === 0) {
  text = `이번 주에는 아직 멈춤이 없었어요
다음 한 번이 시작이 될 수 있습니다
https://loop-breaker-e1gt.vercel.app`;
} else if (stopCount === 1) {
  text = `이번 주, 1번 멈췄어요
그 한 번이면 충분합니다
https://loop-breaker-e1gt.vercel.app`;
} else if (stopCount === 2) {
  text = `이번 주, 2번 멈췄어요
이미 시작되었습니다
https://loop-breaker-e1gt.vercel.app`;
} else if (stopCount <= 5) {
  const options = [
    `이번 주, ${stopCount}번 멈췄어요
그 순간들이 쌓이고 있습니다
https://loop-breaker-e1gt.vercel.app`,
    `이번 주, ${stopCount}번 멈췄어요
흐름이 조금씩 달라지고 있습니다
https://loop-breaker-e1gt.vercel.app`,
  ];
  text = options[Math.floor(Math.random() * options.length)];
} else {
  const options = [
    `이번 주, ${stopCount}번 멈췄어요
멈추는 순간들이 이어지고 있습니다
https://loop-breaker-e1gt.vercel.app`,
    `이번 주, ${stopCount}번 멈췄어요
이제 멈춤이 자연스러워지고 있습니다
https://loop-breaker-e1gt.vercel.app`,
  ];
  text = options[Math.floor(Math.random() * options.length)];
}

    // 문자 발송
    const date = new Date().toISOString();
    const salt = Math.random().toString(36).slice(2);
    const signature = getSignature(apiSecret, date, salt);

    await fetch("https://api.solapi.com/messages/v4/send", {
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

    await supabase.from("report_send_logs").insert([
      {
        user_id: user.id,
        report_type: "weekly",
      },
    ]);

    sentCount++;
  }

  return NextResponse.json({ sentCount, skippedCount });
}