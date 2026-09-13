import {
  Home,
  Package,
  ShieldCheck,
  BadgeCheck,
  RadioTower,
  Users,
  Bot,
  Mic,
  Clock,
  Activity,
  Wrench,
  Bell,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";

export interface NavItemDef {
  to: string;
  label: string;
  icon: LucideIcon;
  title?: string;
}

export interface NavGroup {
  title: string;
  items: NavItemDef[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Shop",
    items: [{ to: "/shop", label: "Shop", icon: ShoppingCart }],
  },
  {
    title: "Orders & Devices",
    items: [
      { to: "/orders", label: "Orders", icon: Package, title: "My Orders" },
      { to: "/warranty", label: "Warranty", icon: ShieldCheck },
      { to: "/keys", label: "Device Keys", icon: BadgeCheck },
    ],
  },
  {
    title: "Smart Home",
    items: [
      { to: "/homes", label: "Homes", icon: Home },
      { to: "/boards", label: "Boards", icon: RadioTower },
      { to: "/members", label: "Family", icon: Users },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { to: "/assistant", label: "AI", icon: Bot },
      { to: "/voice-assistants", label: "Voice Apps", icon: Mic },
      { to: "/automations", label: "Automations", icon: Clock },
    ],
  },
  {
    title: "Support & Help",
    items: [
      { to: "/settings", label: "Audit Logs", icon: Activity },
      { to: "/support", label: "Support", icon: Wrench },
      { to: "/notifications", label: "Alerts", icon: Bell },
    ],
  },
];
