import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { SpatialKnowledgeTier } from "@genesis/shared";

export type UiLocale = "fr" | "en";

type Dictionary = Record<string, string>;

const COUNTRY_DESCRIPTOR_TRANSLATIONS: Record<UiLocale, Record<string, string>> = {
  fr: {
    "story-heavy regional actor": "acteur regional a forte charge narrative",
    "volatile power broker": "courtier de puissance volatil",
    "industrial heavyweight": "poids lourd industriel",
    "flashpoint frontier": "frontiere de tension",
    "diplomatic hinge state": "etat charniere diplomatique",
    "strategic continental power": "puissance continentale strategique",
    "rising regional balance": "equilibre regional en ascension",
    "regional actor": "acteur regional"
  },
  en: {}
};

const COUNTRY_NAME_TRANSLATIONS: Record<string, string> = {
  "united states": "Etats-Unis",
  "united states of america": "Etats-Unis",
  germany: "Allemagne",
  france: "France",
  "united kingdom": "Royaume-Uni",
  england: "Angleterre",
  scotland: "Ecosse",
  wales: "Pays de Galles",
  ireland: "Irlande",
  poland: "Pologne",
  turkey: "Turquie",
  russia: "Russie",
  ukraine: "Ukraine",
  china: "Chine",
  japan: "Japon",
  india: "Inde",
  italy: "Italie",
  spain: "Espagne",
  portugal: "Portugal",
  greece: "Grece",
  romania: "Roumanie",
  bulgaria: "Bulgarie",
  hungary: "Hongrie",
  slovakia: "Slovaquie",
  czechia: "Tchequie",
  "czech republic": "Tchequie",
  austria: "Autriche",
  switzerland: "Suisse",
  belgium: "Belgique",
  netherlands: "Pays-Bas",
  denmark: "Danemark",
  norway: "Norvege",
  sweden: "Suede",
  finland: "Finlande",
  iceland: "Islande",
  greenland: "Groenland",
  canada: "Canada",
  mexico: "Mexique",
  brazil: "Bresil",
  argentina: "Argentine",
  chile: "Chili",
  peru: "Perou",
  colombia: "Colombie",
  venezuela: "Venezuela",
  morocco: "Maroc",
  algeria: "Algerie",
  tunisia: "Tunisie",
  libya: "Libye",
  egypt: "Egypte",
  nigeria: "Nigeria",
  niger: "Niger",
  mali: "Mali",
  ghana: "Ghana",
  senegal: "Senegal",
  ethiopia: "Ethiopie",
  sudan: "Soudan",
  "south sudan": "Soudan du Sud",
  somalia: "Somalie",
  kenya: "Kenya",
  tanzania: "Tanzanie",
  uganda: "Ouganda",
  rwanda: "Rwanda",
  burundi: "Burundi",
  syria: "Syrie",
  iraq: "Irak",
  iran: "Iran",
  israel: "Israel",
  jordan: "Jordanie",
  lebanon: "Liban",
  saudiarabia: "Arabie saoudite",
  "saudi arabia": "Arabie saoudite",
  "united arab emirates": "Emirats arabes unis",
  qatar: "Qatar",
  oman: "Oman",
  yemen: "Yemen",
  pakistan: "Pakistan",
  afghanistan: "Afghanistan",
  kazakhstan: "Kazakhstan",
  uzbekistan: "Ouzbekistan",
  turkmenistan: "Turkmenistan",
  kyrgyzstan: "Kirghizistan",
  mongolia: "Mongolie",
  australia: "Australie",
  "new zealand": "Nouvelle-Zelande",
  "south africa": "Afrique du Sud",
  "cote d'ivoire": "Cote d'Ivoire"
};

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

export function translateCountryDescriptor(descriptor: string, locale: UiLocale): string {
  const normalized = descriptor.trim().toLowerCase();
  return COUNTRY_DESCRIPTOR_TRANSLATIONS[locale][normalized] ?? descriptor;
}

