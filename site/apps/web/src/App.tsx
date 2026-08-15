import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { ChatWidget } from "./components/ChatWidget";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useRealtime } from "./hooks/useRealtime";
import { Dashboard } from "./pages/Dashboard";
import { DeviceKeys } from "./pages/DeviceKeys";
import { Homes } from "./pages/Homes";
import { Notifications } from "./pages/Notifications";
import { MyBoards } from "./pages/MyBoards";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Members } from "./pages/Members";
import { Profile } from "./pages/Profile";
import { Signup } from "./pages/Signup";
import { Admin } from "./pages/Admin";
import { Assistant } from "./pages/Assistant";
import { Shop } from "./pages/Shop";
import { Checkout } from "./pages/Checkout";
import { Orders } from "./pages/Orders";
import { Activate } from "./pages/Activate";
import { PrintSerials } from "./pages/PrintSerials";
import { Warranty } from "./pages/Warranty";
import { Support } from "./pages/Support";
import { Install } from "./pages/Install";
import { getInstallStatus } from "./api/install";
import { useSiteStore } from "./stores/site";

export default function App() {
  useRealtime();
  const loadSite = useSiteStore((s) => s.load);

  // Site-wide settings (brand color, contact info) — login se pehle bhi apply ho jaye
  useEffect(() => {
    void loadSite();
  }, [loadSite]);

  // First-run gate: DB/tables nahi hain to pura app ki jagah install wizard.
  const [installState, setInstallState] = useState<"checking" | "installed" | "setup">("checking");

  useEffect(() => {
    getInstallStatus()
      .then((s) => setInstallState(s.installed ? "installed" : "setup"))
      .catch(() => setInstallState("installed")); // API down ho to site normal dikhao
  }, []);

  if (installState === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Checking installation...
      </div>
    );
  }

  if (installState === "setup") {
    return <Install />;
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <ChatWidget />
      <main>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/shop" element={<Shop />} />
          <Route
            path="/checkout"
            element={
              <ProtectedRoute customerOnly>
                <Checkout />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute customerOnly>
                <Orders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/support"
            element={
              <ProtectedRoute>
                <Support />
              </ProtectedRoute>
            }
          />
          <Route
            path="/warranty"
            element={
              <ProtectedRoute customerOnly>
                <Warranty />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activate"
            element={
              <ProtectedRoute customerOnly>
                <Activate />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute customerOnly>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/members"
            element={
              <ProtectedRoute customerOnly>
                <Members />
              </ProtectedRoute>
            }
          />
          <Route
            path="/keys"
            element={
              <ProtectedRoute customerOnly>
                <DeviceKeys />
              </ProtectedRoute>
            }
          />
          <Route
            path="/homes"
            element={
              <ProtectedRoute customerOnly>
                <Homes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/boards"
            element={
              <ProtectedRoute customerOnly>
                <MyBoards />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assistant"
            element={
              <ProtectedRoute customerOnly>
                <Assistant />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/print"
            element={
              <ProtectedRoute>
                <PrintSerials />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
