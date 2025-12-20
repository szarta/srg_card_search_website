import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

// Calculation logic ported from Python
function calculateBreakoutProbability(
  playerStats,
  opponentStats,
  finishBonuses,
  allowReroll = false,
  breakoutAttempts = 3,
  crowdMeter = 0,
  opponentPenalties = null
) {
  const statsOrder = ["power", "technique", "agility", "strike", "submission", "grapple"];

  // Calculate finish values for each possible die face
  const finishValues = statsOrder.map(stat => {
    const baseValue = playerStats[stat];
    const bonus = finishBonuses[stat] || 0;
    return baseValue + bonus + crowdMeter;
  });

  // Calculate breakout probability for each possible finish roll
  const breakoutProbs = finishValues.map(finishValue => {
    if (finishValue >= 11 && crowdMeter > 0) {
      // Automatic success - opponent cannot break out
      return 0.0;
    }

    if (opponentPenalties) {
      // Calculate P(all attempts fail) by multiplying individual failure probabilities
      let probAllFail = 1.0;
      for (let attemptIdx = 0; attemptIdx < breakoutAttempts; attemptIdx++) {
        const penalty = attemptIdx < opponentPenalties.length ? opponentPenalties[attemptIdx] : 0;

        // Count how many opponent stats can break out for this attempt
        let canBreakout;
        if (crowdMeter === 0) {
          // Special rule at CM0: a stat of 10 ALWAYS breaks out
          canBreakout = statsOrder.filter(stat => {
            const val = opponentStats[stat];
            return (val - penalty) >= finishValue || val === 10;
          }).length;
        } else {
          canBreakout = statsOrder.filter(stat => {
            const val = opponentStats[stat];
            return (val - penalty) >= finishValue;
          }).length;
        }

        const probBreakoutSingle = canBreakout / 6;
        probAllFail *= (1 - probBreakoutSingle);
      }
      return 1 - probAllFail;
    } else {
      // Standard logic: all attempts use same probability
      let canBreakout;
      if (crowdMeter === 0) {
        // Special rule at CM0: a stat of 10 ALWAYS breaks out
        canBreakout = statsOrder.filter(stat => {
          const val = opponentStats[stat];
          return val >= finishValue || val === 10;
        }).length;
      } else {
        canBreakout = statsOrder.filter(stat => {
          const val = opponentStats[stat];
          return val >= finishValue;
        }).length;
      }

      const probBreakoutSingle = canBreakout / 6;
      const probAllFail = Math.pow(1 - probBreakoutSingle, breakoutAttempts);
      return 1 - probAllFail;
    }
  });

  // If reroll allowed, player gets two rolls and keeps the better one
  if (allowReroll) {
    let totalProb = 0;
    for (let prob1 of breakoutProbs) {
      for (let prob2 of breakoutProbs) {
        // Player chooses the better roll (lower breakout probability)
        totalProb += Math.min(prob1, prob2);
      }
    }
    return totalProb / 36;
  } else {
    // Average across all possible die faces
    return breakoutProbs.reduce((a, b) => a + b, 0) / 6;
  }
}

