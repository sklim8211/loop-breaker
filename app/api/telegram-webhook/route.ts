import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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
        const shareText = shareMessages[
          Math.floor(Math.random() * shareMessages.length)
        ];
        await sendTelegramMessage(chatId, shareText);
        return NextResponse.json({ ok: true });
      }

      // 확인 버튼
      if (action === "confirm") {
        await sendTelegramMessage(chatId, "오늘도 잠깐 멈춤, 충분합니다 🙂");
        return NextResponse.json({ ok: true });
      }

      // 생각했어요 버튼
      if (action === "stop") {
        // pause_log 저장
        await supabase.from("pause_logs").insert([{
          user_id: userId,
          action_type: "pause",
          created_at: new Date().toISOString(),
        }]);

        // 이번 주 멈춤 횟수
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
          `${responseLine} 🙂\n이번 주 ${weeklyCount}번째 멈춤이에요.`,
          {
            inline_keyboard: [[
              { text: "혹시 생각나는 분 있어요?", callback_data: `share:${userId}` },
            ], [
              { text: "확인", callback_data: `confirm:${userId}` },
            ]]
          }
        );

        return NextResponse.json({ ok: true });
      }

      // 괜찮아요 버튼
      if (action === "continue") {
        // pause_log 저장
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

    // ★ 일반 메시지 처리 (/start 명령어)
    const message = body?.message;
    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message?.chat?.id?.toString();
    const text = message?.text ?? "";

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

    // Supabase에 chat_id 저장
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