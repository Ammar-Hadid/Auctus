export type SetType = 'normal' | 'warmup' | 'dropset' | 'failure';
export type WorkoutStatus = 'active' | 'paused' | 'completed' | 'abandoned';
export type ActivityStatus = 'pending' | 'active' | 'paused' | 'completed' | 'skipped';
export interface Exercise {
  id: string;
  name: string;
  details: string;
  archived_at: number | null;
  created_at: number;
}
export interface Program {
  id: string;
  name: string;
  notes: string;
  archived_at: number | null;
  created_at: number;
}
export interface Prescription {
  id?: string;
  type: SetType;
  min_reps: number;
  max_reps: number;
  rest_ms: number;
}
export interface TemplateExercise {
  id?: string;
  exercise_id: string;
  sets: Prescription[];
}
export interface Template {
  id: string;
  program_id: string;
  name: string;
  notes: string;
  archived_at: number | null;
  version: number;
  created_at: number;
  exercises: TemplateExercise[];
}
export interface Assignment {
  id: string;
  week_id: string;
  template_id: string;
  name: string;
  withdrawn_at: number | null;
  completed: number;
}
export interface Week {
  id: string;
  start: number;
  end: number;
}
export interface Workout {
  week_id?: string;
  id: string;
  assignment_id: string;
  template_id: string;
  name: string;
  notes: string;
  status: WorkoutStatus;
  started_at: number;
  ended_at: number | null;
  version: number;
  resume_exercise_id: string | null;
  resume_set_id: string | null;
}
export interface ExerciseSession {
  id: string;
  workout_id: string;
  exercise_id: string;
  name: string;
  position: number;
  status: ActivityStatus;
  started_at: number | null;
  ended_at: number | null;
  removed_at: number | null;
  sets: SetSession[];
}
export interface SetSession {
  id: string;
  template_set_id: string | null;
  workout_id: string;
  exercise_session_id: string;
  position: number;
  type: SetType;
  min_reps: number;
  max_reps: number;
  rest_ms: number;
  status: ActivityStatus;
  actual_reps: number | null;
  actual_grams: number | null;
  prefill_grams: number | null;
  prefill_set_id: string | null;
  started_at: number | null;
  ended_at: number | null;
  notes: string;
  removed_at: number | null;
}
export interface Pause {
  id: string;
  workout_id: string;
  started_at: number;
  ended_at: number | null;
}
export interface Rest {
  id: string;
  workout_id: string;
  set_id: string;
  planned_ms: number;
  added_ms: number;
  timer_paused_at: number | null;
  timer_paused_ms: number;
  started_at: number;
  ended_at: number | null;
  reason: string | null;
}
export interface WorkoutDetail extends Workout {
  exercises: ExerciseSession[];
  pauses: Pause[];
  rests: Rest[];
}
export interface Metrics {
  workouts: number;
  sets: number;
  volume: number;
  duration: number;
}
export interface State {
  serverNow: number;
  exercises: Exercise[];
  programs: Program[];
  templates: Template[];
  selectedProgramId: string | null;
  week: Week;
  assignments: Assignment[];
  activeWorkout: WorkoutDetail | null;
  history: WorkoutDetail[];
  current: Metrics;
  previous: Metrics;
}
