import { Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { ChatWidget } from "./components/ChatWidget";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useRealtime } from "./hooks/useRealtime";
import { Dashboard } from "./pages/Dashboard";
import { Settings } from "./pages/Settings";
import { DeviceKeys } from "./pages/DeviceKeys";
import { Homes } from "./pages/Homes";
import { Notifications } from "./pages/Notifications";
import { MyBoards } from "./pages/MyBoards";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Automations } from "./pages/Automations";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { Members } from "./pages/Members";
import { Profile } from "./pages/Profile";
import { Signup } from "./pages/Signup";
import { VoiceAssistants } from "./pages/VoiceAssistants";
import { OAuthConsent } from "./pages/OAuthConsent";
import { Admin } from "./pages/Admin";
import { Assistant } from "./pages/Assistant";
import { Shop } from "./pages/Shop";
import { Checkout } from "./pages/Checkout";
import { Orders } from "./pages/Orders";
import { Activate } from "./pages/Activate";
import { PrintSerials } from "./pages/PrintSerials";
import { PrintBill } from "./pages/PrintBill";
import { VerifyBill } from "./pages/VerifyBill";
import { AdminFlasherGuide } from "./components/AdminFlasherGuide";
import { UserWebRTCCallModal } from "./components/UserWebRTCCallModal";
import { Warranty } from "./pages/Warranty";
import { Support } from "./pages/Support";

import { useSiteStore } from "./stores/site";
import { api } from "./api/client";
import { useAuthStore } from "./stores/auth";

export default function App() {
  useRealtime();
  // Force Vercel rebuild to apply API proxy changes
  const loadSite = useSiteStore((s) => s.load);
  const user = useAuthStore((s) => s.user);

  // 1. Cross-tab synchronization
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      // If another tab updates the auth state, force rehydrate our local Zustand store
      if (e.key === "robosphere-auth" && e.newValue) {
        useAuthStore.persist.rehydrate();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // 2. Clear stale cache silently on root mount
  useEffect(() => {
    if (user) {
      api.get("/auth/me").then(res => {
        if (res.data?.success && res.data.data) {
          useAuthStore.getState().setUser(res.data.data);
        }
      }).catch(() => { });
    }
  }, []);

  // Site-wide settings (brand color, contact info) — login se pehle bhi apply ho jaye
  useEffect(() => {
    void loadSite();
  }, [loadSite]);

  // Browser ka default right-click menu (Back/Reload/Save/Inspect etc.) disable —
  // inputs/textarea chhodkar (wahan paste ke liye chahiye). App ke custom menus khud chalte hain.
  useEffect(() => {
    const onContext = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input") || t.closest("textarea") || t.closest("[contenteditable='true']"))) return;
      e.preventDefault();
    };
    document.addEventListener("contextmenu", onContext);
    return () => document.removeEventListener("contextmenu", onContext);
  }, []);

  // Setup mode removed: DB is configured via .env variables for Vercel/Neon

  return (
    /* overflow-x-clip: mobile pe horizontal scroll na ho; pb-24: bottom tab
       bar ke neeche content chhupa na rahe (desktop pe koi effect nahi) */
    <div className="min-h-screen overflow-x-clip">
      <Navbar />
      <ChatWidget />
      <UserWebRTCCallModal />
      <main className="pb-24 md:pb-0">
        <Routes>
          <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/shop" element={<Shop />} />
          {/* Bill QR scan → public genuineness verify (bina login) */}
          <Route path="/verify/bill/:token" element={<VerifyBill />} />
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
            path="/settings"
            element={
              <ProtectedRoute customerOnly>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/automations"
            element={
              <ProtectedRoute customerOnly>
                <Automations />
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
            path="/voice-assistants"
            element={
              <ProtectedRoute>
                <VoiceAssistants />
              </ProtectedRoute>
            }
          />
          <Route
            path="/oauth/consent"
            element={
              <ProtectedRoute>
                <OAuthConsent />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Suspense fallback={<div className="p-10 text-center text-gray-500">Loading…</div>}>
                  <Admin />
                </Suspense>
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
          <Route
            path="/admin/bill/:orderId"
            element={
              <ProtectedRoute>
                <PrintBill />
              </ProtectedRoute>
            }
          />
          {/* Flasher Guide — flasher GUI ka "📖 Guide" button isi ko kholta hai */}
          <Route
            path="/admin/flasher-guide"
            element={
              <ProtectedRoute>
                <AdminFlasherGuide />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
