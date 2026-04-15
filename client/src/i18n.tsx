import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type UiLocale = "fr" | "en";

type Dictionary = Record<string, string>;

const dictionaries: Record<UiLocale, Dictionary> = {
  fr: {
    "header.games": "Parties",
    "header.presets": "Scenarios",
    "header.flags": "Drapeaux",
    "header.community": "Communaute",
    "header.gift": "Cadeau",
    "header.profile": "Profil",
    "header.language": "Langue",
    "launch.communityPreset": "Preset communaute",
    "launch.officialPreset": "Preset officiel",
    "launch.searchCountry": "Rechercher un pays",
    "launch.searchPlaceholder": "France, Allemagne, Japon...",
    "launch.recommendedCountries": "Pays recommandes",
    "launch.availableCountries": "Pays disponibles",
    "launch.step": "Etape 1/2",
    "launch.selectCountry": "Selectionnez un pays",
    "launch.chooseNation": "Choisissez votre nation avant de configurer la partie.",
    "launch.cancel": "Annuler",
    "launch.continue": "Continuer",
    "launch.noCountry": "Aucun pays trouve pour cette recherche.",
    "launch.noCountrySelected": "Aucun pays selectionne",
    "launch.goBackAndPick": "Revenez en arriere et choisissez un pays.",
    "launch.scenarioBrief": "Brief du scenario",
    "launch.difficulty": "Difficulte",
    "launch.aiQuality": "Qualite I.A.",
    "launch.back": "Retour",
    "launch.starting": "Demarrage...",
    "launch.startGame": "Demarrer la partie",
    "launch.loadingSetup": "Chargement des options de demarrage...",
    "launch.close": "Fermer la fenetre de lancement",
    "launch.theatre": "theatre"
  },
  en: {
    "header.games": "Games",
    "header.presets": "Presets",
    "header.flags": "Flags",
    "header.community": "Community",
    "header.gift": "Gift",
    "header.profile": "Profile",
    "header.language": "Language",
    "launch.communityPreset": "Community preset",
    "launch.officialPreset": "Official preset",
    "launch.searchCountry": "Search country",
    "launch.searchPlaceholder": "France, Germany, Japan...",
    "launch.recommendedCountries": "Recommended countries",
    "launch.availableCountries": "Available countries",
    "launch.step": "Step 1/2",
    "launch.selectCountry": "Select a country",
    "launch.chooseNation": "Choose your nation before configuring the game.",
    "launch.cancel": "Cancel",
    "launch.continue": "Continue",
    "launch.noCountry": "No country found for this search.",
    "launch.noCountrySelected": "No country selected",
    "launch.goBackAndPick": "Go back and pick a country first.",
    "launch.scenarioBrief": "Scenario brief",
    "launch.difficulty": "Difficulty",
    "launch.aiQuality": "A.I. Quality",
    "launch.back": "Back",
    "launch.starting": "Starting...",
    "launch.startGame": "Start Game",
    "launch.loadingSetup": "Loading setup options...",
    "launch.close": "Close launch modal",
    "launch.theatre": "theatre"
  }
};

function readInitialLocale(): UiLocale {
  if (typeof window === "undefined") return "fr";
  const stored = window.localStorage.getItem("genesis-ui-locale");
  if (stored === "fr" || stored === "en") return stored;
  const browser = window.navigator.language.toLowerCase();
  return browser.startsWith("fr") ? "fr" : "en";
}

type UiLocaleContextValue = {
  locale: UiLocale;
  setLocale: (locale: UiLocale) => void;
  t: (key: string, fallback?: string) => string;
};

const UiLocaleContext = createContext<UiLocaleContextValue | null>(null);

export function UiLocaleProvider(props: { children: React.ReactNode }): React.JSX.Element {
  const [locale, setLocale] = useState<UiLocale>(() => readInitialLocale());

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("genesis-ui-locale", locale);
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const value = useMemo<UiLocaleContextValue>(() => ({
    locale,
    setLocale,
    t: (key: string, fallback?: string) => dictionaries[locale][key] ?? fallback ?? key
  }), [locale]);

  return <UiLocaleContext.Provider value={value}>{props.children}</UiLocaleContext.Provider>;
}

export function useUiLocale(): UiLocaleContextValue {
  const value = useContext(UiLocaleContext);
  if (!value) {
    throw new Error("useUiLocale must be used inside UiLocaleProvider");
  }
  return value;
}