export default function FinishCalculator() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [resultName, setResultName] = useState("");
  const [playerStats, setPlayerStats] = useState({
    power: 10,
    technique: 9,
    agility: 8,
    strike: 7,
    submission: 6,
    grapple: 5
  });

  const [finishBonuses, setFinishBonuses] = useState({
    power: 0,
    technique: 0,
    agility: 0,
    strike: 0,
    submission: 0,
    grapple: 0
  });

  const [numRerolls, setNumRerolls] = useState(0);

  const [opponentStats, setOpponentStats] = useState({
    power: 10,
    technique: 9,
    agility: 8,
    strike: 7,
    submission: 6,
    grapple: 5
  });

  const [opponentModifiers, setOpponentModifiers] = useState({
    power: 0,
    technique: 0,
    agility: 0,
    strike: 0,
    submission: 0,
    grapple: 0
  });

  const [breakoutAttempts, setBreakoutAttempts] = useState(3);
  const [breakoutPenalties, setBreakoutPenalties] = useState([0, 0, 0]);

  const [results, setResults] = useState(null);

  // Load state from URL on mount
  useEffect(() => {
    const name = searchParams.get("name") || "";
    setResultName(name);

    const stats = ["power", "technique", "agility", "strike", "submission", "grapple"];

    // Load player stats
    const newPlayerStats = {};
    stats.forEach(stat => {
      const val = searchParams.get(`p_${stat}`);
      newPlayerStats[stat] = val ? parseInt(val) : playerStats[stat];
    });
    setPlayerStats(newPlayerStats);

    // Load finish bonuses
    const newBonuses = {};
    stats.forEach(stat => {
      const val = searchParams.get(`b_${stat}`);
      newBonuses[stat] = val ? parseInt(val) : 0;
    });
    setFinishBonuses(newBonuses);

    // Load opponent stats
    const newOppStats = {};
    stats.forEach(stat => {
      const val = searchParams.get(`o_${stat}`);
      newOppStats[stat] = val ? parseInt(val) : opponentStats[stat];
    });
    setOpponentStats(newOppStats);

    // Load opponent modifiers
    const newOppMods = {};
    stats.forEach(stat => {
      const val = searchParams.get(`om_${stat}`);
      newOppMods[stat] = val ? parseInt(val) : 0;
    });
    setOpponentModifiers(newOppMods);

    // Load rerolls
    const rerolls = searchParams.get("rerolls");
    if (rerolls) setNumRerolls(parseInt(rerolls));

    // Load breakout attempts
    const attempts = searchParams.get("attempts");
    if (attempts) {
      const numAttempts = parseInt(attempts);
      setBreakoutAttempts(numAttempts);

      // Load penalties
      const penalties = [];
      for (let i = 0; i < numAttempts; i++) {
        const val = searchParams.get(`pen_${i}`);
        penalties.push(val ? parseInt(val) : 0);
      }
      setBreakoutPenalties(penalties);
    }
  }, []);

  // Update URL when state changes
  const updateURL = () => {
    const params = new URLSearchParams();

    if (resultName) params.set("name", resultName);

    const stats = ["power", "technique", "agility", "strike", "submission", "grapple"];

    // Player stats
    stats.forEach(stat => {
      params.set(`p_${stat}`, playerStats[stat]);
    });

    // Finish bonuses (only if non-zero)
    stats.forEach(stat => {
      if (finishBonuses[stat] !== 0) {
        params.set(`b_${stat}`, finishBonuses[stat]);
      }
    });

    // Opponent stats
    stats.forEach(stat => {
      params.set(`o_${stat}`, opponentStats[stat]);
    });

    // Opponent modifiers (only if non-zero)
    stats.forEach(stat => {
      if (opponentModifiers[stat] !== 0) {
        params.set(`om_${stat}`, opponentModifiers[stat]);
      }
    });

    // Rerolls (only if non-zero)
    if (numRerolls > 0) {
      params.set("rerolls", numRerolls);
    }

    // Breakout attempts
    params.set("attempts", breakoutAttempts);

    // Breakout penalties (only if non-zero)
    breakoutPenalties.forEach((pen, idx) => {
      if (pen !== 0) {
        params.set(`pen_${idx}`, pen);
      }
    });

    setSearchParams(params, { replace: true });
  };

  const statColors = {
    power: "text-red-400",
    technique: "text-orange-400",
    agility: "text-green-400",
    strike: "text-yellow-400",
    submission: "text-purple-400",
    grapple: "text-blue-400"
  };

  const statLabels = {
    power: "Power",
    technique: "Technique",
    agility: "Agility",
    strike: "Strike",
    submission: "Submission",
    grapple: "Grapple"
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
    const allowReroll = numRerolls > 0;

    // Apply opponent modifiers to opponent stats
    const effectiveOpponentStats = {};
    Object.keys(opponentStats).forEach(stat => {
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
      const successProb = 1 - breakoutProb;
      cmResults.push({
        cm,
        breakout: breakoutProb,
        success: successProb
      });
    }
    setResults(cmResults);
    updateURL();
  };

  const statsOrder = ["power", "technique", "agility", "strike", "submission", "grapple"];

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

          <div className="space-y-3 sm:space-y-4">
            {statsOrder.map(stat => (
              <div key={stat}>
                <label className={`font-semibold text-sm sm:text-base block mb-1 ${statColors[stat]}`}>
                  {statLabels[stat]}
                </label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div>
                    <span className="text-gray-400 text-xs block mb-1">Value</span>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={playerStats[stat]}
                      onChange={(e) => handlePlayerStatChange(stat, e.target.value)}
                      className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white w-full text-sm sm:text-base"
                    />
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs block mb-1">Bonus</span>
                    <input
                      type="number"
                      value={finishBonuses[stat]}
                      onChange={(e) => handleFinishBonusChange(stat, e.target.value)}
                      className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white w-full text-sm sm:text-base"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

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

          <div className="space-y-3 sm:space-y-4">
            {statsOrder.map(stat => (
              <div key={stat}>
                <label className={`font-semibold text-sm sm:text-base block mb-1 ${statColors[stat]}`}>
                  {statLabels[stat]}
                </label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div>
                    <span className="text-gray-400 text-xs block mb-1">Value</span>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={opponentStats[stat]}
                      onChange={(e) => handleOpponentStatChange(stat, e.target.value)}
                      className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white w-full text-sm sm:text-base"
                    />
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs block mb-1">Modifier</span>
                    <input
                      type="number"
                      value={opponentModifiers[stat]}
                      onChange={(e) => handleOpponentModifierChange(stat, e.target.value)}
                      className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white w-full text-sm sm:text-base"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

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
      {results && (
        <div className="mt-6 sm:mt-8 bg-gray-800 rounded-lg p-3 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-2 text-center">
            {resultName ? resultName : "Results"}
          </h2>
          {resultName && (
            <p className="text-center text-gray-400 mb-3 sm:mb-4 text-sm">Results</p>
          )}

          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <table className="w-full text-center min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm">Crowd Meter</th>
                  {results.map(r => (
                    <th key={r.cm} className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm">CM {r.cm}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-700">
                  <td className="py-2 sm:py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm">Success Rate</td>
                  {results.map(r => (
                    <td
                      key={r.cm}
                      className={`py-2 sm:py-3 px-2 sm:px-4 font-bold text-xs sm:text-sm ${
                        r.success >= 0.99 ? 'text-green-400' :
                        r.success >= 0.75 ? 'text-green-300' :
                        r.success >= 0.50 ? 'text-yellow-300' :
                        r.success >= 0.25 ? 'text-orange-300' :
                        'text-red-300'
                      }`}
                    >
                      {(r.success * 100).toFixed(1)}%
                      {r.success >= 0.99 && ' ✓'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-400 text-xs sm:text-sm">Breakout %</td>
                  {results.map(r => (
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
      )}
    </div>
  );
}
