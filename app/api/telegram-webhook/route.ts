import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const ADMIN_CHAT_ID = "59182410";

// 텔레그램 메시지 발송
async function sendTelegramMessage(
  chatId: string,
  text: string,
  replyMarkup?: object
) {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...(replyMarkup && { reply_markup: replyMarkup }),
    }),
  });
}

// 콜백 쿼리 응답 (버튼 클릭 확인)
async function answerCallbackQuery(callbackQueryId: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  });
}

// ★ 운영 명령어: /stats
async function handleStats(chatId: string, supabase: any) {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { count: totalUsers } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true });

  const { count: telegramUsers } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .not("telegram_chat_id", "is", null);

  const { count: todaySent } = await supabase
    .from("sms_send_logs")
    .select("*", { count: "exact", head: true })
    .gte("sent_at", `${today}T00:00:00.000Z`)
    .lt("sent_at", `${today}T23:59:59.999Z`);

  const { count: weeklyPause } = await supabase
    .from("pause_logs")
    .select("*", { count: "exact", head: true })
    .eq("action_type", "pause")
    .gte("created_at", weekAgo);

  const { count: weeklyCount } = await supabase
    .from("pause_logs")
    .select("*", { count: "exact", head: true })
    .eq("action_type", "continue")
    .gte("created_at", weekAgo);

  const text =
    `📊 <b>운영 현황</b>\n\n` +
    `👥 전체 사용자: <b>${totalUsers ?? 0}명</b>\n` +
    `📱 텔레그램 연결: <b>${telegramUsers ?? 0}명</b>\n` +
    `📨 오늘 발송: <b>${todaySent ?? 0}건</b>\n\n` +
    `이번 주 멈춰 생각한 횟수: <b>${weeklyPause ?? 0}번</b>\n` +
    `이번 주 넘어간 횟수: <b>${weeklyCount ?? 0}번</b>`;

  await sendTelegramMessage(chatId, text);
}

// ★ 운영 명령어: /users
async function handleUsers(chatId: string, supabase: any) {
  const { data: users } = await supabase
    .from("users")
    .select("id, phone_number, telegram_chat_id, created_at, notification_time")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!users || users.length === 0) {
    await sendTelegramMessage(chatId, "등록된 사용자가 없어요.");
    return;
  }

  const lines = users.map((u: any, i: number) => {
    const date = u.created_at?.slice(0, 10) ?? "-";
    const channel = u.telegram_chat_id ? "📱텔레그램" : "💬문자";
    const phone = u.phone_number
      ? u.phone_number.slice(0, 3) + "****" + u.phone_number.slice(-4)
      : "-";
    return `${i + 1}. ${channel} | ${phone} | ${u.notification_time ?? "-"} | 가입 ${date}`;
  });

  const text = `👤 <b>최근 가입자 10명</b>\n\n` + lines.join("\n");
  await sendTelegramMessage(chatId, text);
}

// ★ 운영 명령어: /logs
async function handleLogs(chatId: string, supabase: any) {
  const today = new Date().toISOString().slice(0, 10);

  const { data: logs } = await supabase
    .from("sms_send_logs")
    .select("notification_time, created_at")
    .gte("sent_at", `${today}T00:00:00.000Z`)
    .lt("sent_at", `${today}T23:59:59.999Z`)
    .order("sent_at", { ascending: false })
    .limit(20);

  if (!logs || logs.length === 0) {
    await sendTelegramMessage(chatId, `오늘(${today}) 발송 내역이 없어요.`);
    return;
  }

  // 시간대별 집계
  const slotCounts: Record<string, number> = {};
  for (const log of logs) {
    const slot = log.notification_time ?? "unknown";
    slotCounts[slot] = (slotCounts[slot] ?? 0) + 1;
  }

  const lines = Object.entries(slotCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slot, count]) => `${slot} — ${count}건`);

  const text =
    `📨 <b>오늘 발송 로그 (${today})</b>\n\n` +
    lines.join("\n") +
    `\n\n총 ${logs.length}건`;

  await sendTelegramMessage(chatId, text);
}

// ★ 운영 명령어: /help
async function handleHelp(chatId: string) {
  const text =
    `🛠 <b>운영 명령어</b>\n\n` +
    `/stats — 전체 현황 (사용자, 발송, 멈춰 생각한 횟수)\n` +
    `/users — 최근 가입자 10명\n` +
    `/logs — 오늘 발송 로그\n` +
    `/help — 명령어 목록`;
  await sendTelegramMessage(chatId, text);
}

