import React, { useState } from "react";

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
  };

  const statsOrder = ["power", "technique", "agility", "strike", "submission", "grapple"];

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold text-center mb-8">Finish Calculator</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Player Stats */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Your Competitor</h2>

          <div className="space-y-3">
            {statsOrder.map(stat => (
              <div key={stat} className="grid grid-cols-3 gap-4 items-center">
                <label className={`font-semibold ${statColors[stat]}`}>
                  {statLabels[stat]}
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={playerStats[stat]}
                  onChange={(e) => handlePlayerStatChange(stat, e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                />
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">Bonus:</span>
                  <input
                    type="number"
                    value={finishBonuses[stat]}
                    onChange={(e) => handleFinishBonusChange(stat, e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white w-20"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <label className="block font-semibold mb-2">Finish Re-rolls</label>
            <input
              type="number"
              min="0"
              max="5"
              value={numRerolls}
              onChange={(e) => setNumRerolls(Math.max(0, parseInt(e.target.value) || 0))}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white w-full"
            />
            <p className="text-sm text-gray-400 mt-1">
              Number of times you can re-roll the finish roll
            </p>
          </div>
        </div>

        {/* Opponent Stats */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Opponent</h2>

          <div className="space-y-3">
            {statsOrder.map(stat => (
              <div key={stat} className="grid grid-cols-3 gap-4 items-center">
                <label className={`font-semibold ${statColors[stat]}`}>
                  {statLabels[stat]}
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={opponentStats[stat]}
                  onChange={(e) => handleOpponentStatChange(stat, e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                />
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">Modifier:</span>
                  <input
                    type="number"
                    value={opponentModifiers[stat]}
                    onChange={(e) => handleOpponentModifierChange(stat, e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white w-20"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <label className="block font-semibold mb-2">Breakout Attempts</label>
            <input
              type="number"
              min="1"
              max="10"
              value={breakoutAttempts}
              onChange={(e) => handleBreakoutAttemptsChange(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white w-full"
            />
          </div>

          <div className="mt-4">
            <label className="block font-semibold mb-2">Breakout Penalties</label>
            <div className="space-y-2">
              {breakoutPenalties.map((penalty, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm w-24">
                    Attempt {idx + 1}:
                  </span>
                  <input
                    type="number"
                    value={penalty}
                    onChange={(e) => handleBreakoutPenaltyChange(idx, e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white w-20"
                  />
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-400 mt-2">
              Penalty to opponent stats for each breakout attempt
            </p>
          </div>
        </div>
      </div>

      {/* Calculate Button */}
      <div className="mt-8 text-center">
        <button
          onClick={calculateResults}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors"
        >
          Calculate
        </button>
      </div>

      {/* Results */}
      {results && (
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-center">Results</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-center">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="py-3 px-4">Crowd Meter</th>
                  {results.map(r => (
                    <th key={r.cm} className="py-3 px-4">CM {r.cm}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-700">
                  <td className="py-3 px-4 font-semibold">Success Rate</td>
                  {results.map(r => (
                    <td
                      key={r.cm}
                      className={`py-3 px-4 font-bold ${
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
                  <td className="py-3 px-4 font-semibold text-gray-400">Breakout %</td>
                  {results.map(r => (
                    <td key={r.cm} className="py-3 px-4 text-gray-400">
                      {(r.breakout * 100).toFixed(1)}%
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 text-sm text-gray-400">
            <p><strong>Note:</strong> Success rate shows probability of successfully completing the finish.</p>
            <p className="mt-2">
              <span className="text-green-400">Green</span>: Strong probability |
              <span className="text-yellow-300 ml-2">Yellow</span>: Moderate |
              <span className="text-red-300 ml-2">Red</span>: Low
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
