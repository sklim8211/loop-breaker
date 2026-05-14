import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import crypto from "crypto";

function getSignature(apiSecret: string, date: string, salt: string) {
  return crypto
    .createHmac("sha256", apiSecret)
    .update(date + salt)
    .digest("hex");
}

function getKoreaDayOfWeek() {
  const now = new Date();
  const koreaOffset = 9 * 60;
  const koreaTime = new Date(now.getTime() + koreaOffset * 60 * 1000);
  return koreaTime.getUTCDay();
}

function isSundayNightReportTime(slot: string) {
  return getKoreaDayOfWeek() === 0 && slot === "20:00";
}

async function sendTelegramMessage(
  chatId: string,
  text: string,
  userId: string
) {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const autoLink = `https://loop-breaker-e1gt.vercel.app/?auto=1&uid=${userId}`;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [[
          { text: "생각하러 가기 →", url: autoLink }
        ]]
      }
    }),
  });
}

function getTelegramAlertText(): string {
  const phrases = [
    `생각버튼 켜질 시간이에요🙂`,
    `생각할 시간 알려드려요🙂`,
    `잠깐 생각하고 갈게요 🙂`,
    `지금 생각하는 시간이요 🙂`,
  ];
  return phrases[Math.floor(Math.random() * phrases.length)];
}

// ★ 타입별 expandedDescription
const expandedDescriptions: Record<string, string> = {
  "아쉬움 연장형": `"조금만 더" 하려다가\n어느새 한참이 지나있어요.\n그만해도 된다는 걸 알면서도\n멈추는 타이밍이 자꾸 늦어지죠.`,
  "오늘만 허가형": `오늘은 괜찮다고 했어요.\n그런데 그 오늘이 꽤 자주 와요.\n예외가 반복되면\n어느새 그게 기본이 되죠.`,
  "멈춤 타이밍 실종형": `그만해야 하는 거 알아요.\n그런데 끝낼 타이밍이\n항상 조금씩 늦어져요.\n이미 한참 지나서야 보이죠.`,
  "마음 달래기 연장형": `잠깐 달래려 했는데\n그 시간이 생각보다 길어졌어요.\n마음이 힘들수록\n멈추기가 더 어렵죠.`,
  "지친 날 특혜형": `힘든 날엔 나한테 좀 관대해져요.\n오늘만큼은 괜찮다고.\n근데 그 특혜가\n생각보다 자주 열리죠.`,
  "지침 폭주형": `지칠수록 브레이크가 잘 안 들어요.\n피곤한 날일수록\n오히려 더 멀리 가게 되죠.\n멈추는 게 제일 힘든 순간에.`,
  "자동모드 연장형": `손이 먼저 알아요.\n생각하기 전에 이미 시작돼있고\n늘 하던 흐름대로 가다 보면\n또 길어지고 있죠.`,
  "익숙한 예외형": `익숙한 흐름에\n오늘만 괜찮다를 슬쩍 더해요.\n그게 어느새 익숙해지면\n예외가 루틴이 되죠.`,
  "종료 버튼 실종형": `시작은 자연스러운데\n끝내는 버튼이 잘 안 보여요.\n이쯤에서 끝내야 하는데\n하면서도 계속 가게 되죠.`,
  "이유는 몰라도 시작형": `왜 시작했는지 모르겠어요.\n그냥 어느새 하고 있고\n이유는 나중에 붙이면 되니까\n일단 계속 가게 되죠.`,
  "설명은 나중형": `일단 하고 봐요.\n이유는 나중에 생각하면 되고\n설명은 끝나고 붙이면 되니까\n지금은 그냥 계속하죠.`,
  "출발 미상 질주형": `언제 시작했는지 모르겠어요.\n그냥 어느새 한참 와있고\n출발점은 흐릿한데\n진행은 선명하게 계속되죠.`,
  "정신 차려보니형": `정신 차려보니 또 여기예요.\n언제 시작했는지도 모르겠는데\n어느새 여기까지 와있고\n또 그랬구나 싶은 거죠.`,
};

// ★ 이번 달 멈춰 생각한 횟수
async function getMonthlyPauseCount(supabase: any, userId: string): Promise<number> {
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("pause_logs")
    .select("action_type")
    .eq("user_id", userId)
    .eq("action_type", "pause")
    .gte("created_at", monthAgo);
  return data?.length ?? 0;
}

