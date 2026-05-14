import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const ADMIN_CHAT_ID = "59182410";

async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");

    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 전날 날짜 계산 (한국 시간 기준)
    const now = new Date();
    const koreaNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const yesterday = new Date(koreaNow);
    yesterday.setDate(koreaNow.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const yesterdayStart = `${yesterdayStr}T00:00:00.000Z`;
    const yesterdayEnd = `${yesterdayStr}T23:59:59.999Z`;

    // 3일 전 기준
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

    // 전날 신규 가입자
    const { count: newUsers } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .gte("created_at", yesterdayStart)
      .lt("created_at", yesterdayEnd);

    // 전날 신규 중 전화문자
    const { count: newSmsUsers } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .gte("created_at", yesterdayStart)
      .lt("created_at", yesterdayEnd)
      .is("telegram_chat_id", null);

    // 전날 신규 중 텔레그램
    const { count: newTelegramUsers } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .gte("created_at", yesterdayStart)
      .lt("created_at", yesterdayEnd)
      .not("telegram_chat_id", "is", null);

    // 전날 문자 발송 건수
    const { count: sentCount } = await supabase
      .from("sms_send_logs")
      .select("*", { count: "exact", head: true })
      .gte("sent_at", yesterdayStart)
      .lt("sent_at", yesterdayEnd);

    // 전날 멈춤 횟수
    const { count: pauseCount } = await supabase
      .from("pause_logs")
      .select("*", { count: "exact", head: true })
      .eq("action_type", "pause")
      .gte("created_at", yesterdayStart)
      .lt("created_at", yesterdayEnd);

    // 3일 이상 미반응
    const { data: activeUsers } = await supabase
      .from("users")
      .select("id")
      .eq("sms_consent", true);

    let noResponseCount = 0;
    if (activeUsers && activeUsers.length > 0) {
      const { data: recentActive } = await supabase
        .from("pause_logs")
        .select("user_id")
        .gte("created_at", threeDaysAgo);

      const recentUserIds = new Set(recentActive?.map((r: any) => r.user_id) ?? []);
      noResponseCount = activeUsers.filter((u: any) => !recentUserIds.has(u.id)).length;
    }

    // 누적 가입자
    const { count: totalUsers } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    // 누적 전화문자
    const { count: totalSms } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .is("telegram_chat_id", null);

    // 누적 텔레그램
    const { count: totalTelegram } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .not("telegram_chat_id", "is", null);

    const text =
      `📊 <b>전날 운영 현황 (${yesterdayStr})</b>\n\n` +
      `• 신규 가입자: <b>${newUsers ?? 0}명</b>\n` +
      `  📞 전화문자: ${newSmsUsers ?? 0}명\n` +
      `  💬 텔레그램: ${newTelegramUsers ?? 0}명\n\n` +
      `• 문자 발송: <b>${sentCount ?? 0}건</b>\n` +
      `• 멈춤 횟수: <b>${pauseCount ?? 0}회</b>\n` +
      `• 3일 이상 미반응: <b>${noResponseCount}명</b>\n\n` +
      `• 누적 가입자: <b>${totalUsers ?? 0}명</b>\n` +
      `  📞 전화문자: ${totalSms ?? 0}명\n` +
      `  💬 텔레그램: ${totalTelegram ?? 0}명`;

    await sendTelegramMessage(ADMIN_CHAT_ID, text);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("브리핑 오류", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}