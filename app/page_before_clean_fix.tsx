"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Clock3, Settings, Share2 } from "lucide-react";
import { supabase } from "../lib/supabase";

const behaviors = [
  {
    key: "smartphone",
    label: "스마트폰 계속 보고 있네요",
    interventionPool: [
      "조금 보려던 게, 꽤 보고 있네요",
      "이건 휴식일까요, 자동재생일까요",
      "손은 쉬고 싶은데, 손가락만 일하고 있네요",
      "지금 필요한 건 정보가 아니라, 멈춤일지도요",
    ],
    actionText: "보고 있던 거, 잠깐 내려놓아볼까요",
    displayText: "끝없이 넘기고 있을 때",
  },
  {
    key: "delay",
    label: "또 할 일을 미루고 있네요",
    interventionPool: [
      "지금 이건 쉬는 걸까요, 미루는 걸까요",
      "시작 전이 제일 길죠",
      "잠깐이면 될 걸, 계속 미루고 있네요",
      "생각은 많은데, 시작은 없네요",
    ],
    actionText: "미루던 거, 10초만 해볼까요",
    displayText: "시작하려다 멈춘 그때",
  },
  {
    key: "overeating",
    label: "한 입 더 먹고 있네요",
    interventionPool: [
      "배는 괜찮은데, 손이 계속 가네요",
      "한 입만 더가 계속 이어지네요",
      "지금은 배보다 습관이 먹고 있는 걸지도요",
      "이미 충분한데, 계속 먹고 있네요",
    ],
    actionText: "먹고 있던 거, 여기서 한 번 멈춰볼까요",
    displayText: "배부른데 손이 갈 때",
  },
  {
    key: "other",
    label: "나도 모르게 계속 하고 있네요",
    interventionPool: [
      "지금도 계속 하고 있네요",
      "원래 하려던 건 따로 있었죠",
      "그냥 하고 있는 건지, 하고 싶은 건지",
      "멈출 타이밍을 지나고 있는 걸지도요",
    ],
    actionText: "지금 하고 있던 거, 잠깐 멈춰볼까요",
    displayText: "왜 하는지 모르고 계속할 때",
  },
] as const;

const timeOptions = [
  { key: "morning", label: "오전" },
  { key: "afternoon", label: "오후" },
  { key: "night", label: "밤" },
] as const;

const weeklyReportLines = {
  body: "그 순간들이 쌓이고 있어요",
  caption: "변화는 그렇게 시작됩니다",
} as const;

const STORAGE_KEYS = {
  settings: "loop-breaker-settings",
  events: "loop-breaker-events",
} as const;

type Step =
  | "intro"
  | "behavior"
  | "time"
  | "alerts"
  | "home"
  | "settings"
  | "intervention"
  | "response";

type ActionType = "stop" | "continue";
type AlertMethod = "sms";

type SavedSettings = {
  userId: string | null;
  selectedBehavior: string | null;
  selectedTime: string | null;
  alertMethod: AlertMethod;
  phoneNumber: string;
  smsConsent: boolean;
  notificationsEnabled: boolean;
};

type EventItem = {
  userId: string;
  action: ActionType;
  at: string;
};

const SHARE_TITLE = "우린 멈춤을 알려드립니다";
const SHARE_TEXT =
  "하고 나서 후회하는 행동들을 잠깐 생각하게 알려주는 서비스입니다.\n멈추는 것만으로도 달라집니다.";

function createUserId() {
  return `usr_${Math.random().toString(36).slice(2, 10)}${Date.now()
    .toString(36)
    .slice(-4)}`;
}

function normalizePhoneNumber(input: string) {
  return input.replace(/[^0-9]/g, "");
}

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.22 }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
}

function BodyText({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-lg text-slate-900 leading-relaxed max-w-[280px] mx-auto text-center break-keep">
      {children}
    </p>
  );
}

function SubText({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-base text-slate-700 leading-relaxed max-w-[280px] mx-auto text-center break-keep">
      {children}
    </p>
  );
}

