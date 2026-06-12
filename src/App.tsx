import {
  Archive,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Edit3,
  GripVertical,
  Lightbulb,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

type Task = {
  id: string;
  text: string;
  done: boolean;
};

type ScheduleItem = {
  id: string;
  time: string;
  text: string;
};

type WinItem = {
  id: string;
  text: string;
};

type TodayData = {
  theme: string;
  tasks: Task[];
  schedules: ScheduleItem[];
  memo: string;
  wins: WinItem[];
};

type DayRecord = {
  id: string;
  dateLabel: string;
  createdAt: number;
  data: TodayData;
};

type AppState = {
  today: TodayData;
  records: DayRecord[];
};

type TaskDraft = {
  text: string;
  editId: string | null;
};

type ScheduleDraft = {
  time: string;
  text: string;
  editId: string | null;
};

type WinDraft = {
  text: string;
  editId: string | null;
};

type RecordDraft = {
  id: string;
  dateLabel: string;
  theme: string;
  tasksText: string;
  schedulesText: string;
  memo: string;
  winsText: string;
};

const STORAGE_KEY = 'today-labo-dashboard-v1';
// 「今日」が何日のデータかを覚えるための別キー。
// 既存データ(STORAGE_KEY)の構造には手を加えないため、日付だけを分けて保存する。
const DATE_KEY = 'today-labo-current-date-v1';

const initialData: TodayData = {
  theme: '',
  tasks: [],
  schedules: [],
  memo: '',
  wins: [],
};

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const todayLabel = new Intl.DateTimeFormat('ja-JP', {
  month: 'long',
  day: 'numeric',
  weekday: 'short',
}).format(new Date());

// 端末のローカル時間で 'YYYY-MM-DD' を作る（日付の比較用）
function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 'YYYY-MM-DD' から「6月12日(金)」形式の表示を作る
function labelFromDateKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(y, m - 1, d));
}

// 未完了タスクだけを新しいIDで複製する（今日へ引き継ぐ用）
function unfinishedTasks(data: TodayData): Task[] {
  return data.tasks
    .filter((task) => !task.done)
    .map((task) => ({ id: createId(), text: task.text, done: false }));
}

// 日付が変わっていたら:
// 1. 前日の内容が残っていれば「前日の日付」で記録へ自動保存し、未完了タスクを今日へ引き継ぐ
// 2. 前日の内容が空（夜に手動保存済み）なら、昨日保存された最新の記録から未完了タスクを引き継ぐ
function rolloverState(state: AppState): AppState {
  const todayKey = localDateKey();
  const storedKey = localStorage.getItem(DATE_KEY);
  localStorage.setItem(DATE_KEY, todayKey);

  // 初回起動時は日付を覚えるだけ（既存データが何日のものか分からないため触らない）
  if (!storedKey || storedKey === todayKey) return state;

  if (dataHasContent(state.today)) {
    return {
      today: {
        theme: '',
        tasks: unfinishedTasks(state.today),
        schedules: [],
        memo: '',
        wins: [],
      },
      records: [
        {
          id: createId(),
          dateLabel: labelFromDateKey(storedKey),
          createdAt: Date.now(),
          data: cloneTodayData(state.today),
        },
        ...state.records,
      ],
    };
  }

  const latest = state.records[0];
  if (latest && localDateKey(new Date(latest.createdAt)) === storedKey) {
    const carried = unfinishedTasks(latest.data);
    if (carried.length) {
      return {
        ...state,
        today: { theme: '', tasks: carried, schedules: [], memo: '', wins: [] },
      };
    }
  }

  return state;
}

function cloneTodayData(data: TodayData): TodayData {
  return {
    theme: data.theme,
    tasks: data.tasks.map((task) => ({ ...task })),
    schedules: data.schedules.map((item) => ({ ...item })),
    memo: data.memo,
    wins: data.wins.map((win) => ({ ...win })),
  };
}

function normalizeData(value: Partial<TodayData>): TodayData {
  return {
    theme: value.theme ?? '',
    tasks: Array.isArray(value.tasks) ? value.tasks : [],
    schedules: Array.isArray(value.schedules) ? value.schedules : [],
    memo: value.memo ?? '',
    wins: Array.isArray(value.wins) ? value.wins : [],
  };
}

