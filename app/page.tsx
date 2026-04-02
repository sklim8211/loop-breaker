"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Clock3, Settings, CheckCircle2 } from "lucide-react";

const behaviors = [
  { key: "smartphone", label: "스마트폰 계속 보고 있네요" },
  { key: "delay", label: "또 미루고 있네요" },
  { key: "overeating", label: "한 입 더 먹고 있네요" },
  { key: "other", label: "나도 모르게 계속 하고 있네요" },
] as const;

const timeOptions = [
  { key: "morning", label: "오전" },
  { key: "afternoon", label: "오후" },
  { key: "night", label: "밤" },
] as const;

type Step =
  | "intro"
  | "behavior"
  | "time"
  | "permission"
  | "home"
  | "settings"
  | "intervention"
  | "response";

type ActionType = "continue" | "stop";

type EventItem = {
  action: ActionType;
  at: string;
};

type SavedSettings = {
  selectedBehavior: string | null;
  selectedTime: string | null;
  notificationsEnabled: boolean;
};

const INTERVENTION_QUESTION = "지금 여기서 한 번만 멈춰볼까요?";
const CONTINUE_MESSAGE = "알겠습니다. 잠시 후 다시 확인할게요";
const CONTINUE_SUBTEXT = "이 상태로 잠깐 두고 다시 볼게요";
const STOP_MESSAGE = "지금 멈춘 것, 잘하셨습니다";
const STOP_SUBTEXT = "이 상태로 잠깐만 있어볼까요";

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

function getNotificationMessage(timeLabel: string | null) {
  return timeLabel ? `${timeLabel}에 잠깐 알려드릴게요` : "잠깐 알려드릴게요";
}