// ★ 기억형 문구 생성 (90일 6사이클)
function getMemoryText(user: any, pauseCount: number, daysSinceJoined: number): string {
  const desc = expandedDescriptions[user.result_type] ?? null;
  if (!desc) return "";

  if (daysSinceJoined >= 14 && daysSinceJoined <= 16) {
    return `처음 시작할 때 이걸 보셨어요.\n\n${desc}\n\n지금도 낯설지 않죠?`;
  }

  if (daysSinceJoined >= 29 && daysSinceJoined <= 31) {
    return `한 달이 지났어요.\n\n이번 달 ${pauseCount}번 멈춰 생각했어요.\n\n그때랑 지금, 달라진 게 있나요?`;
  }

  if (daysSinceJoined >= 44 && daysSinceJoined <= 46) {
    return `벌써 한 달 반이에요.\n\n멈춰 생각하는 게\n조금은 익숙해졌나요?\n\n어느 쪽이든 괜찮아요.`;
  }

  if (daysSinceJoined >= 59 && daysSinceJoined <= 61) {
    return `두 달이 지났어요.\n\n이번 달 ${pauseCount}번 멈춰 생각했어요.\n\n처음보다 달라진 게\n느껴지는 순간이 있었나요?`;
  }

  if (daysSinceJoined >= 74 && daysSinceJoined <= 76) {
    return `거의 다 왔어요.\n\n이 패턴,\n처음보다 가벼워졌나요?\n\n멈춰 생각하는 그 순간들이\n조금씩 쌓이고 있어요.`;
  }

  if (daysSinceJoined >= 89 && daysSinceJoined <= 91) {
    return `90일이 됐어요.\n\n${desc}\n\n이제 이게 낯설어졌다면\n졸업할 때가 된 거예요.\n\n수고하셨어요.`;
  }

  return "";
}

async function sendTrialEndingNotifications(supabase: any) {
  const apiKey = process.env.SOLAPI_API_KEY!;
  const apiSecret = process.env.SOLAPI_API_SECRET!;
  const sender = process.env.SOLAPI_SENDER!;

  const now = new Date();

  const { data: users } = await supabase
    .from("users")
    .select("id, phone_number, sms_consent, telegram_chat_id, trial_started_at, created_at")
    .eq("sms_consent", true);

  for (const user of users ?? []) {
    const trialStart = user.trial_started_at
      ? new Date(user.trial_started_at)
      : new Date(user.created_at);

    const daysSinceTrial = Math.floor(
      (now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24)
    );

    const paymentLink = `https://loop-breaker-e1gt.vercel.app/payment?uid=${user.id}`;

    let text = "";

    if (daysSinceTrial === 59) {
      text = `루프브레이커입니다.

2주간 함께했어요.
내일이면 무료 기간이 끝납니다.

계속 받고 싶으시면
아래 링크에서 이어가실 수 있어요.

${paymentLink}

안 하셔도 괜찮아요.
멈춰 생각했던 순간들은 이미 당신 안에 있으니까요.`;
    } else if (daysSinceTrial === 60) {
      text = `루프브레이커입니다.

오늘부터 알림이 멈춥니다.

계속 이어가고 싶으시다면
월 2,900원으로 받아보실 수 있어요.

${paymentLink}

짧게 멈춰 생각하는 순간이
변화를 만든다는 걸
이미 아시잖아요.`;
    }

    if (!text) continue;

    if (user.telegram_chat_id) {
      await sendTelegramMessage(user.telegram_chat_id, text, user.id);
    } else {
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
          message: { to: user.phone_number, from: sender, text },
        }),
      });
    }
  }
}

