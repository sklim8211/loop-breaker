import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");

    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 }
      );
    }

    const now = new Date();

    const koreaNow = new Date(
      now.toLocaleString("en-US", {
        timeZone: "Asia/Seoul",
      })
    );

    const hour = koreaNow.getHours();

    let slot = "";

    if (hour === 8) slot = "08:00";
    else if (hour === 10) slot = "10:00";
    else if (hour === 12) slot = "12:00";
    else if (hour === 14) slot = "14:00";
    else if (hour === 16) slot = "16:00";
    else if (hour === 18) slot = "18:00";
    else if (hour === 20) slot = "20:00";
    else if (hour === 22) slot = "22:00";
    else {
      return NextResponse.json({
        message: "no scheduled slot now",
        koreaHour: hour,
      });
    }

    const baseUrl =
  process.env.NEXT_PUBLIC_BASE_URL ||
  "https://loop-breaker-e1gt.vercel.app";
    const url =
      `${baseUrl}/api/send-sms` +
      `?slot=${encodeURIComponent(slot)}` +
      `&secret=${process.env.CRON_SECRET}`;

    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });

    const data = await res.json();

    return NextResponse.json({
      success: true,
      koreaHour: hour,
      slot,
      result: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: String(error),
      },
      { status: 500 }
    );
  }
}