export default function Page() {
  const [step, setStep] = useState<Step>("intro");
  const [selectedBehavior, setSelectedBehavior] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [responseMode, setResponseMode] = useState<ActionType | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);

  const behavior = useMemo(() => {
    return behaviors.find((b) => b.key === selectedBehavior) ?? behaviors[0];
  }, [selectedBehavior]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("loop-breaker-settings");
      const savedEvents = localStorage.getItem("loop-breaker-events");

      if (saved) {
        const parsed = JSON.parse(saved) as SavedSettings;
        setSelectedBehavior(parsed.selectedBehavior ?? null);
        setSelectedTime(parsed.selectedTime ?? null);
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
      localStorage.removeItem("loop-breaker-settings");
      localStorage.removeItem("loop-breaker-events");
    }
  }, []);

  useEffect(() => {
    const payload: SavedSettings = {
      selectedBehavior,
      selectedTime,
      notificationsEnabled,
    };
    localStorage.setItem("loop-breaker-settings", JSON.stringify(payload));
  }, [selectedBehavior, selectedTime, notificationsEnabled]);

  useEffect(() => {
    localStorage.setItem("loop-breaker-events", JSON.stringify(events));
  }, [events]);

  const stopCount = events.filter((e) => e.action === "stop").length;
  const totalCount = events.length;
  const progress = totalCount === 0 ? 0 : Math.round((stopCount / totalCount) * 100);

  const completeOnboarding = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const permission = await Notification.requestPermission();
        setNotificationsEnabled(permission === "granted");
      } catch {
        setNotificationsEnabled(false);
      }
    } else {
      setNotificationsEnabled(false);
    }
    setStep("home");
  };

  const handleDecision = (action: ActionType) => {
    setResponseMode(action);
    setEvents((prev) => [...prev, { action, at: new Date().toISOString() }]);
    setStep("response");
  };

  const resetAll = () => {
    localStorage.removeItem("loop-breaker-settings");
    localStorage.removeItem("loop-breaker-events");
    setSelectedBehavior(null);
    setSelectedTime(null);
    setNotificationsEnabled(false);
    setResponseMode(null);
    setShowResetConfirm(false);
    setNotificationMessage(null);
    setEvents([]);
    setStep("intro");
  };

  const confirmReset = () => setShowResetConfirm(true);
  const cancelReset = () => setShowResetConfirm(false);
  const proceedReset = () => {
    setShowResetConfirm(false);
    resetAll();
  };

  const sendBrowserNotification = (title: string, body: string) => {
    if (typeof window === "undefined") return;
    if (!( "Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    new Notification(title, { body });
  };

  const scheduleDemoNotification = (seconds = 5) => {
    setNotificationMessage(`테스트 알림이 약 ${seconds}초 뒤 도착합니다`);
    window.setTimeout(() => {
      sendBrowserNotification("지금 잠깐 볼까요", behavior.label);
      setNotificationMessage("알림이 발송되었습니다. 브라우저 알림을 확인해보세요.");
    }, seconds * 1000);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-900 to-slate-800 text-white flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-md">
        <div className="rounded-[2rem] border border-slate-600/60 bg-slate-800/90 shadow-2xl backdrop-blur-xl">
          <div className="p-7 md:p-8">
            <div className="mb-6 flex items-center justify-between text-sm text-slate-400">
              <span className="font-medium tracking-[0.18em]">LOOP BREAKER</span>
              <span>{step === "home" ? "대기 상태" : step === "settings" ? "설정" : "MVP"}</span>
            </div>

            <AnimatePresence mode="wait">
              {step === "intro" && (
                <Screen key="intro">
                  <div className="space-y-7 py-10">
                    <div className="space-y-4 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-600/60 bg-slate-700/40 shadow-lg">
                        <Bell className="h-8 w-8 text-slate-100" />
                      </div>

                      <div className="space-y-1">
                        <motion.h1
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.28 }}
                          className="text-[1.65rem] font-semibold tracking-tight text-slate-200 leading-relaxed"
                        >
                          지금 그 행동,
                        </motion.h1>
                        <motion.h1
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.28, duration: 0.28 }}
                          className="text-[1.65rem] font-semibold tracking-tight text-slate-50 leading-relaxed"
                        >
                          잠깐 멈춰볼까요
                        </motion.h1>
                      </div>

                      <p className="text-sm text-slate-300">딱 15초면 시작됩니다</p>
                    </div>

                    <button
                      className="h-14 w-full rounded-2xl bg-slate-700 text-base text-white shadow-lg hover:bg-slate-600"
                      onClick={() => setStep("behavior")}
                    >
                      바로 시작
                    </button>
                  </div>
                </Screen>
              )}

              {step === "behavior" && (
                <Screen key="behavior">
                  <div className="space-y-5 py-3">
                    <div>
                      <div className="mb-2 text-sm text-slate-400">1 / 3</div>
                      <h2 className="text-2xl font-bold text-slate-100">요즘 가장 자주 반복되는 행동은?</h2>
                      <p className="mt-2 text-sm text-slate-300">지금 가장 걸리는 것 하나만 골라주세요</p>
                    </div>

                    <div className="space-y-3">
                      {behaviors.map((item) => (
                        <button
                          key={item.key}
                          onClick={() => {
                            setSelectedBehavior(item.key);
                            setStep("time");
                          }}
                          className="w-full rounded-[1.35rem] border border-slate-600/70 bg-slate-800/80 px-4 py-4 text-left text-white shadow-lg transition hover:border-slate-500 hover:bg-slate-700/90"
                        >
                          <span className="text-base font-semibold text-slate-50">{item.label}</span>
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
                      <div className="mb-2 text-sm text-slate-400">2 / 3</div>
                      <h2 className="text-2xl font-bold text-slate-100">언제 가장 흔들립니까?</h2>
                      <p className="mt-2 text-sm text-slate-300">안내 시간을 맞추기 위해 묻습니다</p>
                    </div>

                    <div className="space-y-3">
                      {timeOptions.map((item) => (
                        <button
                          key={item.key}
                          onClick={() => {
                            setSelectedTime(item.label);
                            setStep("permission");
                          }}
                          className="w-full rounded-[1.35rem] border border-slate-600/70 bg-slate-800/80 px-4 py-4 text-left text-white shadow-lg transition hover:border-slate-500 hover:bg-slate-700/90"
                        >
                          <div className="flex items-center gap-3">
                            <div className="rounded-xl border border-slate-600/70 bg-slate-900/80 p-2">
                              <Clock3 className="h-5 w-5 text-slate-100" />
                            </div>
                            <span className="text-base font-semibold text-slate-50">{item.label}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </Screen>
              )}

              {step === "permission" && (
                <Screen key="permission">
                  <div className="space-y-6 py-9 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-600/60 bg-slate-700/40 shadow-lg">
                      <Bell className="h-8 w-8 text-slate-100" />
                    </div>

                    <div className="space-y-2">
                      <h2 className="text-2xl font-bold text-slate-100">좋습니다</h2>
                      <p className="text-slate-300">{getNotificationMessage(selectedTime)}</p>
                    </div>

                    <button
                      className="h-14 w-full rounded-2xl bg-slate-700 text-base text-white shadow-lg hover:bg-slate-600"
                      onClick={completeOnboarding}
                    >
                      알림 허용하고 시작
                    </button>
                  </div>
                </Screen>
              )}

              {step === "home" && (
                <Screen key="home">
                  <div className="space-y-5 py-2">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => setStep("settings")}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-600/70 bg-slate-800/70 px-3 py-2 text-sm text-slate-200 shadow-lg transition hover:bg-slate-700/80"
                      >
                        <Settings className="h-4 w-4" />
                        설정
                      </button>
                    </div>

                    <div className="rounded-[1.8rem] border border-slate-600/70 bg-gradient-to-b from-slate-700/70 to-slate-900 p-5 shadow-xl">
                      <div className="text-sm text-slate-300">설정된 안내</div>
                      <div className="mt-2 space-y-1">
                        <div className="text-lg font-semibold text-slate-50">{behavior.label}</div>
                        <div className="text-sm text-slate-300">
                          {selectedTime} · 알림 {notificationsEnabled ? "켜짐" : "꺼짐"}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 rounded-[1.8rem] border border-slate-600/70 bg-slate-900/80 p-4 shadow-lg">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">오늘 멈춤 비율</span>
                        <span className="font-semibold text-slate-50">{progress}%</span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-700">
                        <div
                          className="h-full rounded-full bg-slate-300 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm text-slate-300">
                        <span>총 반응 {totalCount}회</span>
                        <span>멈춤 {stopCount}회</span>
                      </div>
                    </div>

                    <button
                      className="h-16 w-full rounded-[1.8rem] bg-red-500 text-lg font-bold text-white shadow-xl hover:bg-red-400"
                      onClick={() => setStep("intervention")}
                    >
                      지금 살펴보기
                    </button>
                  </div>
                </Screen>
              )}

              {step === "settings" && (
                <Screen key="settings">
                  <div className="space-y-5 py-2">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-100">설정</h2>
                      <p className="mt-2 text-sm text-slate-300">지금 필요한 변경만 할 수 있습니다</p>
                    </div>

                    <div className="space-y-3">
                      <button
                        className="h-12 w-full rounded-2xl bg-slate-700 text-white shadow-lg hover:bg-slate-600"
                        onClick={() => setStep("behavior")}
                      >
                        행동 바꾸기
                      </button>
                      <button
                        className="h-12 w-full rounded-2xl bg-slate-700 text-white shadow-lg hover:bg-slate-600"
                        onClick={() => setStep("time")}
                      >
                        시간 바꾸기
                      </button>
                      <button
                        className="h-12 w-full rounded-2xl bg-slate-700 text-white shadow-lg hover:bg-slate-600"
                        onClick={() => scheduleDemoNotification()}
                      >
                        테스트 알림 보내기
                      </button>
                    </div>

                    <div className="border-t border-slate-600/50 pt-4 space-y-4">
                      <button
                        onClick={() => setStep("home")}
                        className="w-full text-left text-sm text-slate-300 transition hover:text-white"
                      >
                        ← 돌아가기
                      </button>

                      <button
                        className="h-12 w-full rounded-2xl border border-red-400/40 bg-transparent text-red-200 hover:bg-red-500/10"
                        onClick={confirmReset}
                      >
                        처음부터 다시 시작
                      </button>
                    </div>

                    {notificationMessage && (
                      <div className="rounded-[1.25rem] border border-slate-600/60 bg-slate-900/85 p-4 text-sm text-slate-300 shadow-lg">
                        {notificationMessage}
                      </div>
                    )}

                    {showResetConfirm && (
                      <div className="rounded-[1.5rem] border border-red-400/30 bg-slate-900/90 p-4 shadow-xl">
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-slate-50">처음부터 다시 시작할까요?</h3>
                          <p className="text-sm text-slate-300">지금까지 설정한 내용이 사라집니다.</p>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <button
                            className="h-11 w-full rounded-2xl bg-slate-700 text-white hover:bg-slate-600"
                            onClick={cancelReset}
                          >
                            취소
                          </button>
                          <button
                            className="h-11 w-full rounded-2xl bg-red-500 text-white hover:bg-red-400"
                            onClick={proceedReset}
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
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-600/60 bg-red-500/10 shadow-lg">
                      <CheckCircle2 className="h-8 w-8 text-slate-100" />
                    </div>

                    <div className="space-y-3 rounded-[1.8rem] border border-slate-600/60 bg-slate-800/75 px-5 py-6 shadow-xl">
                      <p className="text-lg text-slate-300">{behavior.label}</p>
                      <h2 className="text-3xl font-bold leading-tight text-slate-50">{INTERVENTION_QUESTION}</h2>
                      <p className="text-sm text-slate-400">지금 한 번 선택하시면 됩니다</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <motion.div whileTap={{ scale: 0.97 }}>
                        <button
                          className="h-16 w-full rounded-2xl bg-slate-700 text-base text-white shadow-lg hover:bg-slate-600"
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
                          className="h-16 w-full rounded-2xl bg-red-500 text-base font-bold text-white shadow-xl hover:bg-red-400"
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
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/15 shadow-lg">
                      <CheckCircle2 className="h-8 w-8 text-slate-50" />
                    </div>

                    <div className="space-y-2 rounded-[1.8rem] border border-slate-600/60 bg-slate-800/75 px-5 py-6 shadow-xl">
                      <h2 className="text-3xl font-bold text-slate-50">
                        {responseMode === "stop" ? STOP_MESSAGE : CONTINUE_MESSAGE}
                      </h2>
                      <p className="text-sm text-slate-400">
                        {responseMode === "stop" ? STOP_SUBTEXT : CONTINUE_SUBTEXT}
                      </p>
                    </div>

                    <button
                      className="h-14 w-full rounded-2xl bg-slate-700 text-base text-white shadow-lg hover:bg-slate-600"
                      onClick={() => setStep("home")}
                    >
                      확인
                    </button>
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