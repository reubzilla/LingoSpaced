import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import Login from "./pages/Login";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import StudySession from "./pages/StudySession";

function AppContent() {
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const storedUser = localStorage.getItem("lingospaced_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogin = (selectedUser: any) => {
    localStorage.setItem("lingospaced_user", JSON.stringify(selectedUser));
    setUser(selectedUser);
    if (selectedUser.role === "teacher") {
      navigate("/teacher");
    } else {
      navigate("/student");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("lingospaced_user");
    setUser(null);
    navigate("/");
  };

  // Protect routes based on role
  useEffect(() => {
    if (user) {
      if (user.role === "teacher" && location.pathname.startsWith("/student")) {
        navigate("/teacher");
      } else if (user.role === "student" && location.pathname.startsWith("/teacher")) {
        navigate("/student");
      }
    }
  }, [user, location.pathname, navigate]);

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-bold text-emerald-600 tracking-tight">LingoSpaced</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-600">
            {user.name} ({user.role})
          </span>
          <button
            onClick={handleLogout}
            className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-6">
        <Routes>
          <Route
            path="/"
            element={
              user.role === "teacher" ? (
                <Navigate to="/teacher" replace />
              ) : (
                <Navigate to="/student" replace />
              )
            }
          />
          <Route path="/teacher/*" element={<TeacherDashboard user={user} />} />
          <Route path="/student/*" element={<StudentDashboard user={user} />} />
          <Route path="/study/:setId" element={<StudySession user={user} />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
