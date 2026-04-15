import React from "react";

export function OverlayHeading(props: {
  title: string;
  subtitle: string;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <div className="overlay-heading">
      <div className="overlay-heading-copy">
        <h2>{props.title}</h2>
        <p>{props.subtitle}</p>
      </div>
      <button
        type="button"
        className="close-button"
        onClick={props.onClose}
        aria-label="Fermer le panneau"
        title="Fermer"
      >
        &times;
      </button>
    </div>
  );
}
