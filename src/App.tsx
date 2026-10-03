import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { TopBar } from './components/layout/Navigation';

// Pages
import { Dashboard } from './pages/Dashboard';
import { Health } from './pages/Health';
import { Conditions } from './pages/Conditions';
import { Medicines } from './pages/Medicines';
import { Articles } from './pages/Articles';
import { HealthDetails } from './pages/HealthDetails';
import { Medications } from './pages/Medications';
import { AddMedication } from './pages/AddMedication';
import { Appointments } from './pages/Appointments';
import { Doctors } from './pages/Doctors';
import { BookAppointment } from './pages/BookAppointment';
import { AppointmentDetails } from './pages/AppointmentDetails';
import { Profile } from './pages/Profile';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      {/* Mobile top bar – shown on all pages */}
      <TopBar />

      <Routes>
        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Health information */}
        <Route path="/health" element={<Health />} />
        <Route path="/health/conditions" element={<Conditions />} />
        <Route path="/health/medicines" element={<Medicines />} />
        <Route path="/health/articles" element={<Articles />} />
        <Route path="/health/:id" element={<HealthDetails />} />

        {/* Medications */}
        <Route path="/medications" element={<Medications />} />
        <Route path="/medications/add" element={<AddMedication />} />

        {/* Appointments */}
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/appointments/doctors" element={<Doctors />} />
        <Route path="/appointments/book" element={<BookAppointment />} />
        <Route path="/appointments/:id" element={<AppointmentDetails />} />

        {/* Profile */}
        <Route path="/profile" element={<Profile />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
