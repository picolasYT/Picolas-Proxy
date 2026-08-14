import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { api } from "./lib/api";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { ProxyPage } from "./pages/Proxy";
import { Devices } from "./pages/Devices";
import { Traffic } from "./pages/Traffic";
import { Security } from "./pages/Security";
import { Logs } from "./pages/Logs";
import { Settings } from "./pages/Settings";

function RequireAuth({ children }: { children: JSX.Element }) {
  const [status, setStatus] = useState<"loading" | "authed" | "guest">("loading");

  useEffect(() => {
    api
      .me()
      .then(() => setStatus("authed"))
      .catch(() => setStatus("guest"));
  }, []);

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Cargando Picolas Proxy...</div>;
  }
  if (status === "guest") return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/proxy" element={<ProxyPage />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/traffic" element={<Traffic />} />
          <Route path="/security" element={<Security />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
