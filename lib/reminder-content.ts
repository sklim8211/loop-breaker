/** Shared copy for daily reminders and the link arrival screen. */
const reminderContent = {
  smartphone: {
    goal: "스마트폰 덜 보기",
    moments: [
      { wit: "‘잠깐만’의 다음 편은 끝이 없죠.", trigger: "다음 화면을 넘기기 전에, 잠깐 내려놓아볼까요?" },
      { wit: "화면 밖에도 다음 장면이 있대요.", trigger: "고개를 들고 주변을 한번 둘러볼까요?" },
      { wit: "스크롤에도 쉬는 시간이 있으면 좋겠죠.", trigger: "지금 보려던 것만 보고, 화면을 닫아볼까요?" },
      { wit: "손보다 생각이 한발 먼저 가볼까요?", trigger: "앱을 열기 전에, 지금 필요한지 잠깐 떠올려봐요." },
    ],
  },
  delay: {
    goal: "할 일 미루지 않기",
    moments: [
      { wit: "‘조금 있다가’가 오늘도 시간을 예약했나요?", trigger: "오늘 하려던 일, 필요한 화면 하나만 열어볼까요?" },
      { wit: "완벽한 시작은 아직 준비 중인가요?", trigger: "완성 말고, 첫 줄만 적어봐도 좋아요." },
      { wit: "시작 전 회의가 길어지고 있군요.", trigger: "생각해둔 일에 딱 1분만 손대볼까요?" },
      { wit: "오늘의 첫 장면, 예고편만 보긴 아쉽죠.", trigger: "가장 쉽게 손댈 수 있는 부분부터 시작해봐요." },
    ],
  },
  overeating: {
    goal: "과식 줄이기",
    moments: [
      { wit: "다음 한 입에도 잠깐의 쉼표를.", trigger: "한 입 더 먹기 전에, 지금 배가 어떤지 느껴봐요." },
      { wit: "맛의 의견은 들었으니, 배의 의견도 들어볼까요?", trigger: "잠깐 손을 쉬고, 더 먹고 싶은지 살펴봐요." },
      { wit: "맛있는 순간도 천천히 보면 더 길죠.", trigger: "다음 한 입은 천천히 맛보면 어떨까요?" },
      { wit: "한 입 더와 나 사이에, 잠깐.", trigger: "내가 정한 식사 습관을 한번 떠올려봐요." },
    ],
  },
  other: {
    goal: "내가 정한 행동 떠올리기",
    moments: [
      { wit: "내가 고른 방향, 잠깐 다시 볼까요?", trigger: "지금 할 수 있는 작은 행동 하나만 떠올려봐요." },
      { wit: "익숙한 흐름에도 쉼표 하나쯤은요.", trigger: "내가 정한 행동을 지금의 선택에 한번 비춰봐요." },
      { wit: "자동모드에 잠깐 말 걸러 왔어요.", trigger: "내가 원했던 쪽으로 작은 선택 하나를 해볼까요?" },
      { wit: "오늘도 내 선택을 꺼내볼 시간이에요.", trigger: "한꺼번에 바꾸기보다, 지금 할 수 있는 만큼만 해봐요." },
    ],
  },
} as const;

export function getReminderContent(behavior: string | null | undefined, customGoal: string | null | undefined, seed: string) {
  const key = behavior && Object.hasOwn(reminderContent, behavior)
    ? behavior as keyof typeof reminderContent : "other";
  const content = reminderContent[key];
  let hash = 0;
  for (const char of seed) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return {
    goal: key === "other" && customGoal?.trim() ? customGoal.trim() : content.goal,
    ...content.moments[hash % content.moments.length],
  };
}

export function formatReminder(reminder: ReturnType<typeof getReminderContent>, line: string = reminder.wit) {
  return `내가 정한 행동 · ${reminder.goal}\n\n${line}\n${reminder.trigger}`;
}