async function sendWeeklyReports(supabase: any) {
  const apiKey = process.env.SOLAPI_API_KEY!;
  const apiSecret = process.env.SOLAPI_API_SECRET!;
  const sender = process.env.SOLAPI_SENDER!;

  const { data: users } = await supabase
    .from("users")
    .select("id, phone_number, sms_consent, telegram_chat_id")
    .eq("sms_consent", true);

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);

  let sentCount = 0;
  let skippedCount = 0;

  for (const user of users ?? []) {
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

    const { data: logs } = await supabase
      .from("pause_logs")
      .select("action_type")
      .eq("user_id", user.id)
      .gte("created_at", weekAgo.toISOString());

    const stopCount =
      logs?.filter((x: any) => x.action_type === "pause").length ?? 0;

    const autoLink = `https://loop-breaker-e1gt.vercel.app/?auto=1&uid=${user.id}`;

    const reportMessages = {
      zero: [
        `이번 주엔 그냥 지나갔네요\n괜찮아요, 다음 주가 있으니까요`,
        `이번 주는 바빴나봐요 🙂`,
        `이번 주엔 그냥 흘러갔네요\n그럴 때도 있어요`,
        `이번 주는 그냥 지켜봤어요`,
        `쉬어가는 주도 있는 거예요`,
        `이번 주는 그냥 넘어갔네요\n다음 주 또 와요`,
        `아무것도 안 한 주도 쌓이는 거예요`,
      ],
      low: [
        `잠깐이었지만, 됐어요`,
        `시작은 그렇게 하더라고요 🙂`,
        `그거면 충분해요`,
        `작지만 있었어요`,
        `없는 것보다 훨씬 낫죠 🙂`,
        `그게 다가 아니에요`,
      ],
      mid: [
        `어느새요 🙂`,
        `슬슬 몸에 배고 있어요`,
        `그 순간들, 변화가 찾아와요`,
        `꽤 했네요 🙂`,
        `흐름이 생기고 있어요`,
        `그 순간들이 모이고 있어요`,
        `조금씩 달라지고 있는 거예요`,
        `이쯤이면 습관이 되려나봐요 🙂`,
      ],
      high: [
        `이제 자연스럽죠? 🙂`,
        `어느새 일상이 되고 있네요`,
        `그 순간들의 반복이에요`,
        `이 정도면 진짜 달라지고 있어요`,
        `멋지게 하고 계세요 🙂`,
        `이제 몸이 먼저 알고 있을 거예요`,
        `변화가 이미 시작됐어요`,
        `이쯤이면 충분히 잘 하고 있어요`,
      ],
    };

    let messagePool: string[] = [];
    if (stopCount === 0) messagePool = reportMessages.zero;
    else if (stopCount <= 2) messagePool = reportMessages.low;
    else if (stopCount <= 5) messagePool = reportMessages.mid;
    else messagePool = reportMessages.high;

    const comment = messagePool[Math.floor(Math.random() * messagePool.length)];
    const text = stopCount === 0
      ? `${comment}\n${autoLink}`
      : `이번 주, ${stopCount}번 멈춰 생각했네요\n${comment}\n${autoLink}`;

    if (user.telegram_chat_id) {
      await sendTelegramMessage(user.telegram_chat_id, text, user.id);
    } else {
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
          message: { to: user.phone_number, from: sender, text },
        }),
      });
    }

    await supabase.from("report_send_logs").insert([{
      user_id: user.id,
      report_type: "weekly",
    }]);

    sentCount++;
  }

  return NextResponse.json({ mode: "weekly_report", sentCount, skippedCount });
}

