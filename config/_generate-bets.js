/**
 * One-shot generator for bets-european.json and bets-american.json.
 * Run: node config/_generate-bets.js
 */
const fs = require("fs");
const path = require("path");

const cell = (r, c) => (r - 1) * 3 + c; // r 1..12, c 1..3

function buildEuropean() {
  const bets = [];
  const add = (b) => bets.push(b);

  for (let n = 0; n <= 36; n++) {
    add({
      id: "straight_" + n,
      type: "straight",
      labelKey: "bet.straight",
      pockets: [String(n)],
      multiplier: 35,
      family: n === 0 ? "zeroFamily" : "insideStraight",
      placement: n === 0 ? "zero" : "number",
    });
  }

  for (let r = 1; r <= 12; r++) {
    for (let c = 1; c <= 2; c++) {
      const a = cell(r, c);
      const b = cell(r, c + 1);
      add({
        id: "split_" + a + "_" + b,
        type: "split",
        labelKey: "bet.split",
        pockets: [String(a), String(b)],
        multiplier: 17,
        family: "insideMedium",
        placement: "edge",
      });
    }
  }
  for (let r = 1; r <= 11; r++) {
    for (let c = 1; c <= 3; c++) {
      const a = cell(r, c);
      const b = cell(r + 1, c);
      add({
        id: "split_" + a + "_" + b,
        type: "split",
        labelKey: "bet.split",
        pockets: [String(a), String(b)],
        multiplier: 17,
        family: "insideMedium",
        placement: "edge",
      });
    }
  }
  for (const n of [1, 2, 3]) {
    add({
      id: "split_0_" + n,
      type: "split",
      labelKey: "bet.split",
      pockets: ["0", String(n)],
      multiplier: 17,
      family: "zeroFamily",
      placement: "zero_edge",
    });
  }

  for (let r = 1; r <= 12; r++) {
    const a = cell(r, 1);
    const b = cell(r, 2);
    const c = cell(r, 3);
    add({
      id: "street_" + a + "_" + b + "_" + c,
      type: "street",
      labelKey: "bet.street",
      pockets: [String(a), String(b), String(c)],
      multiplier: 11,
      family: "insideMedium",
      placement: "street",
    });
  }

  add({
    id: "trio_0_1_2",
    type: "trio",
    labelKey: "bet.trio",
    pockets: ["0", "1", "2"],
    multiplier: 11,
    family: "zeroFamily",
    placement: "zero",
  });
  add({
    id: "trio_0_2_3",
    type: "trio",
    labelKey: "bet.trio",
    pockets: ["0", "2", "3"],
    multiplier: 11,
    family: "zeroFamily",
    placement: "zero",
  });
  add({
    id: "first_four_0_1_2_3",
    type: "firstFour",
    labelKey: "bet.firstFour",
    pockets: ["0", "1", "2", "3"],
    multiplier: 8,
    family: "zeroFamily",
    placement: "zero",
  });

  for (let r = 1; r <= 11; r++) {
    for (let c = 1; c <= 2; c++) {
      const p = [cell(r, c), cell(r, c + 1), cell(r + 1, c), cell(r + 1, c + 1)].map(String);
      add({
        id: "corner_" + p.join("_"),
        type: "corner",
        labelKey: "bet.corner",
        pockets: p,
        multiplier: 8,
        family: "insideMedium",
        placement: "corner",
      });
    }
  }

  for (let r = 1; r <= 11; r++) {
    const p = [];
    for (let rr = r; rr <= r + 1; rr++) {
      for (let c = 1; c <= 3; c++) p.push(String(cell(rr, c)));
    }
    add({
      id: "sixline_" + p[0] + "_" + p[5],
      type: "sixLine",
      labelKey: "bet.sixLine",
      pockets: p,
      multiplier: 5,
      family: "insideMedium",
      placement: "sixline",
    });
  }

  addOutside(add);

  return {
    schemaVersion: 1,
    $schemaComment:
      "MobileSpinRoulette — European full bet catalog (B1). amountDue on win = stake * multiplier (winnings only, B2).",
    tableVariant: "european",
    accounting: {
      payWinningsOnly: true,
      amountDueOnWin: "stake * multiplier",
      lose: "stake to house",
      outsideLoseOnZero: true,
    },
    pockets: Array.from({ length: 37 }, (_, i) => String(i)),
    betCount: bets.length,
    bets,
  };
}

