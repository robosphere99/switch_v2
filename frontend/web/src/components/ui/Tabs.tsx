import React from "react";

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  className?: string;
}

export function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className = "",
}: TabsProps<T>) {
  return (
    <div className={`flex items-center gap-1 border-b border-night-600/70 overflow-x-auto no-scrollbar ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`group relative inline-flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-all duration-150 outline-none
              ${
                isActive
                  ? "text-brand font-semibold"
                  : "text-night-500 hover:text-night-950 dark:hover:text-gray-200"
              }`}
          >
            {tab.icon && (
              <span
                className={`transition-colors duration-150 ${
                  isActive ? "text-brand" : "text-gray-400 group-hover:text-night-950 dark:group-hover:text-gray-200"
                }`}
              >
                {tab.icon}
              </span>
            )}
            <span>{tab.label}</span>
            {tab.badge && <span>{tab.badge}</span>}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-brand" />
            )}
          </button>
        );
      })}
    </div>
  );
}