export async function POST(req: Request) {
  try {
    const { to, text } = await req.json();

    const apiKey = process.env.SOLAPI_API_KEY;
    const apiSecret = process.env.SOLAPI_API_SECRET;
    const from = process.env.SOLAPI_SENDER;

    if (!apiKey || !apiSecret || !from) {
      return NextResponse.json(
        { error: "Missing Solapi environment variables" },
        { status: 500 }
      );
    }

    if (!to || !text) {
      return NextResponse.json(
        { error: "to 또는 text가 비어 있습니다." },
        { status: 400 }
      );
    }

    const date = new Date().toISOString();
    const salt = Math.random().toString(36).slice(2);
    const signature = getSignature(apiSecret, date, salt);

    const response = await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
      },
      body: JSON.stringify({ message: { to, from, text } }),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const slot = searchParams.get("slot");
  const secret = searchParams.get("secret");
  const isReport = searchParams.get("report") === "1";

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const allowedSlots = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];

  if (!slot || !allowedSlots.includes(slot)) {
    return NextResponse.json({ error: "invalid slot" }, { status: 400 });
  }

  if (searchParams.get("debug") === "env") {
    return NextResponse.json({
      solapiApiKeyLength: process.env.SOLAPI_API_KEY?.length ?? 0,
      solapiSender: process.env.SOLAPI_SENDER ? "exists" : "missing",
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase environment variables" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  await sendTrialEndingNotifications(supabase);

  if (isReport || isSundayNightReportTime(slot)) {
    return await sendWeeklyReports(supabase);
  }

  const day = getKoreaDayOfWeek();
  if (day === 0) {
    return NextResponse.json({
      mode: "sunday_no_regular_sms",
      message: "Sunday regular SMS is skipped",
      slot,
    });
  }

  const { data: users, error } = await supabase
    .from("users")
    .select("*")
    .eq("notification_time", slot)
    .or("sms_consent.eq.true,telegram_chat_id.not.is.null");

  if (error) {
    console.error("유저 조회 실패", error);
    return Response.json({ error }, { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  let sentCount = 0;
  let skippedCount = 0;
  let memoryCount = 0;

  for (const user of users ?? []) {
    const { data: alreadySent } = await supabase
      .from("sms_send_logs")
      .select("id, sent_at")
      .eq("user_id", user.id)
      .eq("notification_time", slot)
      .gte("sent_at", `${today}T00:00:00.000Z`)
      .lt("sent_at", `${today}T23:59:59.999Z`)
      .limit(1);

    if (alreadySent && alreadySent.length > 0) {
      skippedCount += 1;
      continue;
    }

    const customBehavior =
      typeof user.custom_behavior === "string" ? user.custom_behavior.trim() : "";

    const baseUrl = "https://loop-breaker-e1gt.vercel.app";
    const autoLink = `${baseUrl}/?auto=1&uid=${user.id}`;

    // ★ 가입 후 경과일 계산
    const joinedAt = user.trial_started_at
      ? new Date(user.trial_started_at)
      : new Date(user.created_at);
    const daysSinceJoined = Math.floor(
      (now.getTime() - joinedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // ★ 기억형 대상 여부 확인
    const isMemoryDay =
      user.result_type && (
        (daysSinceJoined >= 14 && daysSinceJoined <= 16) ||
        (daysSinceJoined >= 29 && daysSinceJoined <= 31) ||
        (daysSinceJoined >= 44 && daysSinceJoined <= 46) ||
        (daysSinceJoined >= 59 && daysSinceJoined <= 61) ||
        (daysSinceJoined >= 74 && daysSinceJoined <= 76) ||
        (daysSinceJoined >= 89 && daysSinceJoined <= 91)
      );

    let text = "";

    if (isMemoryDay) {
      const pauseCount = await getMonthlyPauseCount(supabase, user.id);
      const memoryText = getMemoryText(user, pauseCount, daysSinceJoined);
      if (memoryText) {
        text = memoryText;
        memoryCount++;
      }
    }

    // 기억형 아니면 기본 알림
    if (!text) {
      const messages = [
        `생각버튼 켜질 시간이에요🙂`,
        `생각할 시간 알려드려요🙂`,
        `잠깐 생각하고 갈게요 🙂`,
        `지금 생각하는 시간이요 🙂`,
      ];
      text = user.telegram_chat_id
        ? getTelegramAlertText()
        : messages[Math.floor(Math.random() * messages.length)];
    }

    const date = new Date().toISOString();
    const salt = Math.random().toString(36).slice(2);
    const signature = getSignature(process.env.SOLAPI_API_SECRET!, date, salt);

    if (user.telegram_chat_id) {
      await sendTelegramMessage(user.telegram_chat_id, text, user.id);
    } else {
      const smsRes = await fetch("https://api.solapi.com/messages/v4/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `HMAC-SHA256 apiKey=${process.env.SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`,
        },
        body: JSON.stringify({
          message: {
            to: user.phone_number,
            from: process.env.SOLAPI_SENDER,
            text,
          },
        }),
      });

      const smsData = await smsRes.json();
      if (!smsRes.ok) {
        console.error("문자 발송 실패", user.phone_number, smsData);
        continue;
      }
    }

    await supabase.from("sms_send_logs").insert([{
      user_id: user.id,
      phone_number: user.phone_number,
      notification_time: slot,
      message_text: text,
    }]);

    sentCount += 1;
  }

  return Response.json({
    slot,
    total: users?.length ?? 0,
    sentCount,
    skippedCount,
    memoryCount,
  });
}