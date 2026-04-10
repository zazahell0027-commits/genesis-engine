import React from "react";

export function formatMoney(value: number): string {
  return `$${value.toFixed(3)}`;
}

export function GlassGlobeIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 12h17" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M12 3.5c2.8 2.1 4.5 5.1 4.5 8.5s-1.7 6.4-4.5 8.5c-2.8-2.1-4.5-5.1-4.5-8.5s1.7-6.4 4.5-8.5Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.7 7.8h12.6M5.7 16.2h12.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function GamepadIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="8" width="16" height="9" rx="4.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 12.5h3M9.5 11v3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16.2" cy="12" r="1.1" fill="currentColor" />
      <circle cx="18.2" cy="14" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function PlayFlagIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 4.5v15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7.5 5.6 18 9.2l-10.5 3.7Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function FlagIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 4v16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7.5 5h9l-2 4 2 4h-9Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function CommunityIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="10" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="10" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.5 18c1.2-2.5 3-3.7 5.4-3.7 2.1 0 3.8 1.1 4.9 3.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12.8 17.8c.9-1.9 2.3-2.8 4.3-2.8 1.5 0 2.8.6 3.9 2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function GiftIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4.5" y="9" width="15" height="10.5" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 9v10.5M4.5 13.1h15" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 9c-1.9 0-3.5-.9-3.5-2.5S9.7 4 11 4c1.1 0 1.9.7 3 5Zm0 0c1.9 0 3.5-.9 3.5-2.5S14.3 4 13 4c-1.1 0-1.9.7-3 5Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function CoinIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9.5 8.5h5m-5 7h5M12 7.8v8.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function AvatarIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8.4" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.8 18.8c1.5-2.8 3.7-4.2 6.2-4.2s4.7 1.4 6.2 4.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function SearchIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m15.2 15.2 4.2 4.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ChatIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5.5 6.2h13a2 2 0 0 1 2 2V14a2 2 0 0 1-2 2H12l-4.3 3v-3H5.5a2 2 0 0 1-2-2V8.2a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="8.7" cy="11.1" r="1" fill="currentColor" />
      <circle cx="12" cy="11.1" r="1" fill="currentColor" />
      <circle cx="15.3" cy="11.1" r="1" fill="currentColor" />
    </svg>
  );
}

export function SparkIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11.8 3.5 8.9 11h4.3L11.6 20.5 17 11h-4l2.5-7.5Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

export function MenuIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="5.2" r="1.7" fill="currentColor" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" />
      <circle cx="12" cy="18.8" r="1.7" fill="currentColor" />
    </svg>
  );
}

export function ArrowLeftIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m14.6 5.4-6.2 6.6 6.2 6.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowRightIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9.4 5.4 6.2 6.6-6.2 6.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CalendarIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4.2" y="5.8" width="15.6" height="13.2" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 4.4v3M16 4.4v3M4.2 9.5h15.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function MapIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m4.5 6.1 5-1.6 5 1.6 5-1.6v13.4l-5 1.6-5-1.6-5 1.6Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9.5 4.5v13.4M14.5 6.1v13.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
