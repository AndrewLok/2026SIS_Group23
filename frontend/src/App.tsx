import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell, RedirectIfAuthed, RequireAuth } from '@/components/layout/AppShell'
import { TripLayout } from '@/components/layout/TripLayout'
import { LoginPage } from '@/pages/LoginPage'
import { JoinPage } from '@/pages/JoinPage'
import { TripsPage } from '@/pages/TripsPage'
import { TripOverviewPage } from '@/pages/TripOverviewPage'
import { MembersPage } from '@/pages/MembersPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ActivitiesPage } from '@/pages/ActivitiesPage'
import { CalendarPage } from '@/pages/CalendarPage'
import { ExpensesPage } from '@/pages/ExpensesPage'
import { FuelPage } from '@/pages/FuelPage'
import { BookingsPage } from '@/pages/BookingsPage'
import { ChatPage } from '@/pages/ChatPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/trips" replace />} />

        <Route element={<RedirectIfAuthed />}>
          <Route path="login" element={<LoginPage />} />
        </Route>

        {/* The join preview is public; joining itself needs a session. */}
        <Route path="join/:code" element={<JoinPage />} />

        <Route element={<RequireAuth />}>
          <Route path="trips" element={<TripsPage />} />
          <Route path="trips/:tripId" element={<TripLayout />}>
            <Route index element={<TripOverviewPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="activities" element={<ActivitiesPage />} />
            {/* The old address, kept so saved links still land somewhere. */}
            <Route path="voting" element={<Navigate to="../activities" replace />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="expenses" element={<ExpensesPage />} />
            <Route path="fuel" element={<FuelPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="chat" element={<ChatPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