function addOutside(add) {
  const reds = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].map(String);
  const blacks = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35].map(String);
  const evens = [];
  const odds = [];
  const low = [];
  const high = [];
  for (let n = 1; n <= 36; n++) {
    (n % 2 === 0 ? evens : odds).push(String(n));
    (n <= 18 ? low : high).push(String(n));
  }
  add({
    id: "red",
    type: "red",
    labelKey: "bet.red",
    pockets: reds,
    multiplier: 1,
    family: "outsideSimple",
    placement: "outside",
  });
  add({
    id: "black",
    type: "black",
    labelKey: "bet.black",
    pockets: blacks,
    multiplier: 1,
    family: "outsideSimple",
    placement: "outside",
  });
  add({
    id: "even",
    type: "even",
    labelKey: "bet.even",
    pockets: evens,
    multiplier: 1,
    family: "outsideSimple",
    placement: "outside",
  });
  add({
    id: "odd",
    type: "odd",
    labelKey: "bet.odd",
    pockets: odds,
    multiplier: 1,
    family: "outsideSimple",
    placement: "outside",
  });
  add({
    id: "low",
    type: "low",
    labelKey: "bet.low",
    pockets: low,
    multiplier: 1,
    family: "outsideSimple",
    placement: "outside",
  });
  add({
    id: "high",
    type: "high",
    labelKey: "bet.high",
    pockets: high,
    multiplier: 1,
    family: "outsideSimple",
    placement: "outside",
  });

  const d1 = [];
  const d2 = [];
  const d3 = [];
  for (let n = 1; n <= 12; n++) d1.push(String(n));
  for (let n = 13; n <= 24; n++) d2.push(String(n));
  for (let n = 25; n <= 36; n++) d3.push(String(n));
  add({
    id: "dozen1",
    type: "dozen",
    labelKey: "bet.dozen1",
    pockets: d1,
    multiplier: 2,
    family: "outsideDozenColumn",
    placement: "outside",
    dozenIndex: 1,
  });
  add({
    id: "dozen2",
    type: "dozen",
    labelKey: "bet.dozen2",
    pockets: d2,
    multiplier: 2,
    family: "outsideDozenColumn",
    placement: "outside",
    dozenIndex: 2,
  });
  add({
    id: "dozen3",
    type: "dozen",
    labelKey: "bet.dozen3",
    pockets: d3,
    multiplier: 2,
    family: "outsideDozenColumn",
    placement: "outside",
    dozenIndex: 3,
  });

  const col1 = [];
  const col2 = [];
  const col3 = [];
  for (let n = 1; n <= 36; n++) {
    if (n % 3 === 1) col1.push(String(n));
    else if (n % 3 === 2) col2.push(String(n));
    else col3.push(String(n));
  }
  add({
    id: "column1",
    type: "column",
    labelKey: "bet.column1",
    pockets: col1,
    multiplier: 2,
    family: "outsideDozenColumn",
    placement: "outside",
    columnIndex: 1,
  });
  add({
    id: "column2",
    type: "column",
    labelKey: "bet.column2",
    pockets: col2,
    multiplier: 2,
    family: "outsideDozenColumn",
    placement: "outside",
    columnIndex: 2,
  });
  add({
    id: "column3",
    type: "column",
    labelKey: "bet.column3",
    pockets: col3,
    multiplier: 2,
    family: "outsideDozenColumn",
    placement: "outside",
    columnIndex: 3,
  });
}

