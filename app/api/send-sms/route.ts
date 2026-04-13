

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
  const day = koreaNow.getDay(); // 0 = Sunday
  return slot === "밤" && day === 0;
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

    let text = "";

    if (stopCount === 0) {
      text = `이번 주에는 아직 멈춤이 없었어요
다음 한 번이 시작이 될 수 있습니다
https://loop-breaker-e1gt.vercel.app`;
    } else if (stopCount <= 2) {
      const options = [
        `이번 주, ${stopCount}번 멈췄어요
그 한 번이면 충분합니다
https://loop-breaker-e1gt.vercel.app`,
        `이번 주, ${stopCount}번 멈췄어요
이미 시작되었습니다
https://loop-breaker-e1gt.vercel.app`,
      ];
      text = options[Math.floor(Math.random() * options.length)];
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
console.log("🔥 GET FUNCTION STARTED");
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

const messages =
  user.behavior_type === "other" && customBehavior
    ? [
        `지금 ${customBehavior} 할 순간이에요 🙂\n한 번만 멈춰볼까요\n${autoLink}`,
        `지금 ${customBehavior} 하고 있을 순간이에요 🙂\n잠깐 멈춰볼까요\n${autoLink}`,
      ]
    : [
        `지금 딱 그 순간이에요 🙂\n한 번만 멈춰봐요\n${autoLink}`,
        `지금이에요 🙂\n한 번만 멈춰볼까요\n${autoLink}`,
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