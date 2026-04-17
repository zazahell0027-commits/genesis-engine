import React from "react";
import { Link, NavLink } from "react-router-dom";
import { useUiLocale } from "../i18n";
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
  const { locale, setLocale, t } = useUiLocale();

  return (
    <header className={`chrome-header${props.isGameRoute ? " is-game" : ""}`}>
      <Link to="/" className="brand-lockup">
        <span className="brand-mark">
          <GlassGlobeIcon />
        </span>
        <span className="brand-text">
          <span>Genesis</span>
          <span>Atlas</span>
        </span>
      </Link>

      <nav className="main-nav">
        <NavLink to="/games" className={({ isActive }) => `nav-pill${isActive ? " is-active" : ""}`}>
          <GamepadIcon />
          <span>{t("header.games", "Games")}</span>
        </NavLink>
        <NavLink to="/presets" className={({ isActive }) => `nav-pill${isActive ? " is-active" : ""}`}>
          <PlayFlagIcon />
          <span>{t("header.presets", "Presets")}</span>
        </NavLink>
        <NavLink to="/flags" className={({ isActive }) => `nav-pill${isActive ? " is-active" : ""}`}>
          <FlagIcon />
          <span>{t("header.flags", "Flags")}</span>
        </NavLink>
        <NavLink to="/community" className={({ isActive }) => `nav-pill${isActive ? " is-active" : ""}`}>
          <CommunityIcon />
          <span>{t("header.community", "Community")}</span>
        </NavLink>
      </nav>

      <div className="header-meta">
        <div className="language-switch" role="group" aria-label={t("header.language", "Language")}>
          <button
            type="button"
            className={`language-pill${locale === "fr" ? " is-active" : ""}`}
            onClick={() => setLocale("fr")}
            aria-label="Francais"
          >
            FR
          </button>
          <button
            type="button"
            className={`language-pill${locale === "en" ? " is-active" : ""}`}
            onClick={() => setLocale("en")}
            aria-label="English"
          >
            EN
          </button>
        </div>
        <button type="button" className="meta-icon-button" aria-label={t("header.gift", "Gift")}>
          <GiftIcon />
        </button>
        <div className="token-pill">
          <CoinIcon />
          <span>{props.tokenLabel}</span>
        </div>
        <button type="button" className="profile-pill" aria-label={t("header.profile", "Profile")}>
          <AvatarIcon />
        </button>
      </div>
    </header>
  );
}
