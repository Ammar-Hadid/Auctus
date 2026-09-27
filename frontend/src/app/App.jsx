import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { ToastProvider } from "../shared/context/toastContext.jsx";
import { ConfirmProvider } from "../shared/context/confirmContext.jsx";


import AuthPage from "../features/auth/pages/AuthPage.jsx"

import MainLayout from "../shared/layout/MainLayout.jsx";
import Dashboard from "../features/dashboard/pages/Dashboard.page.jsx";

import ProgramsPage from "../features/programs/pages/Programs.page.jsx";
import WorkoutsPage from "../features/workouts/pages/Workouts.page.jsx";
import ExercisePage from "../features/exercises/pages/Exercises.page.jsx";

import { requireUser } from "../features/auth/loaders/requireUser.loader.js";
import { redirectIfAuthenticated } from "../features/auth/loaders/redirectIfAuthenticated.loader.js";

import { dashboardLoader } from "../features/dashboard/loaders/getDashboard.loader.js";
import WorkoutSession from "../features/sessions/workoutSession/pages/WorkoutSession.Page.jsx";
import { workoutSessionLoader } from "../features/sessions/workoutSession/loaders/workoutSession.loader.js";
import { requireOnboarding } from "../features/onboarding/loaders/onboarding.loader.js";
import Onboarding from "../features/onboarding/pages/Onboarding.page.jsx";

const router = createBrowserRouter([

  {
    id: 'root',
    element: <MainLayout />,
    loader: requireUser,

    children: [
      {
        path: '/',
        element: <Dashboard />,
        loader: dashboardLoader,
        handle: {
          getTitle: (user) => `Welcome back ${user.userName}`,
        },
      },

      {
        path: '/programs',
        element: <ProgramsPage />,
        handle: {
          title: 'Programs',
        },
      },

      {
        path: '/programs/:programId/workouts',
        element: <WorkoutsPage />,
        handle: {
          title: 'Workouts',
        },
      },

      {
        path: '/programs/:programId/workouts/:workoutId/exercises',
        element: <ExercisePage />,
        handle: {
          title: 'Exercises',
        },
      },

      {
        path: '/workout-sessions/:workoutSessionId',
        element: <WorkoutSession />,
        loader: workoutSessionLoader,
        handle: {
          title: 'Workout session',
        },
      }
    ]
  },

  {
    path: '/onboarding',
    element: <Onboarding />,
    loader: requireOnboarding
  },

  {
    path: '/login',
    element: <AuthPage />,
    loader: redirectIfAuthenticated,
  },

])


function App() {

  return (
    <ToastProvider>
      <ConfirmProvider>
        <RouterProvider router={router} />
      </ConfirmProvider>
    </ToastProvider>
  )


}

export default App
