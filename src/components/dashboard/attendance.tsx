import { useState } from 'react';
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, Minus } from 'lucide-react';
import { attendanceWeek, shortDate } from '@/domain/dashboard';
import type { State } from '@/domain/types';
import styles from './dashboard.module.css';

export function Attendance({
  state,
  onHistory,
}: {
  state: State;
  onHistory: (id: string) => void;
}) {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const days = attendanceWeek(state.history, state.serverNow, offset);
  const attended = days.filter((d) => d.workouts.length).length;
  const selectedDay = days.find((d) => d.id === selected);
  const changeWeek = (change: number) => {
    setOffset(offset + change);
    setSelected(null);
  };
  return (
    <section className={styles.panel} aria-labelledby="attendance-heading">
      <div className={styles.panelHeading}>
        <div>
          <span className="eyeline">SHOWING UP ADDS UP</span>
          <h2 id="attendance-heading">Your weekly schedule</h2>
        </div>
        <div className={styles.weekControls}>
          <button
            className="ghost"
            aria-label="Previous attendance week"
            onClick={() => changeWeek(-1)}
          >
            <ChevronLeft size={17} />
          </button>
          <button
            className="ghost"
            aria-label="Next attendance week"
            disabled={offset === 0}
            onClick={() => changeWeek(1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <div className={styles.attendanceSummary}>
        <p>
          <strong>{attended}</strong> {attended === 1 ? 'day' : 'days'} trained
        </p>
        <span>
          {shortDate(days[0].timestamp)} – {shortDate(days[6].timestamp)}
        </span>
      </div>
      <div className={styles.calendar} aria-label="Weekly attendance">
        {days.map((day) => (
          <button
            key={day.id}
            aria-pressed={selected === day.id}
            aria-current={day.today ? 'date' : undefined}
            aria-label={`${day.label} ${shortDate(day.timestamp)}${day.today ? ', today' : ''}: ${day.workouts.length ? `${day.workouts.length} completed workout${day.workouts.length === 1 ? '' : 's'}` : day.future ? 'upcoming' : 'no workout logged'}`}
            className={`${styles.day} ${day.workouts.length ? styles.attended : ''} ${day.today ? styles.today : ''}`}
            onClick={() => setSelected(selected === day.id ? null : day.id)}
          >
            <span>{day.today ? 'Today' : day.label}</span>
            <strong>{day.workouts.length ? <s>{day.day}</s> : day.day}</strong>
            <span className={styles.dayMark}>
              {day.workouts.length ? (
                <Check size={16} />
              ) : day.today ? (
                <span className={styles.todayDot} />
              ) : (
                <Minus size={12} />
              )}
            </span>
          </button>
        ))}
      </div>
      <div className={styles.calendarDetail} aria-live="polite">
        {selectedDay ? (
          <>
            <p>
              {selectedDay.label} {shortDate(selectedDay.timestamp)} ·{' '}
              {selectedDay.workouts.length
                ? 'Completed'
                : selectedDay.future
                  ? 'Open day. Workouts are not assigned to weekdays.'
                  : 'No completed workouts logged.'}
            </p>
            {selectedDay.workouts.map((w) => (
              <button key={w.id} className={styles.inlineLink} onClick={() => onHistory(w.id)}>
                {w.name}
                <ArrowUpRight size={14} />
              </button>
            ))}
          </>
        ) : (
          <p>
            <Check size={14} /> Completed days are crossed off. Select a day to see its sessions.
          </p>
        )}
      </div>
      <p className={styles.footnote}>Attendance by start date · Amsterdam time</p>
    </section>
  );
}
