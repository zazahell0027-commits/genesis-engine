import React, { useEffect, useMemo, useState } from "react";
import type { CountryDescriptor, GameSetupOptions, GameState, PresetSummary } from "@genesis/shared";
import { getCountries, getSetupOptions, startGame } from "../api";
import { useUiLocale } from "../i18n";

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const COUNTRY_BACKDROPS = [
  "/media/covers/modern_day_card.png",
  "/media/covers/detailed_2025_card.png",
  "/media/covers/shattered_americas_card.png",
  "/media/covers/cannon_card.png",
  "/media/covers/battle_royale_card.png",
  "/media/covers/islands_card.png"
];

function countryBackdrop(countryId: string): string {
  const index = countryId.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % COUNTRY_BACKDROPS.length;
  return COUNTRY_BACKDROPS[index] ?? COUNTRY_BACKDROPS[0];
}

export function LaunchPresetModal(props: {
  preset: PresetSummary | null;
  open: boolean;
  onClose: () => void;
  onError: (message: string | null) => void;
  onStarted: (game: GameState) => void;
}): React.JSX.Element | null {
  const { locale, t } = useUiLocale();
  const [setupStep, setSetupStep] = useState<1 | 2>(1);
  const [setupOptions, setSetupOptions] = useState<GameSetupOptions | null>(null);
  const [countries, setCountries] = useState<CountryDescriptor[]>([]);
  const [countrySearch, setCountrySearch] = useState("");
  const [countryId, setCountryId] = useState("");
  const [difficulty, setDifficulty] = useState("Standard");
  const [aiQuality, setAiQuality] = useState("Balanced");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!props.open || !props.preset) return;

    let cancelled = false;
    async function loadSetup(): Promise<void> {
      setLoading(true);
      props.onError(null);
      try {
        const [options, loadedCountries] = await Promise.all([
          getSetupOptions(props.preset!.id),
          getCountries(props.preset!.id)
        ]);

        if (cancelled) return;

        setSetupOptions(options);
        setCountries(loadedCountries);
        const fallbackCountryId = loadedCountries.some((country) => country.id === options.defaultCountryId)
          ? options.defaultCountryId
          : loadedCountries[0]?.id ?? "";
        setCountryId(fallbackCountryId);
        setDifficulty(options.defaultDifficulty);
        setAiQuality(options.defaultAIQuality);
        setCountrySearch("");
        setSetupStep(1);
      } catch (error) {
        props.onError(error instanceof Error ? error.message : "Unable to load preset setup");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSetup();
    return () => {
      cancelled = true;
    };
  }, [props.open, props.preset, props.onError]);

  useEffect(() => {
    if (!props.open) return;
    function handleEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") props.onClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [props.open, props.onClose]);

  const filteredCountries = useMemo(
    () => countries.filter((country) => normalize(country.name).includes(normalize(countrySearch))),
    [countries, countrySearch]
  );
  const recommended = useMemo(
    () => (setupOptions?.recommendedCountries ?? [])
      .map((id) => countries.find((country) => country.id === id) ?? null)
      .filter((country): country is CountryDescriptor => Boolean(country)),
    [setupOptions, countries]
  );
  const selectedCountry = useMemo(
    () => countries.find((country) => country.id === countryId) ?? null,
    [countries, countryId]
  );

  if (!props.open || !props.preset) return null;

  async function handleStartGame(): Promise<void> {
    if (!props.preset || !countryId) return;

    setSubmitting(true);
    props.onError(null);
    try {
      const game = await startGame({
        presetId: props.preset.id,
        countryId,
        difficulty,
        aiQuality,
        locale
      });
      props.onStarted(game);
    } catch (error) {
      props.onError(error instanceof Error ? error.message : "Unable to start game");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={props.onClose}>
      <div className="launch-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="launch-modal-cover" style={{ backgroundImage: `url(${props.preset.bannerImage ?? props.preset.coverImage})` }} />
        <div className="launch-modal-content">
          <div className="launch-modal-header">
            <div>
              <span className="eyebrow">{props.preset.official ? t("launch.officialPreset", "Official preset") : t("launch.communityPreset", "Community preset")}</span>
              <h2>{props.preset.title}</h2>
              <p>{props.preset.subtitle}</p>
            </div>
            <button
              type="button"
              className="close-button"
              onClick={props.onClose}
              aria-label={t("launch.close", "Close launch modal")}
              title="Close"
            >
              &times;
            </button>
          </div>

          {loading && <div className="empty-panel">{t("launch.loadingSetup", "Loading setup options...")}</div>}

          {!loading && (
            <div className="launch-grid">
              {setupStep === 1 ? (
                <>
                  <div className="launch-column">
                    <label className="field-block">
                      <span>{t("launch.searchCountry", "Search country")}</span>
                      <input
                        type="search"
                        value={countrySearch}
                        onChange={(event) => setCountrySearch(event.target.value)}
                        placeholder={t("launch.searchPlaceholder", "France, Germany, Japan...")}
                      />
                    </label>

                    {recommended.length > 0 && (
                      <>
                        <span className="mini-heading">{t("launch.recommendedCountries", "Recommended countries")}</span>
                        <div className="recommended-list">
                          {recommended.map((country) => (
                            <button
                              key={country.id}
                              type="button"
                              className={`tag-button${countryId === country.id ? " is-active" : ""}`}
                              onClick={() => setCountryId(country.id)}
                            >
                              {country.name}
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    <span className="mini-heading">{t("launch.availableCountries", "Available countries")}</span>
                    <div className="country-list">
                      {filteredCountries.slice(0, 40).map((country) => (
                        <button
                          key={country.id}
                          type="button"
                          className={`country-row${countryId === country.id ? " is-active" : ""}`}
                          onClick={() => setCountryId(country.id)}
                        >
                          <strong>{country.name}</strong>
                          <span>{country.continent}</span>
                        </button>
                      ))}
                      {filteredCountries.length === 0 && (
                        <div className="browser-empty">{t("launch.noCountry", "No country found for this search.")}</div>
                      )}
                    </div>
                  </div>

                  <div className="launch-column">
                    <div className="launch-country-preview" style={{ backgroundImage: `url(${countryBackdrop(countryId || selectedCountry?.id || props.preset.id)})` }}>
                      <div className="launch-country-preview-copy">
                        <span className="eyebrow">{t("launch.step", "Step 1/2")}</span>
                        <strong>{selectedCountry?.name ?? t("launch.selectCountry", "Select a country")}</strong>
                        <p>{selectedCountry ? `${selectedCountry.continent} ${t("launch.theatre", "theatre")}` : t("launch.chooseNation", "Choose your nation before configuring the game.")}</p>
                      </div>
                    </div>

                    <div className="launch-note">
                      <strong>{props.preset.startDate.label}</strong>
                      <p>{props.preset.description}</p>
                    </div>

                    <div className="launch-action-row">
                      <button type="button" className="secondary-button" onClick={props.onClose}>
                        {t("launch.cancel", "Cancel")}
                      </button>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => setSetupStep(2)}
                        disabled={!countryId}
                      >
                        {t("launch.continue", "Continue")}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="launch-column">
                    <div className="selected-country-card">
                      <strong>{selectedCountry?.name ?? t("launch.noCountrySelected", "No country selected")}</strong>
                      <span>{selectedCountry ? `${selectedCountry.continent} | ${props.preset.title}` : t("launch.goBackAndPick", "Go back and pick a country first.")}</span>
                    </div>

                    <div className="launch-note">
                      <strong>{t("launch.scenarioBrief", "Scenario brief")}</strong>
                      <p>{props.preset.description}</p>
                      <ul className="flat-list">
                        {(setupOptions?.featuredTips ?? []).map((tip) => (
                          <li key={tip}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="launch-column">
                    <div className="field-group">
                      <span className="mini-heading">{t("launch.difficulty", "Difficulty")}</span>
                      <div className="segmented-row">
                        {(setupOptions?.difficultyOptions ?? []).map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={`segment-button${difficulty === option ? " is-active" : ""}`}
                            onClick={() => setDifficulty(option)}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="field-group">
                      <span className="mini-heading">{t("launch.aiQuality", "A.I. Quality")}</span>
                      <div className="segmented-row">
                        {(setupOptions?.aiQualityOptions ?? []).map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={`segment-button${aiQuality === option ? " is-active" : ""}`}
                            onClick={() => setAiQuality(option)}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="launch-action-row">
                      <button type="button" className="secondary-button" onClick={() => setSetupStep(1)}>
                        {t("launch.back", "Back")}
                      </button>
                      <button type="button" className="primary-button" onClick={handleStartGame} disabled={submitting || !countryId}>
                        {submitting ? t("launch.starting", "Starting...") : t("launch.startGame", "Start Game")}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
