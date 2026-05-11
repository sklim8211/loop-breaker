import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 텔레그램에서 오는 메시지
    const message = body?.message;
    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message?.chat?.id?.toString();
    const text = message?.text ?? "";

    // /start 명령어 처리
    if (!text.startsWith("/start")) {
      return NextResponse.json({ ok: true });
    }

    // /start 뒤에 붙은 유저ID 추출
    // 예: /start usr_abc123
    const parts = text.split(" ");
    const userId = parts[1] ?? null;

    if (!userId) {
      // 유저ID 없이 /start만 입력한 경우
      await sendTelegramMessage(chatId, "안녕하세요 🙂\n루프브레이커 서비스에서 연결해주세요.");
      return NextResponse.json({ ok: true });
    }

    // Supabase에 chat_id 저장
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from("users")
      .update({ telegram_chat_id: chatId })
      .eq("id", userId);

    if (error) {
      console.error("chat_id 저장 실패", error);
      await sendTelegramMessage(chatId, "연결 중 문제가 생겼어요. 다시 시도해주세요.");
      return NextResponse.json({ ok: false });
    }

    // 연결 성공 메시지
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

async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });
}