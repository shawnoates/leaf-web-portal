"use client";

import { useState } from "react";
import { CTA } from "./ui";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

export default function Calculator() {
  const [units, setUnits] = useState(80);
  const [turn, setTurn] = useState(45);
  const [cost, setCost] = useState(4000);

  const moveouts = (units * turn) / 100;
  const annual = moveouts * cost;
  const savedFive = 5 * cost;

  return (
    <div className="calc">
      <div className="calc__row">
        <div className="calc__field">
          <label htmlFor="rm-units">
            Units in your building <b>{units}</b>
          </label>
          <input
            id="rm-units"
            type="range"
            min={10}
            max={500}
            step={5}
            value={units}
            onChange={(e) => setUnits(+e.target.value)}
          />
        </div>
        <div className="calc__field">
          <label htmlFor="rm-turn">
            Annual turnover <b>{turn}%</b>
          </label>
          <input
            id="rm-turn"
            type="range"
            min={20}
            max={70}
            step={1}
            value={turn}
            onChange={(e) => setTurn(+e.target.value)}
          />
        </div>
      </div>
      <div className="calc__row" style={{ marginTop: 18 }}>
        <div className="calc__field">
          <label htmlFor="rm-cost">Cost per move-out</label>
          <input
            id="rm-cost"
            type="number"
            min={500}
            step={100}
            value={cost}
            onChange={(e) => setCost(Math.max(0, +e.target.value || 0))}
          />
        </div>
        <div className="calc__field" style={{ alignSelf: "end" }}>
          <p className="calc__note" style={{ marginTop: 0 }}>
            ≈ {Math.round(moveouts)} move-outs a year at this rate.
          </p>
        </div>
      </div>

      <div className="calc__out">
        <div className="big stat-fig">{fmt(annual)}</div>
        <div className="lbl">is cycling through turnover at your building every year.</div>
      </div>
      <p className="calc__save">
        Keep just <b>5 more residents a year</b> and you save about <b>{fmt(savedFive)}</b>{" "}
        &mdash; many times what Concierge costs.
      </p>
      <div className="inline-cta">
        <CTA to="demo" variant="primary" arrow>
          See how Concierge pays for itself
        </CTA>
      </div>
      <p className="calc__note">
        Estimates only. Per-move-out cost based on industry benchmarks (~$3,000&ndash;$5,000;
        ~$4,000 average). Turnover rate default reflects the ~40&ndash;50% multifamily norm.
      </p>
    </div>
  );
}
