import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import crypto from "crypto";



function getSignature(apiSecret: string, date: string, salt: string) {
  return crypto
    .createHmac("sha256", apiSecret)
    .update(date + salt)
    .digest("hex");
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase environment variables" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { searchParams } = new URL(req.url);

  const slot = searchParams.get("slot");
  const secret = searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!slot || !["오전", "오후", "밤"].includes(slot)) {
    return NextResponse.json({ error: "invalid slot" }, { status: 400 });
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

    const messages = [
      "지금 딱 그 순간이에요 🙂\n한 번만 멈춰봐요\nhttps://loop-breaker-w9eo.vercel.app/",
      "지금이에요 🙂\n한 번만 멈춰볼까요\nhttps://loop-breaker-w9eo.vercel.app/",
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