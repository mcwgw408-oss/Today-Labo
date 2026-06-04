import {
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Edit3,
  GripVertical,
  Lightbulb,
  Plus,
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

const STORAGE_KEY = 'today-labo-dashboard-v1';

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

function loadData(): TodayData {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return initialData;

  try {
    return { ...initialData, ...JSON.parse(saved) };
  } catch {
    return initialData;
  }
}

function includesTerm(value: string, term: string) {
  return value.toLowerCase().includes(term.toLowerCase());
}

export function App() {
  const [data, setData] = useState<TodayData>(() => loadData());
  const [query, setQuery] = useState('');
  const [taskDraft, setTaskDraft] = useState<TaskDraft>({ text: '', editId: null });
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft>({
    time: '',
    text: '',
    editId: null,
  });
  const [winDraft, setWinDraft] = useState<WinDraft>({ text: '', editId: null });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

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

  function updateData(updater: (current: TodayData) => TodayData) {
    setData((current) => updater(current));
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
            .map((item) =>
              item.id === scheduleDraft.editId ? { ...item, ...nextItem } : item,
            )
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

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="date-label">{todayLabel}</p>
          <h1>今日</h1>
        </div>
        <div className="progress-pill">
          <Check size={16} aria-hidden="true" />
          <span>
            {completedCount}/{data.tasks.length}
          </span>
        </div>
      </header>

      <label className="search-box">
        <Search size={18} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="今日の中から検索"
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
          <button className="icon-button primary" type="submit" aria-label="タスクを保存">
            <Plus size={19} />
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
                  className="tiny-button"
                  type="button"
                  aria-label="編集"
                  onClick={() => setTaskDraft({ text: task.text, editId: task.id })}
                >
                  <Edit3 size={15} />
                </button>
                <button
                  className="tiny-button danger"
                  type="button"
                  aria-label="削除"
                  onClick={() =>
                    updateData((current) => ({
                      ...current,
                      tasks: current.tasks.filter((item) => item.id !== task.id),
                    }))
                  }
                >
                  <Trash2 size={15} />
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
            <button className="icon-button primary" type="submit" aria-label="予定を保存">
              <Plus size={19} />
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
                  className="tiny-button"
                  type="button"
                  aria-label="編集"
                  onClick={() =>
                    setScheduleDraft({ time: item.time, text: item.text, editId: item.id })
                  }
                >
                  <Edit3 size={15} />
                </button>
                <button
                  className="tiny-button danger"
                  type="button"
                  aria-label="削除"
                  onClick={() =>
                    updateData((current) => ({
                      ...current,
                      schedules: current.schedules.filter((entry) => entry.id !== item.id),
                    }))
                  }
                >
                  <Trash2 size={15} />
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
            placeholder="思いついたことをすぐ書く"
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
          <button className="icon-button primary" type="submit" aria-label="できたことを保存">
            <Plus size={19} />
          </button>
        </form>

        <div className="list">
          {filtered.wins.map((win) => (
            <article className="list-item win-item" key={win.id}>
              <Sparkles size={16} aria-hidden="true" />
              <p>{win.text}</p>
              <div className="item-actions">
                <button
                  className="tiny-button"
                  type="button"
                  aria-label="編集"
                  onClick={() => setWinDraft({ text: win.text, editId: win.id })}
                >
                  <Edit3 size={15} />
                </button>
                <button
                  className="tiny-button danger"
                  type="button"
                  aria-label="削除"
                  onClick={() =>
                    updateData((current) => ({
                      ...current,
                      wins: current.wins.filter((item) => item.id !== win.id),
                    }))
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}
          {!filtered.wins.length && <p className="empty-text">夜にここを見返せます</p>}
        </div>
      </section>
    </main>
  );
}
