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

export default function App() {
  useRealtime();

  // First-run gate: DB/tables nahi hain to pura app ki jagah install wizard.
  const [installState, setInstallState] = useState<"checking" | "installed" | "setup">("checking");

  useEffect(() => {
    getInstallStatus()
      .then((s) => setInstallState(s.installed ? "installed" : "setup"))
      .catch(() => setInstallState("installed")); // API down ho to site normal dikhao
  }, []);

  if (installState === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400">
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
              <ProtectedRoute>
                <Checkout />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
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
              <ProtectedRoute>
                <Warranty />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activate"
            element={
              <ProtectedRoute>
                <Activate />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/members"
            element={
              <ProtectedRoute>
                <Members />
              </ProtectedRoute>
            }
          />
          <Route
            path="/keys"
            element={
              <ProtectedRoute>
                <DeviceKeys />
              </ProtectedRoute>
            }
          />
          <Route
            path="/homes"
            element={
              <ProtectedRoute>
                <Homes />
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
              <ProtectedRoute>
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