function buildAmerican() {
  const bets = [];
  const add = (b) => bets.push(b);

  for (let n = 0; n <= 36; n++) {
    add({
      id: "straight_" + n,
      type: "straight",
      labelKey: "bet.straight",
      pockets: [String(n)],
      multiplier: 35,
      family: n === 0 ? "zeroFamily" : "insideStraight",
      placement: n === 0 ? "zero" : "number",
    });
  }
  add({
    id: "straight_00",
    type: "straight",
    labelKey: "bet.straight",
    pockets: ["00"],
    multiplier: 35,
    family: "zeroFamily",
    placement: "zero",
  });

  for (let r = 1; r <= 12; r++) {
    for (let c = 1; c <= 2; c++) {
      const a = cell(r, c);
      const b = cell(r, c + 1);
      add({
        id: "split_" + a + "_" + b,
        type: "split",
        labelKey: "bet.split",
        pockets: [String(a), String(b)],
        multiplier: 17,
        family: "insideMedium",
        placement: "edge",
      });
    }
  }
  for (let r = 1; r <= 11; r++) {
    for (let c = 1; c <= 3; c++) {
      const a = cell(r, c);
      const b = cell(r + 1, c);
      add({
        id: "split_" + a + "_" + b,
        type: "split",
        labelKey: "bet.split",
        pockets: [String(a), String(b)],
        multiplier: 17,
        family: "insideMedium",
        placement: "edge",
      });
    }
  }
  for (const n of [1, 2]) {
    add({
      id: "split_0_" + n,
      type: "split",
      labelKey: "bet.split",
      pockets: ["0", String(n)],
      multiplier: 17,
      family: "zeroFamily",
      placement: "zero_edge",
    });
  }
  for (const n of [2, 3]) {
    add({
      id: "split_00_" + n,
      type: "split",
      labelKey: "bet.split",
      pockets: ["00", String(n)],
      multiplier: 17,
      family: "zeroFamily",
      placement: "zero_edge",
    });
  }
  add({
    id: "split_0_00",
    type: "split",
    labelKey: "bet.split",
    pockets: ["0", "00"],
    multiplier: 17,
    family: "zeroFamily",
    placement: "zero_edge",
  });

  for (let r = 1; r <= 12; r++) {
    const a = cell(r, 1);
    const b = cell(r, 2);
    const c = cell(r, 3);
    add({
      id: "street_" + a + "_" + b + "_" + c,
      type: "street",
      labelKey: "bet.street",
      pockets: [String(a), String(b), String(c)],
      multiplier: 11,
      family: "insideMedium",
      placement: "street",
    });
  }

  add({
    id: "five_number_0_00_1_2_3",
    type: "fiveNumber",
    labelKey: "bet.fiveNumber",
    pockets: ["0", "00", "1", "2", "3"],
    multiplier: 6,
    family: "zeroFamily",
    placement: "zero",
    americanOnly: true,
  });
  add({
    id: "trio_0_1_2",
    type: "trio",
    labelKey: "bet.trio",
    pockets: ["0", "1", "2"],
    multiplier: 11,
    family: "zeroFamily",
    placement: "zero",
  });
  add({
    id: "trio_00_2_3",
    type: "trio",
    labelKey: "bet.trio",
    pockets: ["00", "2", "3"],
    multiplier: 11,
    family: "zeroFamily",
    placement: "zero",
  });

  for (let r = 1; r <= 11; r++) {
    for (let c = 1; c <= 2; c++) {
      const p = [cell(r, c), cell(r, c + 1), cell(r + 1, c), cell(r + 1, c + 1)].map(String);
      add({
        id: "corner_" + p.join("_"),
        type: "corner",
        labelKey: "bet.corner",
        pockets: p,
        multiplier: 8,
        family: "insideMedium",
        placement: "corner",
      });
    }
  }
  for (let r = 1; r <= 11; r++) {
    const p = [];
    for (let rr = r; rr <= r + 1; rr++) {
      for (let c = 1; c <= 3; c++) p.push(String(cell(rr, c)));
    }
    add({
      id: "sixline_" + p[0] + "_" + p[5],
      type: "sixLine",
      labelKey: "bet.sixLine",
      pockets: p,
      multiplier: 5,
      family: "insideMedium",
      placement: "sixline",
    });
  }

  addOutside(add);

  const pockets = ["0", "00"].concat(Array.from({ length: 36 }, (_, i) => String(i + 1)));
  return {
    schemaVersion: 1,
    $schemaComment:
      "MobileSpinRoulette — American full bet catalog (B1). Includes 00 and five-number. amountDue = stake * multiplier (B2).",
    tableVariant: "american",
    accounting: {
      payWinningsOnly: true,
      amountDueOnWin: "stake * multiplier",
      lose: "stake to house",
      outsideLoseOnZero: true,
      outsideLoseOnDoubleZero: true,
    },
    pockets,
    betCount: bets.length,
    bets,
  };
}

const dir = __dirname;
const eu = buildEuropean();
const us = buildAmerican();
fs.writeFileSync(path.join(dir, "bets-european.json"), JSON.stringify(eu, null, 2));
fs.writeFileSync(path.join(dir, "bets-american.json"), JSON.stringify(us, null, 2));
console.log("Wrote bets-european.json betCount=", eu.betCount);
console.log("Wrote bets-american.json betCount=", us.betCount);
