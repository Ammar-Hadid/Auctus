import { ArrowUpRight, Trophy } from 'lucide-react';
import { exerciseRecords } from '@/domain/exercise-progress';
import { formatNumber, localDate, shortDate } from '@/domain/dashboard';
import type { ExercisePerformance } from '@/domain/metrics';
import styles from './progress.module.css';
export function RepRecords({
  data,
  onHistory,
}: {
  data: ExercisePerformance[];
  onHistory: (id: string) => void;
}) {
  const records = exerciseRecords(data);
  return (
    <section className={styles.panel} aria-labelledby="rep-records-heading">
      <div className={styles.heading}>
        <div>
          <span className="eyeline">COMPARE THE SAME REP COUNT</span>
          <h2 id="rep-records-heading">Your rep records</h2>
        </div>
        <Trophy size={20} className="muted" />
      </div>
      <p className={styles.caption}>
        Heaviest recorded working set at each rep count. Open a record to see the original session.
      </p>
      <div className={styles.recordList}>
        {records.map((record) => (
          <button
            key={record.reps}
            className={styles.recordRow}
            onClick={() => onHistory(record.workoutId)}
            aria-label={`View ${record.reps}-rep record: ${formatNumber(record.kg)} kilograms`}
          >
            <span>
              {record.reps} <small>reps</small>
            </span>
            <strong>
              {formatNumber(record.kg)} <small>kg</small>
            </strong>
            <span className={styles.recordDate}>
              {shortDate(record.date)} {localDate(record.date).year}
            </span>
            <ArrowUpRight size={15} />
          </button>
        ))}
      </div>
    </section>
  );
}
