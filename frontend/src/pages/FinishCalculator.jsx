import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

const STATS = ["power", "technique", "agility", "strike", "submission", "grapple"];

const DEFAULT_PLAYER_STATS = {
  power: 10,
  technique: 9,
  agility: 8,
  strike: 7,
  submission: 6,
  grapple: 5,
};

const DEFAULT_OPPONENT_STATS = {
  power: 10,
  technique: 9,
  agility: 8,
  strike: 7,
  submission: 6,
  grapple: 5,
};

const ZERO_STATS = {
  power: 0,
  technique: 0,
  agility: 0,
  strike: 0,
  submission: 0,
  grapple: 0,
};

const STAT_COLORS = {
  power: "text-red-400",
  technique: "text-orange-400",
  agility: "text-green-400",
  strike: "text-yellow-400",
  submission: "text-purple-400",
  grapple: "text-blue-400",
};

const STAT_LABELS = {
  power: "Power",
  technique: "Technique",
  agility: "Agility",
  strike: "Strike",
  submission: "Submission",
  grapple: "Grapple",
};

/* ----- Calculation logic ported from Python ----- */

// Count opponent stats that can break out of a finish at the given value/penalty.
// Special rule at CM0: a stat of 10 ALWAYS breaks out.
function countBreakoutStats(opponentStats, finishValue, penalty, crowdMeter) {
  return STATS.filter((stat) => {
    const val = opponentStats[stat];
    if (crowdMeter === 0 && val === 10) return true;
    return val - penalty >= finishValue;
  }).length;
}

// Probability the opponent breaks out of a single finish die face.
function breakoutProbForFinish(
  finishValue,
  opponentStats,
  breakoutAttempts,
  crowdMeter,
  opponentPenalties
) {
  // Automatic success — opponent cannot break out
  if (finishValue >= 11 && crowdMeter > 0) return 0.0;

  if (opponentPenalties) {
    // P(all attempts fail) = product of individual failure probabilities
    let probAllFail = 1.0;
    for (let attemptIdx = 0; attemptIdx < breakoutAttempts; attemptIdx++) {
      const penalty =
        attemptIdx < opponentPenalties.length ? opponentPenalties[attemptIdx] : 0;
      const canBreakout = countBreakoutStats(opponentStats, finishValue, penalty, crowdMeter);
      probAllFail *= 1 - canBreakout / 6;
    }
    return 1 - probAllFail;
  }

  // Standard logic: all attempts use the same probability
  const canBreakout = countBreakoutStats(opponentStats, finishValue, 0, crowdMeter);
  return 1 - Math.pow(1 - canBreakout / 6, breakoutAttempts);
}

// Average breakout probability across all 6 die faces (reroll keeps the better roll).
function averageBreakout(breakoutProbs, allowReroll) {
  if (!allowReroll) {
    return breakoutProbs.reduce((a, b) => a + b, 0) / 6;
  }
  let totalProb = 0;
  for (let prob1 of breakoutProbs) {
    for (let prob2 of breakoutProbs) {
      // Player chooses the better roll (lower breakout probability)
      totalProb += Math.min(prob1, prob2);
    }
  }
  return totalProb / 36;
}

function calculateBreakoutProbability(
  playerStats,
  opponentStats,
  finishBonuses,
  allowReroll = false,
  breakoutAttempts = 3,
  crowdMeter = 0,
  opponentPenalties = null
) {
  const finishValues = STATS.map(
    (stat) => playerStats[stat] + (finishBonuses[stat] || 0) + crowdMeter
  );

  const breakoutProbs = finishValues.map((finishValue) =>
    breakoutProbForFinish(
      finishValue,
      opponentStats,
      breakoutAttempts,
      crowdMeter,
      opponentPenalties
    )
  );

  return averageBreakout(breakoutProbs, allowReroll);
}

