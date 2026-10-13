import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { TopBar } from './components/layout/Navigation';

// Auth Pages
import { Login } from './pages/Login';
import { Register } from './pages/Register';

// Core Pages
import { Dashboard } from './pages/Dashboard';
import { Health } from './pages/Health';
import { Conditions } from './pages/Conditions';
import { Medicines } from './pages/Medicines';
import { Articles } from './pages/Articles';
import { HealthDetails } from './pages/HealthDetails';
import { Medications } from './pages/Medications';
import { AddMedication } from './pages/AddMedication';
import { EditMedication } from './pages/EditMedication';
import { Appointments } from './pages/Appointments';
import { Doctors } from './pages/Doctors';
import { BookAppointment } from './pages/BookAppointment';
import { AppointmentDetails } from './pages/AppointmentDetails';
import { Profile } from './pages/Profile';
import { Notifications } from './pages/Notifications';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/* Mobile top bar – shown on all pages */}
        <TopBar />

        <Routes>
          {/* Public Authentication routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Dashboard */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Public Health information */}
          <Route path="/health" element={<Health />} />
          <Route path="/health/conditions" element={<Conditions />} />
          <Route path="/health/medicines" element={<Medicines />} />
          <Route path="/health/articles" element={<Articles />} />
          <Route path="/health/:id" element={<HealthDetails />} />

          {/* Protected Medications routes */}
          <Route
            path="/medications"
            element={
              <ProtectedRoute>
                <Medications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/medications/add"
            element={
              <ProtectedRoute>
                <AddMedication />
              </ProtectedRoute>
            }
          />
          <Route
            path="/medications/:id/edit"
            element={
              <ProtectedRoute>
                <EditMedication />
              </ProtectedRoute>
            }
          />

          {/* Appointments */}
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/appointments/doctors" element={<Doctors />} />
          <Route
            path="/appointments/book"
            element={
              <ProtectedRoute>
                <BookAppointment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/appointments/:id"
            element={
              <ProtectedRoute>
                <AppointmentDetails />
              </ProtectedRoute>
            }
          />

          {/* Protected Profile */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          {/* Protected Notifications Center */}
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
