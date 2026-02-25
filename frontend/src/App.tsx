import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getMe, logout, type User } from "./api";
import { applySettings, loadSettings } from "./uiSettings";
import Home from "./pages/Home";
import Discover from "./pages/Discover";
import Chat from "./pages/Chat";
import CreateCharacter from "./pages/CreateCharacter";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import Auth from "./pages/Auth";
import Lorebooks from "./pages/Lorebooks";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    applySettings(loadSettings());
    getMe()
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const onLogout = async () => {
    await logout();
    setUser(null);
    navigate("/");
  };

  if (loading) {
    return <div className="main">Loading...</div>;
  }

  if (!user) {
    return <Auth onAuthed={setUser} />;
  }

  const adminEmail = "nikodemszczotka01@gmail.com";
  const isAdmin = user.role === "admin" || user.email === adminEmail;
  const userKey = user.id;

  const links = useMemo(
    () => [
      { to: "/", label: "Home" },
      { to: "/discover", label: "Discover" },
      { to: "/chat", label: "Chat" },
      { to: "/create", label: "Create" },
      { to: "/lorebooks", label: "Lorebooks" },
      { to: "/profile", label: "Profile" },
      { to: "/settings", label: "Settings" }
    ],
    []
  );

  return (
    <div className="app-shell">
      <button className="sidebar-toggle" onClick={() => setSidebarOpen((v) => !v)}>
        Menu
      </button>
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <NavLink to="/" className="logo" onClick={() => setSidebarOpen(false)}>
          Character Studio
        </NavLink>
        <div className="sidebar-section">Workspace</div>
        <div className="nav">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === "/"} onClick={() => setSidebarOpen(false)}>
              {link.label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink to="/admin" onClick={() => setSidebarOpen(false)}>
              Admin
            </NavLink>
          )}
        </div>
        <div className="sidebar-footer">
          <div className="badge">{user.email}</div>
          <button className="ghost-button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </aside>
      <main className="main" onClick={() => sidebarOpen && setSidebarOpen(false)}>
        <Routes key={userKey}>
          <Route path="/" element={<Home />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/chat" element={<Chat userId={user.id} />} />
          <Route path="/create" element={<CreateCharacter />} />
          <Route path="/lorebooks" element={<Lorebooks />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          {isAdmin && <Route path="/admin" element={<Admin />} />}
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
    </div>
  );
}