// Success-rate breakdown across crowd-meter levels 0–5.
function computeCmResults(
  playerStats,
  opponentStats,
  opponentModifiers,
  finishBonuses,
  allowReroll,
  breakoutAttempts,
  breakoutPenalties
) {
  // Apply opponent modifiers to opponent stats
  const effectiveOpponentStats = {};
  Object.keys(opponentStats).forEach((stat) => {
    effectiveOpponentStats[stat] = opponentStats[stat] + (opponentModifiers[stat] || 0);
  });

  const cmResults = [];
  for (let cm = 0; cm <= 5; cm++) {
    const breakoutProb = calculateBreakoutProbability(
      playerStats,
      effectiveOpponentStats,
      finishBonuses,
      allowReroll,
      breakoutAttempts,
      cm,
      breakoutPenalties
    );
    cmResults.push({ cm, breakout: breakoutProb, success: 1 - breakoutProb });
  }
  return cmResults;
}

/* ----- URL state (de)serialization ----- */

function readStatGroup(searchParams, prefix, defaults) {
  const out = {};
  STATS.forEach((stat) => {
    const val = searchParams.get(`${prefix}${stat}`);
    out[stat] = val ? parseInt(val) : defaults[stat];
  });
  return out;
}

function loadStateFromParams(searchParams) {
  const rerolls = searchParams.get("rerolls");
  const attempts = searchParams.get("attempts");

  let breakoutAttempts = null;
  let breakoutPenalties = null;
  if (attempts) {
    breakoutAttempts = parseInt(attempts);
    breakoutPenalties = [];
    for (let i = 0; i < breakoutAttempts; i++) {
      const val = searchParams.get(`pen_${i}`);
      breakoutPenalties.push(val ? parseInt(val) : 0);
    }
  }

  return {
    name: searchParams.get("name") || "",
    playerStats: readStatGroup(searchParams, "p_", DEFAULT_PLAYER_STATS),
    finishBonuses: readStatGroup(searchParams, "b_", ZERO_STATS),
    opponentStats: readStatGroup(searchParams, "o_", DEFAULT_OPPONENT_STATS),
    opponentModifiers: readStatGroup(searchParams, "om_", ZERO_STATS),
    numRerolls: rerolls ? parseInt(rerolls) : null,
    breakoutAttempts,
    breakoutPenalties,
  };
}

function buildParams(state) {
  const params = new URLSearchParams();
  if (state.resultName) params.set("name", state.resultName);

  // Player stats (always) + finish bonuses (only if non-zero)
  STATS.forEach((stat) => params.set(`p_${stat}`, state.playerStats[stat]));
  STATS.forEach((stat) => {
    if (state.finishBonuses[stat] !== 0) params.set(`b_${stat}`, state.finishBonuses[stat]);
  });

  // Opponent stats (always) + modifiers (only if non-zero)
  STATS.forEach((stat) => params.set(`o_${stat}`, state.opponentStats[stat]));
  STATS.forEach((stat) => {
    if (state.opponentModifiers[stat] !== 0) {
      params.set(`om_${stat}`, state.opponentModifiers[stat]);
    }
  });

  if (state.numRerolls > 0) params.set("rerolls", state.numRerolls);
  params.set("attempts", state.breakoutAttempts);

  // Breakout penalties (only if non-zero)
  state.breakoutPenalties.forEach((pen, idx) => {
    if (pen !== 0) params.set(`pen_${idx}`, pen);
  });

  return params;
}

function successColor(success) {
  if (success >= 0.99) return "text-green-400";
  if (success >= 0.75) return "text-green-300";
  if (success >= 0.5) return "text-yellow-300";
  if (success >= 0.25) return "text-orange-300";
  return "text-red-300";
}

/* ----- Presentational components ----- */

