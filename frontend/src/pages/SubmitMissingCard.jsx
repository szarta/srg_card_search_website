import { useState } from "react";
import { Link } from "react-router-dom";

export default function SubmitMissingCard() {
  const [cardName, setCardName] = useState("");
  const [cardType, setCardType] = useState("");
  const [rulesText, setRulesText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!cardName.trim()) {
      setError("Card name is required");
      return;
    }

    if (!cardType) {
      setError("Card type is required");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess(false);

    try {
      const response = await fetch("/api/submissions/missing-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_name: cardName,
          card_type: cardType,
          rules_text: rulesText || null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setCardName("");
        setCardType("");
        setRulesText("");
      } else {
        setError(data.detail || "Submission failed");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Link to="/" className="text-purple-400 hover:text-purple-300 mb-4 inline-block">
        ← Back to Home
      </Link>

      <h1 className="text-3xl font-bold mb-6">Submit Missing Card</h1>

      <p className="text-gray-300 mb-6">
        Help us improve the database by submitting cards that are missing from our collection.
      </p>

      {success && (
        <div className="bg-green-900/50 border border-green-500 rounded p-4 mb-6">
          <p className="text-green-200">
            Thank you! Your submission has been received and will be reviewed.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded p-4 mb-6">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-neutral-900 p-6 rounded-lg shadow-lg">
        <div className="mb-4">
          <label htmlFor="cardName" className="block text-sm font-medium mb-2">
            Card Name <span className="text-red-400">*</span>
          </label>
          <input
            id="cardName"
            type="text"
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            className="w-full bg-gray-800 text-white border border-gray-700 rounded p-3"
            placeholder="Enter card name"
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor="cardType" className="block text-sm font-medium mb-2">
            Card Type <span className="text-red-400">*</span>
          </label>
          <select
            id="cardType"
            value={cardType}
            onChange={(e) => setCardType(e.target.value)}
            className="w-full bg-gray-800 text-white border border-gray-700 rounded p-3"
            required
          >
            <option value="">Select card type...</option>
            <option value="MainDeckCard">Main Deck</option>
            <option value="SingleCompetitorCard">Single Competitor</option>
            <option value="TornadoCompetitorCard">Tornado Competitor</option>
            <option value="TrioCompetitorCard">Trio Competitor</option>
            <option value="EntranceCard">Entrance</option>
            <option value="SpectacleCard">Spectacle</option>
            <option value="CrowdMeterCard">Crowd Meter</option>
          </select>
        </div>

        <div className="mb-6">
          <label htmlFor="rulesText" className="block text-sm font-medium mb-2">
            Rules Text / Description <span className="text-gray-500">(optional)</span>
          </label>
          <textarea
            id="rulesText"
            value={rulesText}
            onChange={(e) => setRulesText(e.target.value)}
            className="w-full bg-gray-800 text-white border border-gray-700 rounded p-3 h-32"
            placeholder="Enter card rules or description if known"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-purple-700 text-white px-6 py-3 rounded-lg hover:bg-purple-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting..." : "Submit Missing Card"}
        </button>
      </form>
    </div>
  );
}
