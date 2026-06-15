import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import FacultyDashboard from './pages/faculty/FacultyDashboard';
import FacultySubjects from './pages/faculty/FacultySubjects';
import FacultySubjectDetail from './pages/faculty/FacultySubjectDetail';
import StudentDashboard from './pages/student/StudentDashboard';
import MarkAttendance from './pages/student/MarkAttendance';
import StudentSubjectDetail from './pages/student/StudentSubjectDetail';
import { FullScreenLoader } from './components/Spinner';

function RootRedirect() {
  const { user, initializing } = useAuth();
  if (initializing) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'faculty' ? '/faculty' : '/student'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route
              path="/faculty"
              element={
                <ProtectedRoute roles={['faculty']}>
                  <FacultyDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/faculty/subjects"
              element={
                <ProtectedRoute roles={['faculty']}>
                  <FacultySubjects />
                </ProtectedRoute>
              }
            />
            <Route
              path="/faculty/subjects/:id"
              element={
                <ProtectedRoute roles={['faculty']}>
                  <FacultySubjectDetail />
                </ProtectedRoute>
              }
            />

            <Route
              path="/student"
              element={
                <ProtectedRoute roles={['student']}>
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/mark"
              element={
                <ProtectedRoute roles={['student']}>
                  <MarkAttendance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/subjects/:id"
              element={
                <ProtectedRoute roles={['student']}>
                  <StudentSubjectDetail />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