export function translateCountryName(name: string, locale: UiLocale): string {
  if (locale !== "fr") return name;
  const normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return COUNTRY_NAME_TRANSLATIONS[normalized] ?? name;
}

export function formatGameDate(year: number, month: number, day: number, locale: UiLocale): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  const formatter = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
  return formatter.format(date);
}

export function translateNarrativeTitle(title: string, locale: UiLocale): string {
  if (locale !== "fr") return title;

  if (title === "Scenario Loaded") return "Scenario charge";
  if (title === "Round Resolved") return "Tour resolu";
  if (title === "Jump Forward") return "Saut en avant";
  if (title === "To Next Major Event") return "Vers le prochain evenement majeur";
  if (title === "Order Queued") return "Ordre en file";
  if (title === "Order Removed") return "Ordre retire";
  if (title === "The Present Order Starts to Fray") return "L'ordre du present se fissure";
  if (title === "Europe Braces for War") return "L'Europe se prepare a la guerre";
  if (title === "Imperial Ambitions Reawaken") return "Les ambitions imperiales se reveillent";
  if (title === "World Briefing") return "Briefing mondial";

  const eventSummaryMatch = title.match(/^Event Summary - (.+)$/i);
  if (eventSummaryMatch) {
    return `Resume des evenements - ${eventSummaryMatch[1]}`;
  }

  return title;
}

type NarrativeContext = {
  playerCountryName?: string;
  presetTitle?: string;
};

export function translateNarrativeBody(title: string, body: string, locale: UiLocale, context?: NarrativeContext): string {
  if (locale !== "fr") return body;

  const normalizedTitle = title.trim().toLowerCase();
  const playerCountryName = context?.playerCountryName?.trim() || "Votre nation";
  const presetTitle = context?.presetTitle?.trim() || "Le scénario";

  if (normalizedTitle === "scenario loaded") {
    return `${presetTitle} est charge. Vous prenez desormais le commandement de ${playerCountryName}.`;
  }

  if (normalizedTitle === "the present order starts to fray") {
    return `${playerCountryName} entre dans un bac a sable moderne vivant, faconne par la diplomatie, les sanctions, les campagnes de pression et les crises regionales soudaines.`;
  }

  if (normalizedTitle === "europe braces for war") {
    return `${playerCountryName} entre dans un monde de fronts qui se durcissent, d'alliances fragiles et de decisions qui escaladent vite. Les sauts courts donnent davantage de controle sur les premiers mois.`;
  }

  if (normalizedTitle === "imperial ambitions reawaken") {
    return `${playerCountryName} commence dans un monde de prestige imperial, de reformes, de pression coloniale et de competition industrielle au long cours.`;
  }

  if (normalizedTitle === "world briefing") {
    return `Le scenario ${presetTitle} est vivant. Priorite aux actions claires, a la diplomatie et aux sauts courts pour garder la main sur l'ouverture.`;
  }

  return body;
}

export function translateSpatialBriefingLabel(tier: SpatialKnowledgeTier, locale: UiLocale): string {
  if (locale === "fr") {
    if (tier === "lunar") return "Lecture lunaire";
    if (tier === "orbital") return "Lecture orbitale";
    if (tier === "global") return "Lecture globale";
    if (tier === "regional") return "Lecture regionale";
    return "Lecture limitee";
  }

  if (tier === "lunar") return "Lunar reading";
  if (tier === "orbital") return "Orbital reading";
  if (tier === "global") return "Global reading";
  if (tier === "regional") return "Regional reading";
  return "Limited reading";
}

export function translatePresetTitle(presetId: string, locale: UiLocale): string {
  if (locale !== "fr") {
    if (presetId === "world-war-ii") return "World War II";
    if (presetId === "victorian-era") return "Victorian Era";
    if (presetId === "modern-day" || presetId === "detailed-2025") return "Present Day";
    return "World Briefing";
  }

  if (presetId === "world-war-ii") return "Seconde Guerre mondiale";
  if (presetId === "victorian-era") return "Ere victorienne";
  if (presetId === "modern-day" || presetId === "detailed-2025") return "Temps present";
  return "Briefing mondial";
}
