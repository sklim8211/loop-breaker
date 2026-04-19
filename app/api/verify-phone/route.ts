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
    const { phone, action, code } = await req.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 인증번호 발송
    if (action === "send") {
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      await supabase
        .from("phone_verifications")
        .delete()
        .eq("phone_number", phone);

      await supabase.from("phone_verifications").insert([{
        phone_number: phone,
        code: verificationCode,
      }]);

      const apiKey = process.env.SOLAPI_API_KEY!;
      const apiSecret = process.env.SOLAPI_API_SECRET!;
      const sender = process.env.SOLAPI_SENDER!;

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
            to: phone,
            from: sender,
            text: `루프브레이커 인증번호: ${verificationCode}\n5분 안에 입력해주세요.`,
          },
        }),
      });

      return NextResponse.json({ success: true });
    }

    // 인증번호 확인
    if (action === "verify") {
      const { data } = await supabase
        .from("phone_verifications")
        .select("*")
        .eq("phone_number", phone)
        .eq("code", code)
        .eq("verified", false)
        .gte("expires_at", new Date().toISOString())
        .single();

      if (!data) {
        return NextResponse.json({ success: false, error: "인증번호가 올바르지 않거나 만료되었어요." });
      }

      await supabase
        .from("phone_verifications")
        .update({ verified: true })
        .eq("id", data.id);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}