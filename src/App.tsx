import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import FlightsPage from "./pages/FlightsPage";
import ChecklistPage from "./pages/ChecklistPage";
import LeavePage from "./pages/LeavePage";
import HolidaysPage from "./pages/HolidaysPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./auth";
import { useState } from "react";

function App() {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <Router>
      <div className="app-container">

        {/* MAIN HEADING */}
        <h1
          style={{ cursor: "pointer", marginBottom: "10px" }}
          onClick={() => setShowMenu(!showMenu)}
        >
          Funadhoo Airport Ops & Roster System
        </h1>

        {/* MAIN MENU UNDER HEADING */}
        {showMenu && (
          <div className="main-menu" style={{ marginBottom: "20px" }}>
            <a href="/dashboard">Dashboard</a>
            <a href="/flights">Operations</a>
            <a href="/checklist">Roster & HR</a>
            <a href="/settings">System & Setting</a>
          </div>
        )}

        {/* ROUTES */}
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/flights" element={<FlightsPage />} />
          <Route path="/checklist" element={<ChecklistPage />} />
          <Route path="/leave" element={<LeavePage />} />
          <Route path="/holidays" element={<HolidaysPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
