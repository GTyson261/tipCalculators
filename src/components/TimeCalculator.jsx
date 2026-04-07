import { useMemo, useState } from "react";

const TIP_OPTIONS = [10, 15, 18, 20, 25];

function TipCalculator({ currentGame = "galaxy" }) {
  const [bill, setBill] = useState("");
  const [tipPercent, setTipPercent] = useState(18);
  const [people, setPeople] = useState("1");
  const [customTip, setCustomTip] = useState("");

  const parsedBill = Math.max(0, Number(bill) || 0);
  const parsedPeople = Math.max(1, Number(people) || 1);
  const activeTip = customTip !== "" ? Math.max(0, Number(customTip) || 0) : tipPercent;

  const { tipAmount, totalAmount, perPerson } = useMemo(() => {
    const tip = parsedBill * (activeTip / 100);
    const total = parsedBill + tip;
    const each = total / parsedPeople;

    return {
      tipAmount: tip,
      totalAmount: total,
      perPerson: each,
    };
  }, [parsedBill, activeTip, parsedPeople]);

  const cardClass = `${currentGame}-card`;

  return (
    <section className="tip-wrap">
      <div className={`tip-card ${cardClass}`}>
        <div className="tip-top-row">
          <div>
            <h1 className="tip-title">Arcade Tip Calculator</h1>
            <p className="tip-subtitle">
              Split the bill, calculate the tip, keep the vibes high.
            </p>
          </div>

          <div className="game-chip">
            Theme: <span>{currentGame}</span>
          </div>
        </div>

        <div className="tip-grid">
          <div className="tip-input-panel">
            <label className="tip-label">
              Bill Amount
              <input
                className="tip-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="Enter bill amount"
                value={bill}
                onChange={(e) => setBill(e.target.value)}
              />
            </label>

            <div className="tip-label">
              Select Tip %
              <div className="tip-buttons">
                {TIP_OPTIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`tip-percent-btn ${
                      customTip === "" && tipPercent === value ? "active" : ""
                    }`}
                    onClick={() => {
                      setCustomTip("");
                      setTipPercent(value);
                    }}
                  >
                    {value}%
                  </button>
                ))}

                <input
                  className="tip-custom-input"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Custom %"
                  value={customTip}
                  onChange={(e) => setCustomTip(e.target.value)}
                />
              </div>
            </div>

            <label className="tip-label">
              Number of People
              <input
                className="tip-input"
                type="number"
                min="1"
                step="1"
                placeholder="1"
                value={people}
                onChange={(e) => setPeople(e.target.value)}
              />
            </label>

            <button
              type="button"
              className="tip-reset-btn"
              onClick={() => {
                setBill("");
                setTipPercent(18);
                setPeople("1");
                setCustomTip("");
              }}
            >
              Reset
            </button>
          </div>

          <div className="tip-results-panel">
            <div className="tip-result-box">
              <span>Tip Amount</span>
              <strong>${tipAmount.toFixed(2)}</strong>
            </div>

            <div className="tip-result-box">
              <span>Total Amount</span>
              <strong>${totalAmount.toFixed(2)}</strong>
            </div>

            <div className="tip-result-box">
              <span>Per Person</span>
              <strong>${perPerson.toFixed(2)}</strong>
            </div>

            <div className="tip-mini-note">
              Bill: ${parsedBill.toFixed(2)} · Tip: {activeTip}% · People: {parsedPeople}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default TipCalculator;