const shareMessages = [
  `나 요즘 이거 쓰는데

하루 한 번 문자 오면
잠깐 멈춰서 생각하는 거야
그게 전부야

https://loop-breaker-e1gt.vercel.app`,

  `이거 별거 아닌데

하루 한 번 문자 오고
그때 잠깐 생각하는 거야
그걸 계속 하게 됨

https://loop-breaker-e1gt.vercel.app`,

  `나 요즘 이거 쓰는데

뭘 바꾸는 게 아니라
그냥 한 번씩 생각하게 만드는 거야

https://loop-breaker-e1gt.vercel.app`,

  `하루 한 번 문자 오거든
그냥 잠깐 생각하는 거야
그게 다인데

https://loop-breaker-e1gt.vercel.app`,

  `앱 설치도 아니고
그냥 문자로 하루 한 번 오거든
잠깐 생각하고 버튼 하나 누르는 게 다야

https://loop-breaker-e1gt.vercel.app`,
];

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ★ 인라인 버튼 클릭 처리
    const callbackQuery = body?.callback_query;
    if (callbackQuery) {
      const data = callbackQuery.data as string;
      const chatId = callbackQuery.message.chat.id.toString();
      const [action, userId] = data.split(":");

      await answerCallbackQuery(callbackQuery.id);

      // 공유하기 버튼
      if (action === "share") {
        await sendTelegramMessage(
          chatId,
          "친구에게 보내기 버튼을 눌러주세요 🙂",
          {
            inline_keyboard: [[
              {
                text: "친구에게 보내기",
                url: "https://t.me/share/url?url=https://loop-breaker-e1gt.vercel.app&text=나 요즘 이거 쓰는데%0A%0A하루 한 번 문자 오면%0A잠깐 멈춰서 생각하는 거야%0A그게 전부야"
              }
            ]]
          }
        );
        return NextResponse.json({ ok: true });
      }

      // 확인 버튼
      if (action === "confirm") {
        await sendTelegramMessage(chatId, "오늘도 잠깐 멈춰 생각했어요, 충분합니다 🙂");
        return NextResponse.json({ ok: true });
      }

      // 생각했어요 버튼
      if (action === "stop") {
        await supabase.from("pause_logs").insert([{
          user_id: userId,
          action_type: "pause",
          created_at: new Date().toISOString(),
        }]);

        const weekAgo = new Date(
          Date.now() - 7 * 24 * 60 * 60 * 1000
        ).toISOString();
        const { data: logs } = await supabase
          .from("pause_logs")
          .select("action_type")
          .eq("user_id", userId)
          .eq("action_type", "pause")
          .gte("created_at", weekAgo);

        const weeklyCount = logs?.length ?? 0;

        const responsePhrases = [
          "오, 생각했네요",
          "손보다 생각이 빨랐네요",
          "잠깐이었지만, 됐어요",
          "그거면 충분해요",
          "생각했으면 된 거예요",
        ];
        const responseLine = responsePhrases[
          Math.floor(Math.random() * responsePhrases.length)
        ];

        await sendTelegramMessage(
          chatId,
          `${responseLine} 🙂\n이번 주 ${weeklyCount}번째 멈춰 생각했어요.`,
          {
            inline_keyboard: [[
              { text: "생각나는 친구에게 공유해 주세요", callback_data: `share:${userId}` },
            ], [
              { text: "확인", callback_data: `confirm:${userId}` },
            ]]
          }
        );

        return NextResponse.json({ ok: true });
      }

      // 괜찮아요 버튼
      if (action === "continue") {
        await supabase.from("pause_logs").insert([{
          user_id: userId,
          action_type: "continue",
          created_at: new Date().toISOString(),
        }]);

        const continuePhrases = [
          "그래요, 괜찮아요",
          "오늘은 그냥 넘어가요",
          "다음에 또 오잖아요",
          "그것도 선택이에요",
        ];
        const continueLine = continuePhrases[
          Math.floor(Math.random() * continuePhrases.length)
        ];

        await sendTelegramMessage(chatId, continueLine);
        return NextResponse.json({ ok: true });
      }

      return NextResponse.json({ ok: true });
    }

    // ★ 일반 메시지 처리
    const message = body?.message;
    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message?.chat?.id?.toString();
    const text = message?.text ?? "";

    // ★ 운영 명령어 처리 (관리자만)
    if (chatId === ADMIN_CHAT_ID) {
      if (text === "/stats") {
        await handleStats(chatId, supabase);
        return NextResponse.json({ ok: true });
      }
      if (text === "/users") {
        await handleUsers(chatId, supabase);
        return NextResponse.json({ ok: true });
      }
      if (text === "/logs") {
        await handleLogs(chatId, supabase);
        return NextResponse.json({ ok: true });
      }
      if (text === "/help") {
        await handleHelp(chatId);
        return NextResponse.json({ ok: true });
      }
    }

    // ★ /start 명령어 처리
    if (!text.startsWith("/start")) {
      return NextResponse.json({ ok: true });
    }

    const parts = text.split(" ");
    const userId = parts[1] ?? null;

    if (!userId) {
      await sendTelegramMessage(
        chatId,
        "안녕하세요 🙂\n루프브레이커 서비스에서 연결해주세요."
      );
      return NextResponse.json({ ok: true });
    }

    const { error } = await supabase
      .from("users")
      .update({ telegram_chat_id: chatId })
      .eq("id", userId);

    if (error) {
      console.error("chat_id 저장 실패", error);
      await sendTelegramMessage(
        chatId,
        "연결 중 문제가 생겼어요. 다시 시도해주세요."
      );
      return NextResponse.json({ ok: false });
    }

    await sendTelegramMessage(
      chatId,
      `연결됐어요 🙂\n이제 루프브레이커 알림을 텔레그램으로 받으실 수 있어요.\n\n아래 링크로 돌아가서 시작하기를 눌러주세요.\nhttps://loop-breaker-e1gt.vercel.app/?auto=1&uid=${userId}`
    );

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error("Webhook 오류", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}