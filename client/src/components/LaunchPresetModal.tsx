import React, { useEffect, useMemo, useState } from "react";
import type { CountryDescriptor, GameSetupOptions, GameState, PresetSummary } from "@genesis/shared";
import { getCountries, getSetupOptions, startGame } from "../api";

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function LaunchPresetModal(props: {
  preset: PresetSummary | null;
  open: boolean;
  onClose: () => void;
  onError: (message: string | null) => void;
  onStarted: (game: GameState) => void;
}): React.JSX.Element | null {
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
        setCountryId(options.defaultCountryId);
        setDifficulty(options.defaultDifficulty);
        setAiQuality(options.defaultAIQuality);
        setCountrySearch("");
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
        aiQuality
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
              <span className="eyebrow">{props.preset.official ? "Official preset" : "Community preset"}</span>
              <h2>{props.preset.title}</h2>
              <p>{props.preset.subtitle}</p>
            </div>
            <button type="button" className="close-button" onClick={props.onClose}>x</button>
          </div>

          {loading && <div className="empty-panel">Loading setup options...</div>}

          {!loading && (
            <div className="launch-grid">
              <div className="launch-column">
                <label className="field-block">
                  <span>Search country</span>
                  <input
                    type="search"
                    value={countrySearch}
                    onChange={(event) => setCountrySearch(event.target.value)}
                    placeholder="France, Germany, Japan..."
                  />
                </label>

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

                <div className="country-list">
                  {filteredCountries.slice(0, 18).map((country) => (
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
                </div>
              </div>

              <div className="launch-column">
                <div className="field-group">
                  <span className="mini-heading">Difficulty</span>
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
                  <span className="mini-heading">A.I. Quality</span>
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

                <div className="launch-note">
                  <strong>{props.preset.startDate.label}</strong>
                  <p>{props.preset.description}</p>
                  <ul className="flat-list">
                    {(setupOptions?.featuredTips ?? []).map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </div>

                <button type="button" className="primary-button wide" onClick={handleStartGame} disabled={submitting || !countryId}>
                  {submitting ? "Starting..." : "Start Game"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
