import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { userId, behaviorType, notificationTime } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId가 없어요" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 이미 존재하는 사용자면 스킵
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .single();

    if (existing) {
      return NextResponse.json({ ok: true, existing: true });
    }

    // 새 사용자 저장
    const { error } = await supabase.from("users").insert([{
      id: userId,
      phone_number: `tg_${Date.now()}`,
      behavior_type: behaviorType ?? "other",
      notification_time: notificationTime ?? "20:00",
      sms_consent: false,
    }]);

    if (error) {
      console.error("텔레그램 사용자 저장 실패", error);
      return NextResponse.json({ error: String(error) }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}