function normalizeState(value: Partial<AppState & TodayData>): AppState {
  if ('today' in value || 'records' in value) {
    return {
      today: normalizeData(value.today ?? {}),
      records: Array.isArray(value.records)
        ? value.records.map((record) => ({
            id: record.id ?? createId(),
            dateLabel: record.dateLabel ?? todayLabel,
            createdAt: record.createdAt ?? Date.now(),
            data: normalizeData(record.data ?? {}),
          }))
        : [],
    };
  }

  return {
    today: normalizeData(value),
    records: [],
  };
}

function loadState(): AppState {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return { today: initialData, records: [] };

  try {
    return normalizeState(JSON.parse(saved));
  } catch {
    return { today: initialData, records: [] };
  }
}

function includesTerm(value: string, term: string) {
  return value.toLowerCase().includes(term.toLowerCase());
}

function formatSavedAt(value: number | null) {
  if (!value) return '未保存';
  return new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatRecordCreatedAt(value: number) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function dataHasContent(data: TodayData) {
  return (
    data.theme.trim() ||
    data.memo.trim() ||
    data.tasks.length ||
    data.schedules.length ||
    data.wins.length
  );
}

function recordMatches(record: DayRecord, term: string) {
  if (!term) return true;
  return (
    includesTerm(record.dateLabel, term) ||
    includesTerm(record.data.theme, term) ||
    includesTerm(record.data.memo, term) ||
    record.data.tasks.some((task) => includesTerm(task.text, term)) ||
    record.data.schedules.some(
      (item) => includesTerm(item.text, term) || includesTerm(item.time, term),
    ) ||
    record.data.wins.some((win) => includesTerm(win.text, term))
  );
}

function recordToDraft(record: DayRecord): RecordDraft {
  return {
    id: record.id,
    dateLabel: record.dateLabel,
    theme: record.data.theme,
    tasksText: record.data.tasks
      .map((task) => `${task.done ? '[x]' : '[ ]'} ${task.text}`)
      .join('\n'),
    schedulesText: record.data.schedules
      .map((item) => `${item.time ? `${item.time} ` : ''}${item.text}`)
      .join('\n'),
    memo: record.data.memo,
    winsText: record.data.wins.map((win) => win.text).join('\n'),
  };
}

function linesToTasks(value: string): Task[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const done = /^\[[xX]\]\s*/.test(line);
      const text = line.replace(/^\[[ xX]\]\s*/, '').trim();
      return { id: createId(), text, done };
    });
}

function linesToSchedules(value: string): ScheduleItem[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d{1,2}:\d{2})\s+(.+)$/);
      return {
        id: createId(),
        time: match?.[1] ?? '',
        text: match?.[2] ?? line,
      };
    })
    .sort((a, b) => a.time.localeCompare(b.time));
}

function linesToWins(value: string): WinItem[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => ({ id: createId(), text }));
}

function draftToData(draft: RecordDraft): TodayData {
  return {
    theme: draft.theme.trim(),
    tasks: linesToTasks(draft.tasksText),
    schedules: linesToSchedules(draft.schedulesText),
    memo: draft.memo.trim(),
    wins: linesToWins(draft.winsText),
  };
}

