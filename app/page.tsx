"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Clock3, Settings, Share2 } from "lucide-react";
import { supabase } from "../lib/supabase";

const faqItems = [
  {
    q: "알림은 하루 몇 번 오나요?",
    a: "하루 한 번 오전 10시, 오후 14시, 밤 20시 정한 시간에 알림문자 드려요.",
  },
  {
    q: "번호는 어디에 쓰이나요?",
    a: "알림 문자 발송에만 사용돼요. 다른 용도로는 쓰지 않아요.",
  },
  {
    q: "알림을 바꾸거나 멈추고 싶어요",
    a: "설정에서 행동, 시간, 전화번호를 언제든 바꾸실 수 있어요.",
  },
  {
    q: "무료 기간이 뭔가요?",
    a: "처음 2주는 무료로 받아보실 수 있어요. 이후에는 월 2,900원으로 이어가실 수 있어요.",
  },
  {
    q: "유료는 얼마예요?",
    a: "월 2,900원이에요. 커피 한 잔보다 조금 싸요.",
  },
  {
    q: "행동을 바꾸면 어떻게 되나요?",
    a: "'처음부터 다시 시작'을 누르면 지금까지의 기록이 모두 사라져요. 새로운 행동으로 처음부터 시작하게 돼요. 신중하게 선택해 주세요.",
  },
] as const;

