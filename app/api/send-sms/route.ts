import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import crypto from "crypto";

function getSignature(apiSecret: string, date: string, salt: string) {
  return crypto
    .createHmac("sha256", apiSecret)
    .update(date + salt)
    .digest("hex");
}

function isSundayNightReportTime(slot: string) {
  const now = new Date();
  const koreaNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
  const day = koreaNow.getDay();
  return slot === "밤" && day === 0;
}

async function sendTrialEndingNotifications(supabase: any) {
  const apiKey = process.env.SOLAPI_API_KEY!;
  const apiSecret = process.env.SOLAPI_API_SECRET!;
  const sender = process.env.SOLAPI_SENDER!;

  const now = new Date();
  const d1Date = new Date(now);
  d1Date.setDate(now.getDate() - 13);
  const d0Date = new Date(now);
  d0Date.setDate(now.getDate() - 14);

  const { data: users } = await supabase
    .from("users")
    .select("id, phone_number, trial_started_at, created_at")
    .eq("is_paid", false)
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
멈추려 했던 순간들은 이미 당신 안에 있으니까요.`;
    } else if (daysSinceTrial === 60) {
      text = `루프브레이커입니다.

오늘부터 알림이 멈춥니다.

계속 이어가고 싶으시다면
월 2,900원으로 받아보실 수 있어요.

${paymentLink}

짧은 멈춤이 변화를 만든다는 걸
이미 아시잖아요.`;
    }

    if (!text) continue;

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
  }
}

async function sendWeeklyReports(supabase: any) {
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

    let text = "";

    if (stopCount === 0) {
      text = `이번 주에는 아직 멈춤이 없었어요
다음 한 번이 시작이 될 수 있습니다
${autoLink}`;
    } else if (stopCount <= 2) {
      const options = [
        `이번 주, ${stopCount}번 멈췄어요
그 한 번이면 충분합니다
${autoLink}`,
        `이번 주, ${stopCount}번 멈췄어요
이미 시작되었습니다
${autoLink}`,
      ];
      text = options[Math.floor(Math.random() * options.length)];
    } else if (stopCount <= 5) {
      const options = [
        `이번 주, ${stopCount}번 멈췄어요
그 순간들이 쌓이고 있습니다
${autoLink}`,
        `이번 주, ${stopCount}번 멈췄어요
흐름이 조금씩 달라지고 있습니다
${autoLink}`,
      ];
      text = options[Math.floor(Math.random() * options.length)];
    } else {
      const options = [
        `이번 주, ${stopCount}번 멈췄어요
멈추는 순간들이 이어지고 있습니다
${autoLink}`,
        `이번 주, ${stopCount}번 멈췄어요
이제 멈춤이 자연스러워지고 있습니다
${autoLink}`,
      ];
      text = options[Math.floor(Math.random() * options.length)];
    }

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

  return NextResponse.json({
    mode: "weekly_report",
    sentCount,
    skippedCount,
  });
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
      body: JSON.stringify({
        message: {
          to,
          from,
          text,
        },
      }),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slot = searchParams.get("slot");
  const secret = searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!slot || !["오전", "오후", "밤"].includes(slot)) {
    return NextResponse.json({ error: "invalid slot" }, { status: 400 });
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

  if (isSundayNightReportTime(slot)) {
    return await sendWeeklyReports(supabase);
  }

  const { data: users, error } = await supabase
    .from("users")
    .select("*")
    .eq("notification_time", slot)
    .eq("sms_consent", true);

  if (error) {
    console.error("유저 조회 실패", error);
    return Response.json({ error }, { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);

  let sentCount = 0;
  let skippedCount = 0;

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

 const messages = [
  `잠깐 생각하고 갈게요 🙂
${autoLink}`,
  `지금 생각하는 시간이요 🙂
${autoLink}`,
];

    const text = messages[Math.floor(Math.random() * messages.length)];

    const date = new Date().toISOString();
    const salt = Math.random().toString(36).slice(2);
    const signature = getSignature(
      process.env.SOLAPI_API_SECRET!,
      date,
      salt
    );

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

    await supabase.from("sms_send_logs").insert([
      {
        user_id: user.id,
        phone_number: user.phone_number,
        notification_time: slot,
        message_text: text,
      },
    ]);

    sentCount += 1;
  }

  return Response.json({
    slot,
    total: users?.length ?? 0,
    sentCount,
    skippedCount,
  });
}