export function App() {
  const [state, setState] = useState<AppState>(() => rolloverState(loadState()));
  const [query, setQuery] = useState('');
  const [taskDraft, setTaskDraft] = useState<TaskDraft>({ text: '', editId: null });
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft>({
    time: '',
    text: '',
    editId: null,
  });
  const [winDraft, setWinDraft] = useState<WinDraft>({ text: '', editId: null });
  const [recordDraft, setRecordDraft] = useState<RecordDraft | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveMessage, setSaveMessage] = useState('自動保存中');

  const data = state.today;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setSavedAt(Date.now());
    setSaveMessage('保存しました');
  }, [state]);

  // スマホでアプリを閉じずに置いていた場合、翌朝画面に戻った瞬間に日付切り替えを行う
  useEffect(() => {
    const checkRollover = () => {
      if (document.visibilityState !== 'visible') return;
      setState((current) => rolloverState(current));
    };
    document.addEventListener('visibilitychange', checkRollover);
    return () => document.removeEventListener('visibilitychange', checkRollover);
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim();
    if (!term) return data;

    return {
      ...data,
      tasks: data.tasks.filter((task) => includesTerm(task.text, term)),
      schedules: data.schedules.filter(
        (item) => includesTerm(item.text, term) || includesTerm(item.time, term),
      ),
      wins: data.wins.filter((win) => includesTerm(win.text, term)),
    };
  }, [data, query]);

  const filteredRecords = useMemo(
    () => state.records.filter((record) => recordMatches(record, query.trim())),
    [state.records, query],
  );

  const themeMatches = !query.trim() || includesTerm(data.theme, query);
  const memoMatches = !query.trim() || includesTerm(data.memo, query);

  const completedCount = data.tasks.filter((task) => task.done).length;
  const nextSchedule = data.schedules
    .filter((item) => item.time || item.text.trim())
    .sort((a, b) => {
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    })[0];

  function updateState(updater: (current: AppState) => AppState) {
    setSaveMessage('自動保存中');
    setState((current) => updater(current));
  }

  function updateData(updater: (current: TodayData) => TodayData) {
    updateState((current) => ({ ...current, today: updater(current.today) }));
  }

  function saveNow() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setSavedAt(Date.now());
    setSaveMessage('保存しました');
  }

  function saveDayRecord() {
    if (!dataHasContent(data)) return;

    updateState((current) => ({
      today: initialData,
      records: [
        {
          id: createId(),
          dateLabel: todayLabel,
          createdAt: Date.now(),
          data: cloneTodayData(current.today),
        },
        ...current.records,
      ],
    }));

    setTaskDraft({ text: '', editId: null });
    setScheduleDraft({ time: '', text: '', editId: null });
    setWinDraft({ text: '', editId: null });
  }

  function saveTask(event: FormEvent) {
    event.preventDefault();
    const text = taskDraft.text.trim();
    if (!text) return;

    updateData((current) => {
      if (taskDraft.editId) {
        return {
          ...current,
          tasks: current.tasks.map((task) =>
            task.id === taskDraft.editId ? { ...task, text } : task,
          ),
        };
      }

      return { ...current, tasks: [...current.tasks, { id: createId(), text, done: false }] };
    });

    setTaskDraft({ text: '', editId: null });
  }

  function saveSchedule(event: FormEvent) {
    event.preventDefault();
    const text = scheduleDraft.text.trim();
    if (!text) return;

    updateData((current) => {
      const nextItem = { time: scheduleDraft.time, text };
      if (scheduleDraft.editId) {
        return {
          ...current,
          schedules: current.schedules
            .map((item) => (item.id === scheduleDraft.editId ? { ...item, ...nextItem } : item))
            .sort((a, b) => a.time.localeCompare(b.time)),
        };
      }

      return {
        ...current,
        schedules: [...current.schedules, { id: createId(), ...nextItem }].sort((a, b) =>
          a.time.localeCompare(b.time),
        ),
      };
    });

    setScheduleDraft({ time: '', text: '', editId: null });
  }

  function saveWin(event: FormEvent) {
    event.preventDefault();
    const text = winDraft.text.trim();
    if (!text) return;

    updateData((current) => {
      if (winDraft.editId) {
        return {
          ...current,
          wins: current.wins.map((win) => (win.id === winDraft.editId ? { ...win, text } : win)),
        };
      }

      return { ...current, wins: [{ id: createId(), text }, ...current.wins] };
    });

    setWinDraft({ text: '', editId: null });
  }

  function moveTask(id: string, direction: -1 | 1) {
    updateData((current) => {
      const index = current.tasks.findIndex((task) => task.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.tasks.length) return current;

      const tasks = [...current.tasks];
      const [task] = tasks.splice(index, 1);
      tasks.splice(target, 0, task);
      return { ...current, tasks };
    });
  }

  function deleteTask(id: string) {
    updateData((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== id),
    }));
    if (taskDraft.editId === id) setTaskDraft({ text: '', editId: null });
  }

  function deleteSchedule(id: string) {
    updateData((current) => ({
      ...current,
      schedules: current.schedules.filter((item) => item.id !== id),
    }));
    if (scheduleDraft.editId === id) setScheduleDraft({ time: '', text: '', editId: null });
  }

  function deleteWin(id: string) {
    updateData((current) => ({
      ...current,
      wins: current.wins.filter((win) => win.id !== id),
    }));
    if (winDraft.editId === id) setWinDraft({ text: '', editId: null });
  }

  function saveRecordEdit(event: FormEvent) {
    event.preventDefault();
    if (!recordDraft) return;

    updateState((current) => ({
      ...current,
      records: current.records.map((record) =>
        record.id === recordDraft.id
          ? { ...record, dateLabel: recordDraft.dateLabel.trim() || record.dateLabel, data: draftToData(recordDraft) }
          : record,
      ),
    }));
    setRecordDraft(null);
  }

  function deleteRecord(id: string) {
    updateState((current) => ({
      ...current,
      records: current.records.filter((record) => record.id !== id),
    }));
    if (recordDraft?.id === id) setRecordDraft(null);
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="date-label">{todayLabel}</p>
          <h1>Today Labo</h1>
        </div>
        <div className="progress-pill">
          <Check size={16} aria-hidden="true" />
          <span>
            {completedCount}/{data.tasks.length}
          </span>
        </div>
      </header>

      <section className="save-panel" aria-live="polite">
        <div>
          <strong>{saveMessage}</strong>
          <span>最終保存 {formatSavedAt(savedAt)}</span>
        </div>
        <button className="text-button primary" type="button" onClick={saveNow}>
          <Save size={17} aria-hidden="true" />
          保存
        </button>
      </section>

      <label className="search-box">
        <Search size={18} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="今日と保存記録を検索"
          type="search"
        />
      </label>

      <section className="overview">
        <article className="focus-panel">
          <div className="section-title">
            <Lightbulb size={19} aria-hidden="true" />
            <h2>今日のテーマ</h2>
          </div>
          {themeMatches && (
            <textarea
              className="theme-input"
              value={data.theme}
              onChange={(event) =>
                updateData((current) => ({ ...current, theme: event.target.value }))
              }
              placeholder="今日は何を大切にする？"
              rows={2}
            />
          )}
        </article>

        <div className="quick-glance">
          <div>
            <span>タスク</span>
            <strong>{data.tasks.length ? `${completedCount}/${data.tasks.length}` : '0'}</strong>
          </div>
          <div className="next-plan-card">
            <span>次の予定</span>
            {nextSchedule ? (
              <>
                <strong>{nextSchedule.time || '--:--'}</strong>
                <p>{nextSchedule.text}</p>
              </>
            ) : (
              <>
                <strong>--:--</strong>
                <p>予定なし</p>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="section-block archive-block">
        <div className="section-title">
          <Archive size={19} aria-hidden="true" />
          <h2>1日の終わり</h2>
        </div>
        <p className="helper-text">今日のテーマ、タスク、予定、メモ、できたことをまとめて1日の記録に保存します。</p>
        <button
          className="wide-button"
          type="button"
          disabled={!dataHasContent(data)}
          onClick={saveDayRecord}
        >
          <Archive size={18} aria-hidden="true" />
          今日を1日の記録として保存
        </button>
      </section>

      <section className="section-block">
        <div className="section-title">
          <ClipboardCheck size={19} aria-hidden="true" />
          <h2>今日のタスク</h2>
        </div>

        <form className="inline-form" onSubmit={saveTask}>
          <input
            value={taskDraft.text}
            onChange={(event) => setTaskDraft((draft) => ({ ...draft, text: event.target.value }))}
            placeholder="タスクを追加"
          />
          {taskDraft.editId && (
            <button
              className="icon-button"
              type="button"
              aria-label="編集をやめる"
              onClick={() => setTaskDraft({ text: '', editId: null })}
            >
              <X size={18} />
            </button>
          )}
          <button className="text-button primary" type="submit">
            {taskDraft.editId ? <Check size={17} /> : <Plus size={18} />}
            保存
          </button>
        </form>

        <div className="list">
          {filtered.tasks.map((task, index) => (
            <article className={`list-item ${task.done ? 'is-done' : ''}`} key={task.id}>
              <button
                className="check-button"
                type="button"
                aria-label={task.done ? '未完了にする' : '完了にする'}
                onClick={() =>
                  updateData((current) => ({
                    ...current,
                    tasks: current.tasks.map((item) =>
                      item.id === task.id ? { ...item, done: !item.done } : item,
                    ),
                  }))
                }
              >
                {task.done && <Check size={16} />}
              </button>
              <p>{task.text}</p>
              <div className="item-actions">
                <button
                  className="tiny-button"
                  type="button"
                  aria-label="上へ移動"
                  disabled={index === 0 || query.trim().length > 0}
                  onClick={() => moveTask(task.id, -1)}
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  className="tiny-button"
                  type="button"
                  aria-label="下へ移動"
                  disabled={index === data.tasks.length - 1 || query.trim().length > 0}
                  onClick={() => moveTask(task.id, 1)}
                >
                  <ChevronDown size={16} />
                </button>
                <button
                  className="action-button"
                  type="button"
                  onClick={() => setTaskDraft({ text: task.text, editId: task.id })}
                >
                  <Edit3 size={14} aria-hidden="true" />
                  編集
                </button>
                <button className="action-button danger" type="button" onClick={() => deleteTask(task.id)}>
                  <Trash2 size={14} aria-hidden="true" />
                  削除
                </button>
              </div>
            </article>
          ))}
          {!filtered.tasks.length && <p className="empty-text">まだタスクはありません</p>}
        </div>
      </section>

      <section className="section-block">
        <div className="section-title">
          <CalendarClock size={19} aria-hidden="true" />
          <h2>今日の予定</h2>
        </div>

        <form className="schedule-form" onSubmit={saveSchedule}>
          <label className="schedule-field time-field">
            <span>時間</span>
            <input
              className="time-input"
              value={scheduleDraft.time}
              onChange={(event) =>
                setScheduleDraft((draft) => ({ ...draft, time: event.target.value }))
              }
              type="time"
            />
          </label>
          <label className="schedule-field">
            <span>予定</span>
            <input
              value={scheduleDraft.text}
              onChange={(event) =>
                setScheduleDraft((draft) => ({ ...draft, text: event.target.value }))
              }
              placeholder="内容を書く"
            />
          </label>
          <div className="schedule-actions">
            {scheduleDraft.editId && (
              <button
                className="icon-button"
                type="button"
                aria-label="編集をやめる"
                onClick={() => setScheduleDraft({ time: '', text: '', editId: null })}
              >
                <X size={18} />
              </button>
            )}
            <button className="text-button primary" type="submit">
              {scheduleDraft.editId ? <Check size={17} /> : <Plus size={18} />}
              保存
            </button>
          </div>
        </form>

        <div className="list">
          {filtered.schedules.map((item) => (
            <article className="list-item schedule-item" key={item.id}>
              <time>{item.time || '--:--'}</time>
              <p>{item.text}</p>
              <div className="item-actions">
                <button
                  className="action-button"
                  type="button"
                  onClick={() =>
                    setScheduleDraft({ time: item.time, text: item.text, editId: item.id })
                  }
                >
                  <Edit3 size={14} aria-hidden="true" />
                  編集
                </button>
                <button
                  className="action-button danger"
                  type="button"
                  onClick={() => deleteSchedule(item.id)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  削除
                </button>
              </div>
            </article>
          ))}
          {!filtered.schedules.length && <p className="empty-text">まだ予定はありません</p>}
        </div>
      </section>

      <section className="section-block">
        <div className="section-title">
          <GripVertical size={19} aria-hidden="true" />
          <h2>メモ</h2>
        </div>
        {memoMatches && (
          <textarea
            className="memo-input"
            value={data.memo}
            onChange={(event) => updateData((current) => ({ ...current, memo: event.target.value }))}
            placeholder="思いついたことを残す"
            rows={6}
          />
        )}
      </section>

      <section className="section-block evening-block">
        <div className="section-title">
          <Sparkles size={19} aria-hidden="true" />
          <h2>今日できたこと</h2>
        </div>

        <form className="inline-form" onSubmit={saveWin}>
          <input
            value={winDraft.text}
            onChange={(event) => setWinDraft((draft) => ({ ...draft, text: event.target.value }))}
            placeholder="できたことを残す"
          />
          {winDraft.editId && (
            <button
              className="icon-button"
              type="button"
              aria-label="編集をやめる"
              onClick={() => setWinDraft({ text: '', editId: null })}
            >
              <X size={18} />
            </button>
          )}
          <button className="text-button primary" type="submit">
            {winDraft.editId ? <Check size={17} /> : <Plus size={18} />}
            保存
          </button>
        </form>

        <div className="list">
          {filtered.wins.map((win) => (
            <article className="list-item win-item" key={win.id}>
              <Sparkles size={16} aria-hidden="true" />
              <p>{win.text}</p>
              <div className="item-actions">
                <button
                  className="action-button"
                  type="button"
                  onClick={() => setWinDraft({ text: win.text, editId: win.id })}
                >
                  <Edit3 size={14} aria-hidden="true" />
                  編集
                </button>
                <button className="action-button danger" type="button" onClick={() => deleteWin(win.id)}>
                  <Trash2 size={14} aria-hidden="true" />
                  削除
                </button>
              </div>
            </article>
          ))}
          {!filtered.wins.length && <p className="empty-text">夜にここを見返せます</p>}
        </div>
      </section>

      <section className="section-block records-block">
        <div className="section-title">
          <Archive size={19} aria-hidden="true" />
          <h2>保存した1日の記録</h2>
        </div>

        {recordDraft && (
          <form className="record-edit-form" onSubmit={saveRecordEdit}>
            <label>
              <span>日付</span>
              <input
                value={recordDraft.dateLabel}
                onChange={(event) =>
                  setRecordDraft((draft) =>
                    draft ? { ...draft, dateLabel: event.target.value } : draft,
                  )
                }
              />
            </label>
            <label>
              <span>テーマ</span>
              <textarea
                value={recordDraft.theme}
                onChange={(event) =>
                  setRecordDraft((draft) => (draft ? { ...draft, theme: event.target.value } : draft))
                }
                rows={2}
              />
            </label>
            <label>
              <span>タスク</span>
              <textarea
                value={recordDraft.tasksText}
                onChange={(event) =>
                  setRecordDraft((draft) =>
                    draft ? { ...draft, tasksText: event.target.value } : draft,
                  )
                }
                rows={4}
              />
            </label>
            <label>
              <span>予定</span>
              <textarea
                value={recordDraft.schedulesText}
                onChange={(event) =>
                  setRecordDraft((draft) =>
                    draft ? { ...draft, schedulesText: event.target.value } : draft,
                  )
                }
                rows={3}
              />
            </label>
            <label>
              <span>メモ</span>
              <textarea
                value={recordDraft.memo}
                onChange={(event) =>
                  setRecordDraft((draft) => (draft ? { ...draft, memo: event.target.value } : draft))
                }
                rows={4}
              />
            </label>
            <label>
              <span>できたこと</span>
              <textarea
                value={recordDraft.winsText}
                onChange={(event) =>
                  setRecordDraft((draft) =>
                    draft ? { ...draft, winsText: event.target.value } : draft,
                  )
                }
                rows={3}
              />
            </label>
            <div className="record-form-actions">
              <button className="text-button" type="button" onClick={() => setRecordDraft(null)}>
                <X size={17} aria-hidden="true" />
                やめる
              </button>
              <button className="text-button primary" type="submit">
                <Save size={17} aria-hidden="true" />
                記録を保存
              </button>
            </div>
          </form>
        )}

        <div className="record-list">
          {filteredRecords.map((record) => {
            const doneCount = record.data.tasks.filter((task) => task.done).length;
            return (
              <article className="record-card" key={record.id}>
                <div className="record-head">
                  <div>
                    <strong>{record.dateLabel}</strong>
                    <span>{formatRecordCreatedAt(record.createdAt)} 保存</span>
                  </div>
                  <div className="record-actions">
                    <button
                      className="action-button"
                      type="button"
                      onClick={() => setRecordDraft(recordToDraft(record))}
                    >
                      <Edit3 size={14} aria-hidden="true" />
                      編集
                    </button>
                    <button
                      className="action-button danger"
                      type="button"
                      onClick={() => deleteRecord(record.id)}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      削除
                    </button>
                  </div>
                </div>
                {record.data.theme && <p className="record-theme">{record.data.theme}</p>}
                <div className="record-summary">
                  <span>タスク {doneCount}/{record.data.tasks.length}</span>
                  <span>予定 {record.data.schedules.length}</span>
                  <span>できた {record.data.wins.length}</span>
                </div>
                {record.data.memo && <p className="record-memo">{record.data.memo}</p>}
              </article>
            );
          })}
          {!filteredRecords.length && <p className="empty-text">まだ1日の記録はありません</p>}
        </div>
      </section>

      <p className="mobile-note">スマホ画面専用アプリです</p>
    </main>
  );
}
