import React from "react";
import { Link, NavLink } from "react-router-dom";
import {
  AvatarIcon,
  CoinIcon,
  CommunityIcon,
  FlagIcon,
  GamepadIcon,
  GiftIcon,
  GlassGlobeIcon,
  PlayFlagIcon
} from "./Icons";

export function ChromeHeader(props: {
  tokenLabel: string;
  isGameRoute: boolean;
}): React.JSX.Element {
  return (
    <header className={`chrome-header${props.isGameRoute ? " is-game" : ""}`}>
      <Link to="/" className="brand-lockup">
        <span className="brand-mark">
          <GlassGlobeIcon />
        </span>
        <span className="brand-text">
          <span>Pax</span>
          <span>Historia</span>
        </span>
      </Link>

      <nav className="main-nav">
        <NavLink to="/games" className={({ isActive }) => `nav-pill${isActive ? " is-active" : ""}`}>
          <GamepadIcon />
          <span>Games</span>
        </NavLink>
        <NavLink to="/presets" className={({ isActive }) => `nav-pill${isActive ? " is-active" : ""}`}>
          <PlayFlagIcon />
          <span>Presets</span>
        </NavLink>
        <NavLink to="/flags" className={({ isActive }) => `nav-pill${isActive ? " is-active" : ""}`}>
          <FlagIcon />
          <span>Flags</span>
        </NavLink>
        <NavLink to="/community" className={({ isActive }) => `nav-pill${isActive ? " is-active" : ""}`}>
          <CommunityIcon />
          <span>Community</span>
        </NavLink>
      </nav>

      <div className="header-meta">
        <button type="button" className="meta-icon-button" aria-label="Gift">
          <GiftIcon />
        </button>
        <div className="token-pill">
          <CoinIcon />
          <span>{props.tokenLabel}</span>
        </div>
        <button type="button" className="profile-pill" aria-label="Profile">
          <AvatarIcon />
        </button>
      </div>
    </header>
  );
}
