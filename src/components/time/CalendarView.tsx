import { useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import jaLocale from '@fullcalendar/core/locales/ja';
import type { DateSelectArg, EventClickArg, EventDropArg, EventInput, DatesSetArg, DayHeaderContentArg } from '@fullcalendar/core';
import type { EventResizeDoneArg, DateClickArg } from '@fullcalendar/interaction';
import { SNAP, newEntry, type Entry, type Template, type TimeStore } from '../../time/types';
import { addDays, hhmm, minOfDate, toYmd, todayYmd, labelYmd } from '../../time/dates';
import { coveredMinutes, minutesOf } from '../../time/aggregate';
import { uid } from '../../domain/types';
import { EntryDialog } from './EntryDialog';

interface Props { store: TimeStore; onChange: (s: TimeStore) => void; say: (t: string, err?: boolean) => void }

const fmtH = (m: number) => `${+(m / 60).toFixed(2)}h`;

export function CalendarView({ store, onChange, say }: Props) {
  const cal = useRef<FullCalendar>(null);
  const mobile = typeof window !== 'undefined' && window.innerWidth < 760;
  const [dialog, setDialog] = useState<{ entry: Entry; isNew: boolean } | null>(null);
  const [range, setRange] = useState<{ start: string; end: string; type: string }>({ start: todayYmd(), end: todayYmd(), type: '' });
  const [target, setTarget] = useState(todayYmd());
  const [lastId, setLastId] = useState('');
  const { genres, entries, templates, settings } = store;
  const gmap = useMemo(() => Object.fromEntries(genres.map(g => [g.genreId, g])), [genres]);
  const last = entries.find(e => e.entryId === lastId) ?? entries[entries.length - 1] ?? null;

  const events: EventInput[] = useMemo(() => entries.map(e => {
    const g = gmap[e.genreId];
    return {
      id: e.entryId, start: `${e.date}T${hhmm(e.startMin)}`, end: e.endMin >= 24 * 60 ? `${addDays(e.date, 1)}T00:00` : `${e.date}T${hhmm(e.endMin)}`,
      title: e.title + (e.count ? ` ×${e.count}件` : ''), backgroundColor: g?.color ?? '#9aa0a6', borderColor: g?.color ?? '#9aa0a6', textColor: '#fff',
      extendedProps: { genre: g?.name ?? '（ジャンルなし）', memo: e.memo },
    };
  }), [entries, gmap]);

  const put = (e: Entry) => { onChange({ ...store, entries: entries.some(x => x.entryId === e.entryId) ? entries.map(x => (x.entryId === e.entryId ? e : x)) : [...entries, e] }); setLastId(e.entryId); };
  /** カレンダー操作の開始・終了 → 1日内の分に変換（日をまたぐ操作は戻す） */
  const toRange = (start: Date, end: Date | null) => {
    const date = toYmd(start), s = minOfDate(start);
    const e = !end ? s + 30 : toYmd(end) === date ? minOfDate(end) : toYmd(end) === addDays(date, 1) && minOfDate(end) === 0 ? 24 * 60 : -1;
    return e <= s ? null : { date, startMin: s, endMin: e };
  };

  const onSelect = (a: DateSelectArg) => {
    a.view.calendar.unselect();
    if (a.allDay) { setTarget(toYmd(a.start)); a.view.calendar.changeView('timeGridDay', a.start); return; }
    const r = toRange(a.start, a.end);
    if (!r) return say('日をまたぐ記録は作れません。日ごとに分けて記録してください。', true);
    setDialog({ entry: newEntry({ ...r, genreId: '' }), isNew: true });
  };
  const onDateClick = (a: DateClickArg) => { setTarget(toYmd(a.date)); };
  const onMove = (a: EventDropArg | EventResizeDoneArg) => {
    const e = entries.find(x => x.entryId === a.event.id);
    const r = a.event.start && toRange(a.event.start, a.event.end);
    if (!e || !r) { a.revert(); say('日をまたぐ記録は作れません。', true); return; }
    put({ ...e, ...r });
  };
  const onClick = (a: EventClickArg) => { const e = entries.find(x => x.entryId === a.event.id); if (e) setDialog({ entry: e, isNew: false }); };
  const onDates = (a: DatesSetArg) => {
    const start = toYmd(a.start), end = addDays(toYmd(a.end), -1);
    setRange({ start, end, type: a.view.type });
    if (target < start || target > end) setTarget(todayYmd() >= start && todayYmd() <= end ? todayYmd() : start);
  };

  // よく使う作業：対象日の最後の記録の直後（無ければ表示開始時刻）に追加
  const addTemplate = (t: Template) => {
    const day = entries.filter(e => e.date === target);
    const s = day.length ? Math.max(...day.map(e => e.endMin)) : settings.dayStartHour * 60;
    const endMin = Math.min(24 * 60, s + t.minutes);
    if (s >= 24 * 60) return say('この日はこれ以上追加できません', true);
    const e = newEntry({ date: target, startMin: s, endMin, title: t.title, genreId: t.genreId });
    put(e);
    say(`${labelYmd(target)} ${hhmm(s)}〜${hhmm(endMin)} に「${t.title}」を追加しました（クリックで変更できます）`);
  };
  const copyFrom = (days: number) => {
    const from = addDays(target, -days);
    const src = entries.filter(e => e.date === from);
    if (!src.length) return say(`${labelYmd(from)} の記録がありません`, true);
    if (entries.some(e => e.date === target) && !confirm(`${labelYmd(target)} には既に記録があります。追加でコピーしますか？`)) return;
    onChange({ ...store, entries: [...entries, ...src.map(e => ({ ...e, entryId: uid('e'), date: target }))] });
    say(`${labelYmd(from)} の記録 ${src.length}件 を ${labelYmd(target)} にコピーしました`);
  };
  const save = (e: Entry, asTemplate: boolean) => {
    const next = { ...store, entries: entries.some(x => x.entryId === e.entryId) ? entries.map(x => (x.entryId === e.entryId ? e : x)) : [...entries, e] };
    if (asTemplate && !templates.some(t => t.title === e.title && t.genreId === e.genreId))
      next.templates = [...templates, { templateId: uid('t'), title: e.title, genreId: e.genreId, minutes: Math.max(SNAP, e.endMin - e.startMin) }];
    onChange(next); setLastId(e.entryId); setDialog(null);
  };

  const dayHeader = (a: DayHeaderContentArg) => {
    const d = toYmd(a.date), m = coveredMinutes(entries.filter(e => e.date === d));
    if (a.view.type === 'dayGridMonth') return a.text;
    return (
      <div className={'dayhead' + (d === target ? ' target' : '')}>
        <span>{a.text}</span>
        <small className={m && m < settings.workHoursPerDay * 60 ? 'short' : ''}>{m ? `${fmtH(m)} / ${settings.workHoursPerDay}h` : '未記録'}</small>
      </div>
    );
  };
  const visibleTotal = entries.filter(e => e.date >= range.start && e.date <= range.end).reduce((s, e) => s + minutesOf(e), 0);

  return (
    <div className="timegrid">
      <section className="panel cal">
        <div className="muted calhelp">空いている時間を<b>ドラッグ</b>して作業を記録します（15分単位）。記録はドラッグで移動、下端で長さ変更、クリックで編集できます。見出しの「◯h / 8h」はその日の記録済み時間の目安です。</div>
        <FullCalendar
          ref={cal}
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          locale={jaLocale}
          initialView={mobile ? 'timeGridDay' : 'timeGridWeek'}
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridDay,timeGridWeek,dayGridMonth' }}
          buttonText={{ today: '今日', day: '日', week: '週', month: '月' }}
          firstDay={settings.weekStart}
          allDaySlot={false}
          slotDuration="00:30:00"
          snapDuration="00:15:00"
          scrollTime={`${String(settings.dayStartHour).padStart(2, '0')}:00:00`}
          businessHours={{ daysOfWeek: [1, 2, 3, 4, 5], startTime: `${settings.dayStartHour}:00`, endTime: `${settings.dayEndHour}:00` }}
          height={mobile ? 620 : 720}
          nowIndicator
          selectable
          selectMirror
          editable
          eventResizableFromStart={false}
          dayMaxEvents={4}
          events={events}
          select={onSelect}
          dateClick={onDateClick}
          eventClick={onClick}
          eventDrop={onMove}
          eventResize={onMove}
          datesSet={onDates}
          dayHeaderContent={dayHeader}
          eventDidMount={a => { a.el.title = `${a.event.title}\n${a.event.extendedProps.genre}${a.event.extendedProps.memo ? '\n' + a.event.extendedProps.memo : ''}`; }}
          navLinks
          navLinkDayClick={(d: Date) => { setTarget(toYmd(d)); cal.current?.getApi().changeView('timeGridDay', d); }}
        />
        <p className="muted">表示中の期間の記録：{fmtH(visibleTotal)}</p>
      </section>

      <aside className="panel side">
        <h2>すばやく入力</h2>
        <label>対象の日<input type="date" value={target} onChange={e => e.target.value && setTarget(e.target.value)} /></label>
        <p className="muted">週表示の日付見出しをクリックすると、その日を選べます。</p>
        <button className="block" onClick={() => setDialog({ entry: newEntry({ date: target, startMin: Math.min(entries.filter(e => e.date === target).reduce((m, e) => Math.max(m, e.endMin), settings.dayStartHour * 60), 24 * 60 - 30), endMin: 0, genreId: '' }), isNew: true })}>＋ 記録を追加</button>
        <h3>よく使う作業</h3>
        {templates.length === 0 && <p className="muted">記録の入力画面で「よく使う作業に登録」にチェックすると、ここにボタンが並びます。</p>}
        <div className="tpls">
          {templates.map(t => {
            const g = gmap[t.genreId];
            return <button key={t.templateId} className="tpl" style={{ borderLeftColor: g?.color ?? '#999' }} onClick={() => addTemplate(t)} title={`${g?.name ?? ''}・${t.minutes}分を対象の日の最後に追加`}>{t.title}<small>{t.minutes}分</small></button>;
          })}
        </div>
        <h3>コピー</h3>
        <button className="secondary block" onClick={() => copyFrom(1)}>前日の記録をコピー</button>
        <button className="secondary block" onClick={() => copyFrom(7)}>前週の同じ曜日をコピー</button>
        <h3>ジャンル</h3>
        <ul className="legendlist">{genres.filter(g => !g.hidden).sort((a, b) => a.order - b.order).map(g => <li key={g.genreId}><i style={{ background: g.color }} />{g.name}</li>)}</ul>
      </aside>

      {dialog && (
        <EntryDialog
          key={dialog.entry.entryId}
          entry={dialog.entry.endMin <= dialog.entry.startMin ? { ...dialog.entry, endMin: dialog.entry.startMin + 30 } : dialog.entry}
          isNew={dialog.isNew}
          genres={genres}
          entries={entries}
          last={dialog.isNew ? last : null}
          onSave={save}
          onDelete={() => { onChange({ ...store, entries: entries.filter(x => x.entryId !== dialog.entry.entryId) }); setDialog(null); }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