const continuePhrases = [
  "지금 선택도 괜찮아요",
  "그것도 선택이니까요",
  "괜찮아요, 다음에 다시 보면 돼요",
  "오늘은 여기까지도 충분해요",
] as const;
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
    actionText: "지금 내려놓고 있어도 괜찮아요",
    responsePool: [
     "지금 내려놓고 있어도 괜찮아요",
     "손이 가기 전에 한번 멈춰볼까요",
     "지금 안 봐도 아무 일 안 생겨요",
    ],
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
    actionText: "가장 쉬운 것부터 해봐요",
    responsePool: [
    "가장 쉬운 것부터 해봐요",
    "지금 바로 할 수 있는 것부터 해봐요",
    ],
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
    actionText: "더 안 먹어도 이미 충분해요",
    responsePool: [
     "여기서 숟가락 잠깐 내려놔요",
     "지금 멈추면 충분합니다",
     "더 안 먹어도 이미 충분해요",
    ],
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
    actionText: "그만해도 아무 문제 없어요",
    responsePool: [
    "지금 하던 거 잠깐 멈춰요",
    "그만해도 아무 문제 없어요",
    "여기서 멈추는 선택도 있어요",
    ],
    displayText: "직접 입력한 행동",
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
  | "intro2"
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
  customBehavior: string;
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
  const [customBehavior, setCustomBehavior] = useState("");
  const [showCustomBehaviorInput, setShowCustomBehaviorInput] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [alertMethod, setAlertMethod] = useState<AlertMethod>("sms");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [interventionLine, setInterventionLine] = useState("");
  const [responseLine, setResponseLine] = useState("");
  const [continueLine, setContinueLine] = useState("");
  const [responseMode, setResponseMode] = useState<ActionType | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [sharePreviewOpen, setSharePreviewOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const autoHandledRef = useRef(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [totalStopCount, setTotalStopCount] = useState(0);
  const [joinedAt, setJoinedAt] = useState<string | null>(null);

  const behavior = useMemo(() => {
   return behaviors.find((item) => item.key === selectedBehavior) ?? behaviors[0];
  }, [selectedBehavior]);
  const effectiveBehaviorLabel =
  selectedBehavior === "other" && customBehavior.trim()
    ? customBehavior.trim()
    : behavior.label;

const effectiveDisplayText =
  selectedBehavior === "other" && customBehavior.trim()
    ? customBehavior.trim()
    : behavior.displayText;

  useEffect(() => {
    setHasMounted(true);
  }, []);

useEffect(() => {
  const run = async () => {
    if (typeof window === "undefined") return;
    if (autoHandledRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const isAuto = params.get("auto") === "1";
    const uid = params.get("uid");

    if (!isAuto || !uid) return;

    autoHandledRef.current = true;

    const { data, error } = await supabase
      .from("users")
      .select("id, behavior_type, custom_behavior, notification_time, phone_number, sms_consent, is_paid, trial_started_at, created_at")
      .eq("id", uid)
      .single();

    if (error || !data) {
      console.error("자동 진입 사용자 조회 실패", error);
      setStep("intro");
      return;
    }

    setUserId(data.id);
    setSelectedBehavior(data.behavior_type ?? null);
    setCustomBehavior(data.custom_behavior ?? "");
    setSelectedTime(data.notification_time ?? null);
    setPhoneNumber(data.phone_number ?? "");
    setSmsConsent(Boolean(data.sms_consent));

   
    setSharePreviewOpen(false);
    setShareMessage("");

    // 2주 무료 기간 체크
    const trialStart = data.trial_started_at
      ? new Date(data.trial_started_at)
      : new Date(data.created_at);
    const daysSinceTrial = Math.floor(
      (Date.now() - trialStart.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (!data.is_paid && daysSinceTrial >= 14) {
      window.location.href = `/payment?uid=${data.id}`;
      return;
    }

    const behaviorData = behaviors.find((b) => b.key === data.behavior_type);
    if (data.behavior_type === "other" && data.custom_behavior?.trim()) {
      setInterventionLine(`지금 ${data.custom_behavior.trim()} 하고 있네요`);
    } else if (behaviorData) {
      setInterventionLine(pickRandom(behaviorData.interventionPool));
    }

    setStep("intervention");
  };

  run();
}, []);

useEffect(() => {
  if (!userId) return;
  const fetchUserStats = async () => {
    const { data } = await supabase
      .from("users")
      .select("created_at")
      .eq("id", userId)
      .single();
    if (data?.created_at) setJoinedAt(data.created_at);

    const { data: logs } = await supabase
      .from("pause_logs")
      .select("action_type")
      .eq("user_id", userId);
    const total = logs?.filter((x) => x.action_type === "pause").length ?? 0;
    setTotalStopCount(total);
  };
  fetchUserStats();
}, [userId]);
  const currentBehavior =
    behaviors.find((item) => item.key === selectedBehavior) ?? behaviors[0];

 
useEffect(() => {
  try {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const isAuto = params.get("auto") === "1";

    const savedSettings = localStorage.getItem(STORAGE_KEYS.settings);
    const savedEvents = localStorage.getItem(STORAGE_KEYS.events);

    if (savedSettings && !isAuto) {
      const parsed = JSON.parse(savedSettings) as SavedSettings;
      setUserId(parsed.userId ?? null);
      setSelectedBehavior(parsed.selectedBehavior ?? null);
      setSelectedTime(parsed.selectedTime ?? null);
      setAlertMethod(parsed.alertMethod ?? "sms");
      setPhoneNumber(parsed.phoneNumber ?? "");
      setCustomBehavior(parsed.customBehavior ?? "");
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
      customBehavior,
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
    customBehavior,
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
    if (selectedBehavior === "other" && !customBehavior.trim()) return;

    try {
      const { data, error } = await supabase
  .from("users")
  .upsert(
    {
      phone_number: cleanedPhone,
      behavior_type: selectedBehavior,
      custom_behavior:
        selectedBehavior === "other" ? customBehavior.trim() : null,
      notification_time: selectedTime,
      sms_consent: smsConsent,
    },
    {
      onConflict: "phone_number",
    }
  )
  .select()
  .single();

if (error || !data) throw error ?? new Error("사용자 저장 실패");
localStorage.setItem("user_id", data.id);
setUserId(data.id);

      setPhoneNumber(cleanedPhone);
      setNotificationsEnabled(false);
      setStep("home");
    } catch (error) {
      console.error("사용자 저장 실패", error);
      alert("저장 중 문제가 생겼습니다. 다시 시도해주세요.");
    }
  };

  const openIntervention = () => {
    if (selectedBehavior === "other" && customBehavior.trim()) {
      setInterventionLine(`지금 ${customBehavior.trim()} 하고 있네요`);
    } else {
      setInterventionLine(pickRandom(behavior.interventionPool));
    }
    setSharePreviewOpen(false);
    setShareMessage("");
    setStep("intervention");
  };

  const handleDecision = async (action: ActionType) => {
    const ensuredUserId = ensureUserId();
    const timestamp = new Date().toISOString();
    const behavior =
  behaviors.find((b) => b.key === selectedBehavior) ?? behaviors[0];

  if (!selectedBehavior) {
  setStep("intro");
  return;
 }
setResponseMode(action);

if (action === "stop") {
  const responseSource = Array.isArray((behavior as any).responsePool)
    ? (behavior as any).responsePool
    : [];

  const fallbackResponse =
  selectedBehavior === "other" && customBehavior.trim()
    ? "지금 멈춘 것만으로도 충분합니다"
    : (behavior as any).actionText ||
      (behavior as any).displayText ||
      (behavior as any).label ||
      "";

  const randomResponse =
    responseSource.length > 0
      ? responseSource[Math.floor(Math.random() * responseSource.length)]
      : fallbackResponse;

  setResponseLine(randomResponse);
  setContinueLine("");
} else {
  setResponseMode("continue");

  const randomContinue =
    continuePhrases[
      Math.floor(Math.random() * continuePhrases.length)
    ];
  setContinueLine(randomContinue);
  setResponseLine("");
}
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
    setResponseMode(null);
    setResetConfirmOpen(false);
    setSharePreviewOpen(false);
    setShareMessage("");
    setStep("intro");
  };

  if (!hasMounted) {
    return (
      <div className={`min-h-screen w-full text-slate-900 flex items-center justify-content p-4 md:p-6 transition-colors duration-500 ${step === "intervention" ? "bg-gradient-to-b from-red-50 to-white" : "bg-gradient-to-b from-slate-100 to-white"}`}>
        <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white shadow-xl p-8 text-center text-slate-600">
          불러오는 중…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-100 to-white text-slate-900 flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-md">
        <div className={`rounded-[2rem] border shadow-xl ${
          step === "intro" || step === "intro2"
           ? "bg-[#e8eeea] border-[#d8e8dc]"
           : "bg-white border-slate-200"
         }`}>
          <div className="p-7 md:p-8">
            <div className="mb-6 flex items-center justify-between text-sm text-slate-600">
              <span className="font-medium tracking-[0.18em]">LOOP BREAKER</span>
              <span>{step === "settings" ? "설정" : ""}</span>
            </div>

            <AnimatePresence mode="wait">

              {step === "intro" && (
               <Screen key="intro">
    <div className="space-y-7 py-10 text-center" style={{background: "#e8eeea", margin: "-28px", padding: "40px 28px", borderRadius: "2rem"}}>
      <div className="space-y-6">
        <p style={{fontSize: "13px", color: "#4a6b52", letterSpacing: "0.08em"}}>
          하고 나서 후회하는 행동들
        </p>
        <h1 style={{fontSize: "1.7rem", fontWeight: "700", color: "#1a2a1e", lineHeight: "1.4"}}>
          멈추고 싶었던 적<br />있으신가요?
        </h1>

        <p style={{fontSize: "15px", color: "#2d4a35", lineHeight: "1.9"}}>
          행동은 의지가 약해서가 아니라<br />
          <span style={{color: "#1a2a1e", fontWeight: "600"}}>생각하기 전에 자동으로</span> 시작됩니다
        </p>

        <p style={{fontSize: "15px", color: "#2d4a35", lineHeight: "1.9"}}>
          그래서 필요한 건 그 순간<br />
          <span style={{color: "#dc2626", fontWeight: "700"}}>단 한 번의 멈춤</span>입니다
        </p>

        <div style={{background: "#d8e8dc", borderRadius: "1.25rem", border: "0.5px solid #c8dcc8", padding: "16px", textAlign: "left"}}>
          <p style={{fontSize: "14px", fontWeight: "600", color: "#1a2a1e", margin: "0 0 6px"}}>
            왜 효과가 있을까요?
          </p>
          <p style={{fontSize: "13px", color: "#2d4a35", lineHeight: "1.7", margin: 0}}>
            짧은 개입의 반복이 자기통제를<br />
            강화할 수 있다고 봅니다
          </p>
          <p style={{fontSize: "12px", color: "#4a6b52", margin: "6px 0 0"}}>
            Baumeister, Muraven 연구 기반
          </p>
        </div>
      </div>

      <button
        style={{width: "100%", height: "56px", background: "#1a2a1e", color: "#e8eeea", border: "none", borderRadius: "1rem", fontSize: "15px", fontWeight: "500", cursor: "pointer"}}
        onClick={() => setStep("intro2")}
      >
        이 서비스 보기
      </button>
    </div>
  </Screen>
)}
                
{step === "intro2" && (
  <Screen key="intro2">
    <div className="space-y-7 py-10 text-center" style={{background: "#e8eeea", margin: "-28px", padding: "40px 28px", borderRadius: "2rem"}}>
      <div className="space-y-7">
        <div>
          <p style={{fontSize: "20px", fontWeight: "700", letterSpacing: "0.22em", color: "#1a2a1e", margin: "0 0 8px"}}>
            LOOP BREAKER
          </p>
          <p style={{fontSize: "14px", color: "#4a6b52", letterSpacing: "0.06em", margin: 0}}>
            우리는 멈춤을 알려드립니다
          </p>
        </div>
        <div style={{width: "28px", height: "1px", background: "#a8c8ac", margin: "0 auto"}} />
        <div style={{display: "flex", flexDirection: "column", gap: "16px"}}>
          <p style={{fontSize: "15px", color: "#2d4a35", lineHeight: "1.9", margin: 0}}>
            멈추는 순간은 아주 짧습니다
          </p>
          <p style={{fontSize: "15px", color: "#2d4a35", lineHeight: "1.9", margin: 0}}>
            하지만 그 <span style={{color: "#1a2a1e", fontWeight: "700"}}>짧은 멈춤</span>이 쌓이면<br />
            <span style={{color: "#1a2a1e", fontWeight: "700"}}>변화</span>가 시작됩니다
          </p>
          <p style={{fontSize: "15px", color: "#2d4a35", lineHeight: "1.9", margin: 0}}>
            우리는 그 <span style={{color: "#1a2a1e", fontWeight: "700"}}>변화</span>를<br />
            당신의 <span style={{color: "#1a2a1e", fontWeight: "700"}}>일상</span> 안에서 만들고자 합니다
          </p>
        </div>
      </div>
      <button
        style={{width: "100%", height: "56px", background: "#1a2a1e", color: "#e8eeea", border: "none", borderRadius: "1rem", fontSize: "15px", fontWeight: "500", cursor: "pointer"}}
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
                      요즘 하고 나면 후회되는
                      <br />
                      멈추고 싶은 행동이 있나요?
                    </h2>
                    </div>

                    <div className="space-y-3">
                      {behaviors.map((item) => (
                        <button
                          key={item.key}
                          onClick={() => {
                          if (item.key === "other") {
                           setSelectedBehavior("other");
                           setShowCustomBehaviorInput(true);
                           return;
                          }

                           setSelectedBehavior(item.key);
                           setCustomBehavior("");
                           setShowCustomBehaviorInput(false);
                           setStep("time");
                          }}          
                          className="w-full rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-4 text-left text-slate-900 shadow-sm transition hover:bg-slate-100"
                        >
                          <span className="text-base font-semibold text-slate-900">
                            {item.label}
                          </span>
                        </button>
                      ))}
{showCustomBehaviorInput && (
  <div className="space-y-3 rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-4 text-left shadow-sm">
    <label className="block text-base font-semibold text-slate-900">
      어떤 행동을 멈추고 싶으신가요?
    </label>

    <input
      value={customBehavior}
      onChange={(e) => setCustomBehavior(e.target.value)}
      placeholder="예: 유튜브 쇼츠 계속 보기"
      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none placeholder:text-slate-400"
    />

    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => {
          setShowCustomBehaviorInput(false);
          setCustomBehavior("");
          setSelectedBehavior(null);
        }}
        className="h-11 flex-1 rounded-2xl bg-slate-200 text-slate-900 hover:bg-slate-300"
      >
        취소
      </button>

      <button
        type="button"
        disabled={!customBehavior.trim()}
        onClick={() => {
          if (!customBehavior.trim()) return;
          setStep("time");
        }}
        className="h-11 flex-1 rounded-2xl bg-slate-900 text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        다음
      </button>
    </div>
  </div>
)}

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
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => setStep("settings")}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-sm transition hover:bg-slate-100"
        >
          <Settings className="h-4 w-4" />
          설정
        </button>
      </div>

      <div className="space-y-3 rounded-[1.8rem] border border-slate-200 bg-slate-50 px-6 py-8 shadow-sm">
        <p className="text-2xl font-bold text-slate-900">{effectiveDisplayText}</p>
        <SubText>알림으로 찾아뵐게요</SubText>
        <SubText>{selectedTime} · 문자 알림</SubText>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-6 text-center shadow-sm">
          <p className="text-3xl font-bold text-slate-900">{totalStopCount}</p>
          <p className="mt-2 text-sm text-slate-600">총 멈춤</p>
        </div>
        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-6 text-center shadow-sm">
          <p className="text-3xl font-bold text-slate-900">
            {joinedAt
              ? Math.floor(
                  (Date.now() - new Date(joinedAt).getTime()) /
                    (1000 * 60 * 60 * 24)
                ) + 1
              : 1}
          </p>
          <p className="mt-2 text-sm text-slate-600">함께한 일수</p>
        </div>
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
        <div>행동 · {effectiveBehaviorLabel}</div>
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

        {/* FAQ */}
        <div>
          <button
            onClick={() => setFaqOpen((prev) => !prev)}
            className="flex w-full items-center justify-between text-sm text-slate-600 hover:text-slate-900 transition"
          >
            <span>자주 묻는 것들</span>
            <span className={`text-xs transition-transform duration-200 ${faqOpen ? "rotate-180" : ""}`}>
              ▼
            </span>
          </button>

          {faqOpen && (
            <div className="mt-3 space-y-2">
              {faqItems.map((item, i) => (
                <div
                  key={i}
                  className="rounded-[1.1rem] border border-slate-200 bg-slate-50 overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setOpenFaqIndex((prev) => (prev === i ? null : i))
                    }
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-900"
                  >
                    <span>{item.q}</span>
                    <span
                      className={`ml-2 flex-shrink-0 text-slate-400 transition-transform duration-200 ${
                        openFaqIndex === i ? "rotate-45" : ""
                      }`}
                    >
                      +
                    </span>
                  </button>
                  {openFaqIndex === i && (
                    <div className="border-t border-slate-200 px-4 py-3 text-sm text-slate-600 leading-relaxed">
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

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
                  <div className="space-y-8 py-8 text-center">
                    <div className="space-y-5 px-2 py-4">
                      <p className="text-base text-slate-500 leading-relaxed">{interventionLine}</p>
                      <h2 className="text-3xl font-bold leading-tight text-slate-900">
                        지금 여기서<br />한 번만<br />멈춰볼까요?
                      </h2>
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                      <motion.div
                        animate={{ scale: [1, 1.03, 1] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                        whileTap={{ scale: 0.97 }}
                      >
                        <button
                          className="h-20 w-full rounded-2xl bg-red-500 text-xl font-bold text-white shadow-sm hover:bg-red-400"
                          onClick={() => handleDecision("stop")}
                        >
                          멈춤
                        </button>
                      </motion.div>

                      <motion.div whileTap={{ scale: 0.97 }}>
                        <button
                          className="h-11 w-full rounded-2xl border border-slate-200 bg-transparent text-sm text-slate-500 hover:bg-slate-50"
                          onClick={() => handleDecision("continue")}
                        >
                          계속하기
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
                            {responseMode === "stop" ? responseLine : continueLine}
                          </h2>
                        </div>

                        <div className="space-y-3">
                          <button
                            onClick={openSharePreview}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 shadow-sm transition hover:bg-slate-100"
                          >
                            <Share2 className="h-4 w-4" />
                            이 경험, 필요한 분께 전해주세요
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
      <p className="text-lg leading-relaxed text-slate-900 max-w-[300px] mx-auto break-keep">
        하고 나서 후회하는 행동,<br />
        멈추고 싶은데 계속 하게 되는 순간들.<br />
        <br />
        그 순간에 한 번만 멈추게 해주는 서비스예요.<br />
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
