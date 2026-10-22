import { useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatNumber, localDate, shortDate } from '@/domain/dashboard';
import type { ExercisePerformance } from '@/domain/metrics';
import styles from './progress.module.css';
export function ExerciseSessions({
  data,
  onHistory,
}: {
  data: ExercisePerformance[];
  onHistory: (id: string) => void;
}) {
  const [page, setPage] = useState(0);
  const lastPage = Math.max(0, Math.ceil(data.length / 3) - 1);
  const currentPage = Math.min(page, lastPage);
  const sessions = [...data].reverse().slice(currentPage * 3, currentPage * 3 + 3);
  return (
    <section className={styles.panel} aria-labelledby="exercise-sessions-heading">
      <div className={styles.heading}>
        <div>
          <span className="eyeline">EVERY SET HAS A STORY</span>
          <h2 id="exercise-sessions-heading">Session history</h2>
        </div>
        <span className={styles.count}>{data.length} logged</span>
      </div>
      <div className={styles.sessions}>
        {sessions.map((session) => (
          <button
            className={styles.sessionRow}
            key={session.workoutId}
            onClick={() => onHistory(session.workoutId)}
          >
            <span className={styles.sessionDate}>
              {shortDate(session.date)} · {localDate(session.date).year}
            </span>
            <strong>{session.name}</strong>
            <span className={styles.sessionNumbers}>
              {formatNumber(session.topSet.kg)} kg × {session.topSet.reps} <small>top set</small>
              <ArrowUpRight size={15} />
            </span>
            <span>
              {session.workingSets.length} working sets · {session.reps} reps ·{' '}
              {formatNumber(session.volume)} kg volume
            </span>
          </button>
        ))}
      </div>
      {data.length > 3 && (
        <div className={styles.sessionPaging}>
          <span>
            Page {currentPage + 1} of {lastPage + 1}
          </span>
          <div className={styles.paging}>
            <button
              className="ghost"
              aria-label="Newer exercise sessions"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <button
              className="ghost"
              aria-label="Older exercise sessions"
              disabled={currentPage === lastPage}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