// A competitor's six stat rows, each with a value and a secondary (bonus/modifier) input.
function StatInputGroup({ values, secondary, secondaryLabel, onValueChange, onSecondaryChange }) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {STATS.map((stat) => (
        <div key={stat}>
          <label className={`font-semibold text-sm sm:text-base block mb-1 ${STAT_COLORS[stat]}`}>
            {STAT_LABELS[stat]}
          </label>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div>
              <span className="text-gray-400 text-xs block mb-1">Value</span>
              <input
                type="number"
                min="1"
                max="30"
                value={values[stat]}
                onChange={(e) => onValueChange(stat, e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white w-full text-sm sm:text-base"
              />
            </div>
            <div>
              <span className="text-gray-400 text-xs block mb-1">{secondaryLabel}</span>
              <input
                type="number"
                value={secondary[stat]}
                onChange={(e) => onSecondaryChange(stat, e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white w-full text-sm sm:text-base"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ResultsTable({ results, resultName }) {
  return (
    <div className="mt-6 sm:mt-8 bg-gray-800 rounded-lg p-3 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-bold mb-2 text-center">
        {resultName ? resultName : "Results"}
      </h2>
      {resultName && <p className="text-center text-gray-400 mb-3 sm:mb-4 text-sm">Results</p>}

      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <table className="w-full text-center min-w-[600px]">
          <thead>
            <tr className="border-b border-gray-600">
              <th className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm">Crowd Meter</th>
              {results.map((r) => (
                <th key={r.cm} className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm">
                  CM {r.cm}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-700">
              <td className="py-2 sm:py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm">Success Rate</td>
              {results.map((r) => (
                <td
                  key={r.cm}
                  className={`py-2 sm:py-3 px-2 sm:px-4 font-bold text-xs sm:text-sm ${successColor(r.success)}`}
                >
                  {(r.success * 100).toFixed(1)}%
                  {r.success >= 0.99 && " ✓"}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-400 text-xs sm:text-sm">Breakout %</td>
              {results.map((r) => (
                <td key={r.cm} className="py-2 sm:py-3 px-2 sm:px-4 text-gray-400 text-xs sm:text-sm">
                  {(r.breakout * 100).toFixed(1)}%
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 sm:mt-6 text-xs sm:text-sm text-gray-400">
        <p><strong>Note:</strong> Success rate shows probability of successfully completing the finish.</p>
        <p className="mt-2">
          <span className="text-green-400">Green</span>: Strong |
          <span className="text-yellow-300 ml-1 sm:ml-2">Yellow</span>: Moderate |
          <span className="text-red-300 ml-1 sm:ml-2">Red</span>: Low
        </p>
        <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-gray-700 rounded border border-gray-600">
          <p className="text-xs sm:text-sm text-gray-300">
            <strong>💡 Share:</strong> The URL has been updated with all your inputs.
            Copy and share the link!
          </p>
        </div>
      </div>
    </div>
  );
}

export default function FinishCalculator() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [resultName, setResultName] = useState("");
  const [playerStats, setPlayerStats] = useState(DEFAULT_PLAYER_STATS);
  const [finishBonuses, setFinishBonuses] = useState(ZERO_STATS);
  const [numRerolls, setNumRerolls] = useState(0);
  const [opponentStats, setOpponentStats] = useState(DEFAULT_OPPONENT_STATS);
  const [opponentModifiers, setOpponentModifiers] = useState(ZERO_STATS);
  const [breakoutAttempts, setBreakoutAttempts] = useState(3);
  const [breakoutPenalties, setBreakoutPenalties] = useState([0, 0, 0]);
  const [results, setResults] = useState(null);

  // Load state from URL on mount
  useEffect(() => {
    const s = loadStateFromParams(searchParams);
    setResultName(s.name);
    setPlayerStats(s.playerStats);
    setFinishBonuses(s.finishBonuses);
    setOpponentStats(s.opponentStats);
    setOpponentModifiers(s.opponentModifiers);
    if (s.numRerolls !== null) setNumRerolls(s.numRerolls);
    if (s.breakoutAttempts !== null) {
      setBreakoutAttempts(s.breakoutAttempts);
      setBreakoutPenalties(s.breakoutPenalties);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateURL = () => {
    setSearchParams(
      buildParams({
        resultName,
        playerStats,
        finishBonuses,
        opponentStats,
        opponentModifiers,
        numRerolls,
        breakoutAttempts,
        breakoutPenalties,
      }),
      { replace: true }
    );
  };

  const handlePlayerStatChange = (stat, value) => {
    const num = parseInt(value) || 0;
    setPlayerStats({ ...playerStats, [stat]: Math.max(1, Math.min(30, num)) });
  };

  const handleFinishBonusChange = (stat, value) => {
    const num = parseInt(value) || 0;
    setFinishBonuses({ ...finishBonuses, [stat]: num });
  };

  const handleOpponentStatChange = (stat, value) => {
    const num = parseInt(value) || 0;
    setOpponentStats({ ...opponentStats, [stat]: Math.max(1, Math.min(30, num)) });
  };

  const handleOpponentModifierChange = (stat, value) => {
    const num = parseInt(value) || 0;
    setOpponentModifiers({ ...opponentModifiers, [stat]: num });
  };

  const handleBreakoutAttemptsChange = (value) => {
    const num = Math.max(1, Math.min(10, parseInt(value) || 3));
    setBreakoutAttempts(num);
    setBreakoutPenalties(Array(num).fill(0));
  };

  const handleBreakoutPenaltyChange = (index, value) => {
    const num = parseInt(value) || 0;
    const newPenalties = [...breakoutPenalties];
    newPenalties[index] = num;
    setBreakoutPenalties(newPenalties);
  };

  const calculateResults = () => {
    setResults(
      computeCmResults(
        playerStats,
        opponentStats,
        opponentModifiers,
        finishBonuses,
        numRerolls > 0,
        breakoutAttempts,
        breakoutPenalties
      )
    );
    updateURL();
  };

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4">
      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-4 sm:mb-8">Finish Calculator</h1>

      {/* Result Name */}
      <div className="mb-4 sm:mb-6">
        <label className="block font-semibold mb-2 text-sm sm:text-base">Result Name (optional)</label>
        <input
          type="text"
          value={resultName}
          onChange={(e) => setResultName(e.target.value)}
          placeholder="e.g., Mr. Soleil - Sicilian Sun"
          className="bg-gray-800 border border-gray-600 rounded px-3 sm:px-4 py-2 sm:py-3 text-white w-full text-sm sm:text-base"
        />
        <p className="text-xs sm:text-sm text-gray-400 mt-1">
          Give this calculation a name to identify it when sharing
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
        {/* Player Stats */}
        <div className="bg-gray-800 rounded-lg p-3 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Your Competitor</h2>

          <StatInputGroup
            values={playerStats}
            secondary={finishBonuses}
            secondaryLabel="Bonus"
            onValueChange={handlePlayerStatChange}
            onSecondaryChange={handleFinishBonusChange}
          />

          <div className="mt-4 sm:mt-6">
            <label className="block font-semibold mb-2 text-sm sm:text-base">Finish Re-rolls</label>
            <input
              type="number"
              min="0"
              max="5"
              value={numRerolls}
              onChange={(e) => setNumRerolls(Math.max(0, parseInt(e.target.value) || 0))}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white w-full text-sm sm:text-base"
            />
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              Number of times you can re-roll the finish roll
            </p>
          </div>
        </div>

        {/* Opponent Stats */}
        <div className="bg-gray-800 rounded-lg p-3 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Opponent</h2>

          <StatInputGroup
            values={opponentStats}
            secondary={opponentModifiers}
            secondaryLabel="Modifier"
            onValueChange={handleOpponentStatChange}
            onSecondaryChange={handleOpponentModifierChange}
          />

          <div className="mt-4 sm:mt-6">
            <label className="block font-semibold mb-2 text-sm sm:text-base">Breakout Attempts</label>
            <input
              type="number"
              min="1"
              max="10"
              value={breakoutAttempts}
              onChange={(e) => handleBreakoutAttemptsChange(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white w-full text-sm sm:text-base"
            />
          </div>

          <div className="mt-3 sm:mt-4">
            <label className="block font-semibold mb-2 text-sm sm:text-base">Breakout Penalties</label>
            <div className="space-y-2">
              {breakoutPenalties.map((penalty, idx) => (
                <div key={idx} className="grid grid-cols-2 gap-2 items-center">
                  <span className="text-gray-400 text-xs sm:text-sm">
                    Attempt {idx + 1}:
                  </span>
                  <input
                    type="number"
                    value={penalty}
                    onChange={(e) => handleBreakoutPenaltyChange(idx, e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white w-full text-sm sm:text-base"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs sm:text-sm text-gray-400 mt-2">
              Penalty to opponent stats for each breakout attempt
            </p>
          </div>
        </div>
      </div>

      {/* Calculate Button */}
      <div className="mt-6 sm:mt-8 text-center">
        <button
          onClick={calculateResults}
          className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold py-3 px-6 sm:px-8 rounded-lg text-base sm:text-lg transition-colors w-full sm:w-auto"
        >
          Calculate
        </button>
      </div>

      {/* Results */}
      {results && <ResultsTable results={results} resultName={resultName} />}
    </div>
  );
}
