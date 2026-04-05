"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Clock3, Settings, Share2 } from "lucide-react";

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

const reportPhrases = [
  "그냥 지나가지 않으셨네요",
  "한 번 돌아보셨네요",
  "잠깐 멈춰보셨네요",
  "흘려보내지 않으셨네요",
  "그대로 두지 않으셨네요",
  "멈춰서 한 번 생각해보셨네요",
] as const;

const STORAGE_KEYS = {
  settings: "loop-breaker-settings",
  events: "loop-breaker-events",
  pendingSmsLead: "loop-breaker-pending-sms-lead",
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
type AlertMethod = "app" | "sms";

type SavedSettings = {
  userId: string | null;
  selectedBehavior: string | null;
  selectedTime: string | null;
  alertMethod: AlertMethod;
  phoneNumber: string;
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
  const [alertMethod, setAlertMethod] = useState<AlertMethod>("app");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [interventionLine, setInterventionLine] = useState("");
  const [responseMode, setResponseMode] = useState<ActionType | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [sharePreviewOpen, setSharePreviewOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState("");

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
        setAlertMethod(parsed.alertMethod ?? "app");
        setPhoneNumber(parsed.phoneNumber ?? "");
        setNotificationsEnabled(Boolean(parsed.notificationsEnabled));

        if (parsed.selectedBehavior && parsed.selectedTime) {
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
      localStorage.removeItem(STORAGE_KEYS.pendingSmsLead);
    }
  }, []);

  useEffect(() => {
    const payload: SavedSettings = {
      userId,
      selectedBehavior,
      selectedTime,
      alertMethod,
      phoneNumber,
      notificationsEnabled,
    };
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(payload));
  }, [
    userId,
    selectedBehavior,
    selectedTime,
    alertMethod,
    phoneNumber,
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

  const requestAppNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationsEnabled(false);
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      const granted = permission === "granted";
      setNotificationsEnabled(granted);
      return granted;
    } catch {
      setNotificationsEnabled(false);
      return false;
    }
  };

  const savePendingSmsLead = (ensuredUserId: string) => {
    if (alertMethod !== "sms") return;

    const payload = {
      userId: ensuredUserId,
      phoneNumber,
      selectedBehavior,
      selectedTime,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEYS.pendingSmsLead, JSON.stringify(payload));
  };

  const completeSetup = async () => {
    const ensuredUserId = ensureUserId();

    if (alertMethod === "app") {
      await requestAppNotifications();
    } else {
      setNotificationsEnabled(false);
      savePendingSmsLead(ensuredUserId);
    }

    setStep("home");
  };

  const openIntervention = () => {
    setInterventionLine(pickRandom(behavior.interventionPool));
    setSharePreviewOpen(false);
    setShareMessage("");
    setStep("intervention");
  };

  const sendBrowserNotification = () => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const notice = new Notification("우린 멈춤을 알려드립니다", {
      body: pickRandom(behavior.interventionPool),
      tag: "loop-breaker-notice",
    });

    notice.onclick = () => {
      window.focus();
      openIntervention();
      notice.close();
    };
  };

  const handleDecision = (action: ActionType) => {
    const ensuredUserId = ensureUserId();
    setResponseMode(action);
    setEvents((prev) => [
      ...prev,
      { userId: ensuredUserId, action, at: new Date().toISOString() },
    ]);
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
    localStorage.removeItem(STORAGE_KEYS.pendingSmsLead);
    setUserId(null);
    setSelectedBehavior(null);
    setSelectedTime(null);
    setAlertMethod("app");
    setPhoneNumber("");
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
                      <h2 className="text-2xl font-bold text-slate-900">좋습니다</h2>
                      <SubText>정해주신 시간에 잠깐 알려드릴게요</SubText>
                    </div>

                    <div className="space-y-3 text-left">
                      <div className="text-base text-slate-900">어떻게 알려드릴까요?</div>

                      <button
                        onClick={() => setAlertMethod("app")}
                        className={`w-full rounded-[1.35rem] border px-4 py-3 text-left transition ${
                          alertMethod === "app"
                            ? "border-slate-400 bg-slate-100"
                            : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                        }`}
                      >
                        앱 알림으로 받기
                      </button>

                      <button
                        onClick={() => setAlertMethod("sms")}
                        className={`w-full rounded-[1.35rem] border px-4 py-3 text-left transition ${
                          alertMethod === "sms"
                            ? "border-slate-400 bg-slate-100"
                            : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                        }`}
                      >
                        문자로도 받아보기
                      </button>

                      {alertMethod === "sms" && (
                        <div className="space-y-2 rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-4">
                          <label className="block text-base text-slate-900">전화번호</label>
                          <input
                            value={phoneNumber}
                            onChange={(e) =>
                              setPhoneNumber(normalizePhoneNumber(e.target.value))
                            }
                            inputMode="numeric"
                            placeholder="숫자만 입력해주세요"
                            className="mt-1 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none placeholder:text-slate-400"
                          />
                          <p className="text-base text-slate-700 text-center">
                            알림에 필요한 정보만 받을게요
                          </p>
                          <p className="text-sm text-slate-600 text-center">
                            지금은 수동으로 문자를 보내며 테스트합니다
                          </p>
                        </div>
                      )}
                    </div>

                    <button
                      className="h-14 w-full rounded-2xl bg-slate-900 text-base text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={completeSetup}
                      disabled={alertMethod === "sms" && phoneNumber.length < 10}
                    >
                      시작하기
                    </button>
                  </div>
                </Screen>
              )}

              {step === "home" && (
                <Screen key="home">
                  <div className="space-y-6 py-8 text-center">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-left text-sm text-slate-700">
                        {userId ? `사용자 ID · ${userId}` : ""}
                      </div>
                      <button
                        onClick={() => setStep("settings")}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-sm transition hover:bg-slate-100"
                      >
                        <Settings className="h-4 w-4" />
                        설정
                      </button>
                    </div>

                    <div className="space-y-3 rounded-[1.8rem] border border-slate-200 bg-slate-50 px-6 py-8 shadow-sm">
                      <p className="text-2xl font-bold text-slate-900">
                        {behavior.displayText}
                      </p>
                      <SubText>알림으로 찾아뵐게요</SubText>
                      <SubText>
                        {selectedTime} · {alertMethod === "app" ? "앱 알림" : "문자 알림"}
                      </SubText>
                    </div>

                    {weeklyStopCount > 0 && (
                      <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-6 py-6 text-center shadow-sm">
                        <BodyText>
                          이번 주, {weeklyStopCount}번이나 멈추려고 했네요
                        </BodyText>
                        <p className="mt-2 text-base text-slate-700 leading-relaxed max-w-[280px] mx-auto text-center break-keep">
                          {pickRandom(reportPhrases)}
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
                      <div className="mt-1">
                        알림 · {alertMethod === "app" ? "앱 알림" : "문자 알림"}
                      </div>
                      {alertMethod === "sms" && phoneNumber && (
                        <div className="mt-1">전화번호 · {phoneNumber}</div>
                      )}
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
                        알림 방식 바꾸기
                      </button>
                      <button
                        className="h-12 w-full rounded-2xl bg-slate-900 text-white shadow-sm hover:bg-slate-800"
                        onClick={openIntervention}
                      >
                        개입 화면 테스트
                      </button>
                      {alertMethod === "app" && (
                        <button
                          className="h-12 w-full rounded-2xl bg-slate-900 text-white shadow-sm hover:bg-slate-800"
                          onClick={sendBrowserNotification}
                        >
                          앱 알림 테스트
                        </button>
                      )}
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
