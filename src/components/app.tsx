'use client';
import { ShowcaseBanner } from './showcase-banner';
import { Notification } from './ui/notification';
import { useState } from 'react';
import {
  LayoutDashboard,
  Dumbbell,
  Layers,
  History,
  Settings as SettingsIcon,
  ArrowUpRight,
} from 'lucide-react';
import type { State } from '@/domain/types';
import { useModel } from './use-model';
import { BottomDock } from './bottom-dock';
import { HistoryView } from './history/history';
import { ProgressView } from './history/progress';
import { ActiveWorkout } from './workout/active-workout';
import { Dashboard } from './dashboard';
import { Library } from './programming/library';
import { Programs } from './programming/programs';
import { AccountContext } from './account-context';
import { Settings } from './settings';
const nav = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'programs', label: 'Programs', icon: Layers },
  { id: 'library', label: 'Library', icon: Dumbbell },
  { id: 'history', label: 'History', icon: History },
];
export function App({ initial }: { initial: State }) {
  const model = useModel(initial);
  const [view, setView] = useState(initial.activeWorkout ? 'workout' : 'dashboard');
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [progressId, setProgressId] = useState<string | null>(null);
  const navigate = (v: string) => {
    setView(v);
    if (v !== 'history') setHistoryId(null);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  return (
    <AccountContext.Provider value={model.state.account}>
      <div className="app-shell">
        <aside className="sidebar">
          <button className="brand" onClick={() => navigate('dashboard')}>
            AUCTUS<span>/</span>
          </button>
          <p className="brand-caption">A little stronger, every day.</p>
          <nav aria-label="Main navigation">
            {nav.map((n) => (
              <button
                key={n.id}
                className={view === n.id ? 'nav-item selected' : 'nav-item'}
                onClick={() => navigate(n.id)}
              >
                <n.icon size={19} />
                {n.label}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="private-label">
              <span />
              {model.state.account.role === 'showcase'
                ? 'Your temporary demo space'
                : 'Your private training space'}
            </div>
            <button
              className={view === 'settings' ? 'nav-item selected' : 'nav-item'}
              onClick={() => navigate('settings')}
            >
              <SettingsIcon size={19} />
              Settings
            </button>
          </div>
        </aside>
        <div className="app-content">
          <header className="topbar">
            <span>
              TRAINING JOURNAL <span className="muted">/</span> {view.toUpperCase()}
            </span>
            <button
              className="small ghost"
              onClick={() => navigate('settings')}
              aria-label="Account settings"
            >
              {model.state.account.name}
              <ArrowUpRight size={14} />
            </button>
          </header>
          <main>
            {model.state.account.role === 'showcase' && (
              <ShowcaseBanner expiresAt={model.state.account.expiresAt!} />
            )}
            {model.offline && (
              <Notification tone="warning" persistent>
                Offline · Changes cannot be confirmed saved. Reconnect to continue.
              </Notification>
            )}
            {model.error && (
              <Notification key={model.error} onDismiss={model.clearError}>
                {model.error}{' '}
                <a href="/login" target="_blank" rel="noreferrer">
                  Sign in
                </a>
              </Notification>
            )}
            {model.pending && !model.busy && (
              <Notification tone="warning" persistent>
                <p>
                  One action has an unconfirmed result. Retrying the same request cannot save it
                  twice.
                </p>
                <div className="row">
                  <button onClick={model.retry}>Retry save</button>
                  <button onClick={model.discard}>Discard local request & refresh</button>
                </div>
              </Notification>
            )}
            <fieldset disabled={model.busy} className="app-fields" aria-busy={model.busy}>
              {view === 'dashboard' && (
                <Dashboard
                  state={model.state}
                  send={model.send}
                  navigate={navigate}
                  onHistory={(id) => {
                    setHistoryId(id);
                    navigate('history');
                  }}
                  onProgress={(id) => {
                    setProgressId(id);
                    navigate('progress');
                  }}
                />
              )}
              {view === 'library' && (
                <Library
                  workouts={model.state.history}
                  exercises={model.state.exercises}
                  send={model.send}
                  onPrograms={() => navigate('programs')}
                  onProgress={(id) => {
                    setProgressId(id);
                    navigate('progress');
                  }}
                />
              )}
              {view === 'history' && (
                <HistoryView
                  initialSelected={historyId}
                  workouts={model.state.history}
                  send={model.send}
                  onProgress={(id) => {
                    setProgressId(id);
                    navigate('progress');
                  }}
                />
              )}
              {view === 'progress' && progressId && (
                <ProgressView
                  key={progressId}
                  now={model.state.serverNow}
                  onHistory={(id) => {
                    setHistoryId(id);
                    navigate('history');
                  }}
                  exercise={model.state.exercises.find((e) => e.id === progressId)!}
                  workouts={model.state.history}
                  back={() => navigate('library')}
                />
              )}
              {view === 'programs' && (
                <Programs
                  state={model.state}
                  send={model.send}
                  locked={model.busy || !!model.pending}
                />
              )}
              {view === 'workout' && model.state.activeWorkout && (
                <ActiveWorkout
                  busy={model.busy}
                  state={model.state}
                  send={model.send}
                  finished={() => navigate('dashboard')}
                />
              )}
              {view === 'settings' && <Settings account={model.state.account} />}
            </fieldset>
            {model.busy && (
              <Notification tone="info" persistent>
                Saving to your journal…
              </Notification>
            )}
          </main>
          <footer className="app-footer">
            AUCTUS <span>Consistency compounds.</span>
          </footer>
        </div>
        <BottomDock
          workout={model.state.activeWorkout}
          serverNow={model.state.serverNow}
          send={model.send}
          busy={model.busy}
        >
          <nav className="mobile-nav" aria-label="Mobile navigation">
            {nav.map((n) => (
              <button
                key={n.id}
                className={view === n.id ? 'selected' : ''}
                onClick={() => navigate(n.id)}
              >
                <n.icon size={20} />
                <span>{n.label}</span>
              </button>
            ))}
          </nav>
        </BottomDock>
      </div>
    </AccountContext.Provider>
  );
}