export default function Page() {
  const [step, setStep] = useState<Step>("intro");
  const [hasMounted, setHasMounted] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [selectedBehavior, setSelectedBehavior] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [alertMethod, setAlertMethod] = useState<AlertMethod>("sms");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [interventionLine, setInterventionLine] = useState("");
  const [responseMode, setResponseMode] = useState<ActionType | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [sharePreviewOpen, setSharePreviewOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [sendingSms, setSendingSms] = useState(false);
  
const smsMessages = [
  "지금 딱 그 순간이에요 🙂\n한 번만 멈춰봐요\nhttps://loop-breaker-w9eo.vercel.app/",
  "지금이에요 🙂\n한 번만 멈춰볼까요\nhttps://loop-breaker-w9eo.vercel.app/",
];
 

  const behavior = useMemo(() => {
    return behaviors.find((item) => item.key === selectedBehavior) ?? behaviors[0];
  }, [selectedBehavior]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEYS.settings);
      const savedEvents = localStorage.getItem(STORAGE_KEYS.events);

      if (savedSettings) {
        const parsed = JSON.parse(savedSettings) as SavedSettings;
        setUserId(parsed.userId ?? null);
        setSelectedBehavior(parsed.selectedBehavior ?? null);
        setSelectedTime(parsed.selectedTime ?? null);
        setAlertMethod(parsed.alertMethod ?? "sms");
        setPhoneNumber(parsed.phoneNumber ?? "");
        setSmsConsent(Boolean(parsed.smsConsent));
        setNotificationsEnabled(Boolean(parsed.notificationsEnabled));

        if (
          parsed.selectedBehavior &&
          parsed.selectedTime &&
          parsed.phoneNumber &&
          parsed.smsConsent
        ) {
          setStep("home");
        }
      }

      if (savedEvents) {
        const parsedEvents = JSON.parse(savedEvents) as EventItem[];
        setEvents(Array.isArray(parsedEvents) ? parsedEvents : []);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEYS.settings);
      localStorage.removeItem(STORAGE_KEYS.events);
    }
  }, []);

  useEffect(() => {
    const payload: SavedSettings = {
      userId,
      selectedBehavior,
      selectedTime,
      alertMethod,
      phoneNumber,
      smsConsent,
      notificationsEnabled,
    };
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(payload));
  }, [
    userId,
    selectedBehavior,
    selectedTime,
    alertMethod,
    phoneNumber,
    smsConsent,
    notificationsEnabled,
  ]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.events, JSON.stringify(events));
  }, [events]);

  const weeklyStopCount = useMemo(() => {
    if (!userId) return 0;
    return events.filter((event) => {
      const diff = Date.now() - new Date(event.at).getTime();
      return (
        event.userId === userId &&
        event.action === "stop" &&
        diff <= 7 * 24 * 60 * 60 * 1000
      );
    }).length;
  }, [events, userId]);

  const ensureUserId = () => {
    const ensured = userId ?? createUserId();
    if (!userId) setUserId(ensured);
    return ensured;
  };

  const completeSetup = async () => {
    const cleanedPhone = normalizePhoneNumber(phoneNumber);

    if (!selectedBehavior || !selectedTime) return;
    if (cleanedPhone.length < 10 || !smsConsent) return;

    try {
      const { data, error } = await supabase
        .from("users")
  .insert([
    {
      phone_number: cleanedPhone,
      behavior_type: selectedBehavior,
      notification_time: selectedTime,
      sms_consent: smsConsent,
    },
  ])
   .select()
   .single();

   if (!data || error) {
  console.error(error);
  alert("저장 실패");
  return;
}
  
localStorage.setItem("user_id", data.id);
localStorage.setItem("phoneNumber", cleanedPhone);

if (!data || error) {
  console.error(error);
  alert("저장 실패");
  return;
}

const userId = data.id;

if (userId) {
  localStorage.setItem("user_id", userId);
  localStorage.setItem("phoneNumber", cleanedPhone);
  setUserId(userId);
}

setPhoneNumber(cleanedPhone);
setNotificationsEnabled(false);
setStep("home");
    } catch (error) {
      console.error("사용자 저장 실패", error);
      alert("저장 중 문제가 생겼습니다. 다시 시도해주세요.");
    }
  };

  const openIntervention = () => {
    setInterventionLine(pickRandom(behavior.interventionPool));
    setSharePreviewOpen(false);
    setShareMessage("");
    setStep("intervention");
  };

  const handleDecision = async (action: ActionType) => {
const ensuredUserId = ensureUserId();

  const { data, error } = await supabase
    .from("pause_logs")
    .insert([
      {
        user_id: ensuredUserId,
        behavior_type: selectedBehavior,
        action_type: action === "stop" ? "pause" : "continue",
        created_at: new Date().toISOString(),
      },
    ])
    .select();

  alert(JSON.stringify({ data, error }));

const userId = localStorage.getItem("user_id");

if (!userId) {
  alert("user_id 없음");
  return;
}

const { data: logData, error: logError } = await supabase
  .from("pause_logs")
  .insert([
    {
      user_id: userId,
      behavior_type: selectedBehavior,
      action_type: action === "stop" ? "pause" : "continue",
      created_at: new Date().toISOString(),
    },
  ])
  .select();



   
    const timestamp = new Date().toISOString();

    setResponseMode(action);
    setEvents((prev) => [
      ...prev,
      { userId: ensuredUserId, action, at: timestamp },
    ]);

    try {
      await supabase.from("pause_logs").insert([
        {
          user_id: ensuredUserId,
          behavior_type: selectedBehavior ?? behavior.key,
          action_type: action === "stop" ? "pause" : "continue",
          created_at: timestamp,
        },
      ]);
    } catch (error) {
      console.error("멈춤 기록 저장 실패", error);
    }

    setSharePreviewOpen(false);
    setShareMessage("");
    setStep("response");
  };

  const getSharePayload = () => {
    const url = typeof window !== "undefined" ? window.location.origin : "";
    return {
      title: SHARE_TITLE,
      text: SHARE_TEXT,
      url,
      fullText: `${SHARE_TEXT}\n\n${url}`,
    };
  };

  const openSharePreview = () => {
    setSharePreviewOpen(true);
    setShareMessage("");
  };

  const copyShareText = async () => {
    const payload = getSharePayload();
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(payload.fullText);
        setShareMessage("메시지와 링크를 복사해두었습니다");
        return;
      }
      setShareMessage(payload.fullText);
    } catch {
      setShareMessage("복사할 수 없어 아래 내용을 직접 사용해주세요");
    }
  };

  const sendShareNow = async () => {
    const payload = getSharePayload();
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: payload.title,
          text: payload.text,
          url: payload.url,
        });
        setShareMessage("공유 창을 열었습니다");
        return;
      }

      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(payload.fullText);
        setShareMessage("공유 창이 없어 복사해두었습니다");
        return;
      }

      setShareMessage(payload.fullText);
    } catch {
      setShareMessage("공유를 취소했거나 열 수 없었습니다");
    }
  };

  const resetAll = () => {
    localStorage.removeItem(STORAGE_KEYS.settings);
    localStorage.removeItem(STORAGE_KEYS.events);
    setUserId(null);
    setSelectedBehavior(null);
    setSelectedTime(null);
    setAlertMethod("sms");
    setPhoneNumber("");
    setSmsConsent(false);
    setNotificationsEnabled(false);
    setEvents([]);
    setInterventionLine("");
    setResponseMode(null);
    setResetConfirmOpen(false);
    setSharePreviewOpen(false);
    setShareMessage("");
    setStep("intro");
  };

  if (!hasMounted) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-slate-100 to-white text-slate-900 flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white shadow-xl p-8 text-center text-slate-600">
          불러오는 중…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-100 to-white text-slate-900 flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-md">
        <div className="rounded-[2rem] border border-slate-200 bg-white shadow-xl">
          <div className="p-7 md:p-8">
            <div className="mb-6 flex items-center justify-between text-sm text-slate-600">
              <span className="font-medium tracking-[0.18em]">LOOP BREAKER</span>
              <span>{step === "settings" ? "설정" : "MVP"}</span>
            </div>

            <AnimatePresence mode="wait">
              {step === "intro" && (
                <Screen key="intro">
                  <div className="space-y-7 py-10 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
                      <Bell className="h-8 w-8 text-slate-700" />
                    </div>

                    <div className="space-y-3">
                      <h1 className="text-[1.8rem] font-semibold tracking-tight text-slate-900 leading-relaxed">
                        우린 멈춤을 알려드립니다
                      </h1>
                      <BodyText>그 순간들이 모이면 행동의 변화가 시작됩니다</BodyText>
                    </div>

                    <button
                      className="h-14 w-full rounded-2xl bg-slate-900 text-base text-white shadow-sm hover:bg-slate-800"
                      onClick={() => setStep("behavior")}
                    >
                      시작하기
                    </button>
                  </div>
                </Screen>
              )}

              {step === "behavior" && (
                <Screen key="behavior">
                  <div className="space-y-5 py-3">
                    <div>
                      <div className="mb-2 text-sm text-slate-600">1 / 3</div>
                      <h2 className="text-2xl font-bold text-slate-900">
                        요즘 가장 자주 반복되는 행동은?
                      </h2>
                    </div>

                    <div className="space-y-3">
                      {behaviors.map((item) => (
                        <button
                          key={item.key}
                          onClick={() => {
                            setSelectedBehavior(item.key);
                            setStep("time");
                          }}
                          className="w-full rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-4 text-left text-slate-900 shadow-sm transition hover:bg-slate-100"
                        >
                          <span className="text-base font-semibold text-slate-900">
                            {item.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </Screen>
              )}

              {step === "time" && (
                <Screen key="time">
                  <div className="space-y-5 py-3">
                    <div>
                      <div className="mb-2 text-sm text-slate-600">2 / 3</div>
                      <h2 className="text-2xl font-bold text-slate-900">
                        언제 가장 흔들립니까?
                      </h2>
                    </div>

                    <div className="space-y-3">
                      {timeOptions.map((item) => (
                        <button
                          key={item.key}
                          onClick={() => {
                            setSelectedTime(item.label);
                            setStep("alerts");
                          }}
                          className="w-full rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-4 text-left text-slate-900 shadow-sm transition hover:bg-slate-100"
                        >
                          <div className="flex items-center gap-3">
                            <div className="rounded-xl border border-slate-200 bg-white p-2">
                              <Clock3 className="h-5 w-5 text-slate-700" />
                            </div>
                            <span className="text-base font-semibold text-slate-900">
                              {item.label}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </Screen>
              )}

              {step === "alerts" && (
                <Screen key="alerts">
                  <div className="space-y-6 py-9 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
                      <Bell className="h-8 w-8 text-slate-700" />
                    </div>

                    <div className="space-y-2">
                      <h2 className="text-2xl font-bold text-slate-900">
                        알림 받을 번호를 입력해 주세요
                      </h2>
                      <SubText>하루 한 번, 정한 시간에 문자로 알려드릴게요</SubText>
                    </div>

                    <div className="space-y-3 text-left">
                      <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-4">
                        <label className="block text-base text-slate-900">전화번호</label>
                        <input
                          value={phoneNumber}
                          onChange={(e) =>
                            setPhoneNumber(normalizePhoneNumber(e.target.value))
                          }
                          inputMode="numeric"
                          placeholder="숫자만 입력해주세요"
                          className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none placeholder:text-slate-400"
                        />
                      </div>

                      <label className="flex items-start gap-3 rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-4">
                        <input
                          type="checkbox"
                          checked={smsConsent}
                          onChange={(e) => setSmsConsent(e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
                        />
                        <span className="text-sm leading-relaxed text-slate-700">
                          문자 알림 수신에 동의합니다
                        </span>
                      </label>
                    </div>

                    <button
                      className="h-14 w-full rounded-2xl bg-slate-900 text-base text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={completeSetup}
                      disabled={phoneNumber.length < 10 || !smsConsent}
                    >
                      시작하기
                    </button>
                  </div>
                </Screen>
              )}

{step === "home" && (
  <Screen key="home">
    <div className="space-y-6 py-8 text-center">
     
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: savedPhone,
        text,
    }),
    });

    const result = await res.json();
    alert(JSON.stringify(result));
  }}
>
  
      </button> 
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => setStep("settings")}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-sm transition hover:bg-slate-100"
        >
          <Settings className="h-4 w-4" />
          설정
        <button
  disabled={sendingSms}
  onClick={async () => {
    if (sendingSms) return;

    const savedPhone = localStorage.getItem("phoneNumber");

    if (!savedPhone) {
      alert("저장된 전화번호가 없습니다.");
      return;
    }

    setSendingSms(true);

    try {
      const text =
        smsMessages[Math.floor(Math.random() * smsMessages.length)];

      const res = await fetch("/api/send-sms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: savedPhone,
          text,
        }),
      });

      const result = await res.json();
      alert(JSON.stringify(result));
    } catch (error) {
      alert(String(error));
    } finally {
      setSendingSms(false);
    }
  }}
  className={`w-full rounded-2xl px-4 py-3 text-base font-semibold shadow-sm ${
    sendingSms
      ? "bg-slate-300 text-white"
      : "bg-slate-900 text-white"
  }`}
>
  {sendingSms ? "보내는 중..." : "문자 테스트"}
</button>

 <button
  onClick={() => setStep("intervention")}
>       
       멈춤 테스트 진입
      </button>

      <div className="space-y-3 rounded-[1.8rem] border border-slate-200 bg-slate-50 px-6 py-8 shadow-sm">
        <p className="text-2xl font-bold text-slate-900">{behavior.displayText}</p>
        <SubText>알림으로 찾아뵐게요</SubText>
        <SubText>{selectedTime} · 문자 알림</SubText>
      </div>

     {weeklyStopCount > 0 && (
  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-6 py-6 text-center shadow-sm">
    <BodyText>이번 주, {weeklyStopCount}번 멈췄어요</BodyText>
    <p className="mt-2 text-base text-slate-700 leading-relaxed max-w-[280px] mx-auto text-center break-keep">
      그 순간들이 쌓이고 있어요
    </p>
  </div>
)}
    </div>
  </Screen>
)}

              {step === "settings" && (
                <Screen key="settings">
                  <div className="space-y-5 py-2">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">설정</h2>
                    </div>

                    <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-4 text-left text-base text-slate-900 shadow-sm">
                      <div>행동 · {behavior.label}</div>
                      <div className="mt-1">시간 · {selectedTime}</div>
                      <div className="mt-1">알림 · 문자 알림</div>
                      {phoneNumber && <div className="mt-1">전화번호 · {phoneNumber}</div>}
                    </div>

                    <div className="space-y-3">
                      <button
                        className="h-12 w-full rounded-2xl bg-slate-900 text-white shadow-sm hover:bg-slate-800"
                        onClick={() => setStep("behavior")}
                      >
                        행동 바꾸기
                      </button>
                      <button
                        className="h-12 w-full rounded-2xl bg-slate-900 text-white shadow-sm hover:bg-slate-800"
                        onClick={() => setStep("time")}
                      >
                        시간 바꾸기
                      </button>
                      <button
                        className="h-12 w-full rounded-2xl bg-slate-900 text-white shadow-sm hover:bg-slate-800"
                        onClick={() => setStep("alerts")}
                      >
                        전화번호 / 알림 정보 바꾸기
                      </button>
                    </div>

                    <div className="border-t border-slate-200 pt-4 space-y-4">
                      <button
                        onClick={() => setStep("home")}
                        className="w-full text-left text-sm text-slate-700 transition hover:text-slate-900"
                      >
                        ← 돌아가기
                      </button>

                      <button
                        className="h-12 w-full rounded-2xl border border-red-200 bg-transparent text-red-500 hover:bg-red-50"
                        onClick={() => setResetConfirmOpen(true)}
                      >
                        처음부터 다시 시작
                      </button>
                    </div>

                    {resetConfirmOpen && (
                      <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-4 shadow-sm">
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-slate-900">
                            처음부터 다시 시작할까요?
                          </h3>
                          <p className="text-base text-slate-700">
                            지금까지 설정한 내용이 사라집니다.
                          </p>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <button
                            className="h-11 w-full rounded-2xl bg-slate-200 text-slate-900 hover:bg-slate-300"
                            onClick={() => setResetConfirmOpen(false)}
                          >
                            취소
                          </button>
                          <button
                            className="h-11 w-full rounded-2xl bg-red-500 text-white hover:bg-red-400"
                            onClick={resetAll}
                          >
                            다시 시작
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </Screen>
              )}

              {step === "intervention" && (
                <Screen key="intervention">
                  <div className="space-y-6 py-8 text-center">
                    <div className="space-y-3 rounded-[1.8rem] border border-slate-200 bg-slate-50 px-6 py-6 shadow-sm">
                      <BodyText>{interventionLine}</BodyText>
                      <h2 className="text-3xl font-bold leading-tight text-slate-900">
                        지금 여기서 한 번만 멈춰볼까요?
                      </h2>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <motion.div whileTap={{ scale: 0.97 }}>
                        <button
                          className="h-16 w-full rounded-2xl bg-slate-200 text-base text-slate-900 shadow-sm hover:bg-slate-300"
                          onClick={() => handleDecision("continue")}
                        >
                          계속하기
                        </button>
                      </motion.div>

                      <motion.div
                        animate={{ scale: [1, 1.03, 1] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                        whileTap={{ scale: 0.97 }}
                      >
                        <button
                          className="h-16 w-full rounded-2xl bg-red-500 text-base font-bold text-white shadow-sm hover:bg-red-400"
                          onClick={() => handleDecision("stop")}
                        >
                          멈춤
                        </button>
                      </motion.div>
                    </div>
                  </div>
                </Screen>
              )}

              {step === "response" && (
                <Screen key="response">
                  <div className="space-y-6 py-10 text-center">
                    {!sharePreviewOpen && (
                      <>
                        <div className="space-y-3 rounded-[1.8rem] border border-slate-200 bg-slate-50 px-6 py-6 shadow-sm">
                          <h2 className="text-3xl font-bold leading-tight text-slate-900">
                            {responseMode === "stop"
                              ? behavior.actionText
                              : "알겠습니다. 잠시 후 다시 볼게요"}
                          </h2>
                        </div>

                        <div className="space-y-3">
                          <button
                            onClick={openSharePreview}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 shadow-sm transition hover:bg-slate-100"
                          >
                            <Share2 className="h-4 w-4" />
                            꼭 권하고 싶은 분께 공유해 주세요
                          </button>

                          <button
                            className="h-14 w-full rounded-2xl bg-slate-900 text-base text-white shadow-sm hover:bg-slate-800"
                            onClick={() => setStep("home")}
                          >
                            확인
                          </button>
                        </div>
                      </>
                    )}

                    {sharePreviewOpen && (
                      <div className="space-y-6 text-center py-2">
                        <p className="text-sm text-slate-600">이렇게 전해집니다</p>

                        <div className="space-y-3">
                          <p className="text-sm text-slate-500">
                            나도 써보는데 괜찮아서 공유합니다
                          </p>
                          <p className="text-lg leading-relaxed text-slate-900 max-w-[300px] mx-auto break-keep">
                            하고 나서 후회하는 행동들을
                            <br />
                            잠깐 생각하게 알려주는 서비스입니다.
                            <br />
                            멈추는 것만으로도 달라집니다.
                          </p>

                          <p className="text-sm text-slate-500 break-all">
                            {typeof window !== "undefined" ? window.location.origin : ""}
                          </p>
                        </div>

                        {shareMessage && (
                          <p className="text-sm text-slate-600">{shareMessage}</p>
                        )}

                        <div className="space-y-2">
                          <button
                            className="h-12 w-full rounded-2xl bg-slate-900 text-white shadow-sm hover:bg-slate-800"
                            onClick={sendShareNow}
                          >
                            보내기
                          </button>

                          <div className="flex gap-2">
                            <button
                              className="h-11 flex-1 rounded-2xl bg-slate-100 text-sm text-slate-700 hover:bg-slate-200"
                              onClick={copyShareText}
                            >
                              복사
                            </button>
                            <button
                              className="h-11 flex-1 rounded-2xl border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50"
                              onClick={() => {
                                setSharePreviewOpen(false);
                                setShareMessage("");
                              }}
                            >
                              닫기
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Screen>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
