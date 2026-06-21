(() => {
  const sideKeys = ["a", "b", "c"];
  const angleKeys = ["A", "B", "C"];
  const allKeys = [...sideKeys, ...angleKeys];
  const angleOppositeSide = { a: "A", b: "B", c: "C" };
  const sideOppositeAngle = { A: "a", B: "b", C: "c" };
  const angleAdjacentSides = {
    A: ["b", "c"],
    B: ["a", "c"],
    C: ["a", "b"],
  };
  const sideEndpoints = {
    a: ["B", "C"],
    b: ["A", "C"],
    c: ["A", "B"],
  };
  const includedAngleForSides = {
    "b-c": "A",
    "a-c": "B",
    "a-b": "C",
  };
  const methodLabels = {
    SSS: "SIDE-SIDE-SIDE (SSS)",
    SAS: "SIDE-ANGLE-SIDE (SAS)",
    SSA: "SIDE-SIDE-ANGLE (SSA)",
    ASA: "ANGLE-SIDE-ANGLE (ASA)",
    AAS: "ANGLE-ANGLE-SIDE (AAS)",
  };
  const angleTolerance = 1e-7;
  const sideTolerance = 1e-10;
  const defaultSides = { a: 3, b: 5, c: 4 };

  const form = document.querySelector("#triangle-form");
  const precisionSelect = document.querySelector("#precision");
  const clearButton = document.querySelector("#clear-button");
  const message = document.querySelector("#solver-message");
  const solutionOptions = document.querySelector("#solution-options");
  const workList = document.querySelector("#work-list");
  const fields = Object.fromEntries(
    allKeys.map((key) => [key, document.querySelector(`[data-key="${key}"]`)])
  );
  const svgParts = {
    shape: document.querySelector("#triangle-shape"),
    lines: {
      AB: document.querySelector("#triangle-line-ab"),
      BC: document.querySelector("#triangle-line-bc"),
      CA: document.querySelector("#triangle-line-ca"),
    },
    sideLabels: {
      a: document.querySelector("#side-label-a"),
      b: document.querySelector("#side-label-b"),
      c: document.querySelector("#side-label-c"),
    },
    vertexLabels: {
      A: document.querySelector("#vertex-label-a"),
      B: document.querySelector("#vertex-label-b"),
      C: document.querySelector("#vertex-label-c"),
    },
  };

  let lastSolution = null;

  function hasValue(values, key) {
    return Object.prototype.hasOwnProperty.call(values, key);
  }

  function toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  function toDegrees(radians) {
    return radians * (180 / Math.PI);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getPrecision() {
    return Number.parseInt(precisionSelect.value, 10);
  }

  function formatNumber(value, places = getPrecision()) {
    const rounded = Number(value.toFixed(places));
    const displayValue = Object.is(rounded, -0) ? "0" : rounded.toFixed(places);

    return displayValue.includes(".")
      ? displayValue.replace(/0+$/, "").replace(/\.$/, "")
      : displayValue;
  }

  function sortedPair(first, second) {
    return [first, second].sort().join("-");
  }

  function parseInputs() {
    const values = {};
    const entered = [];
    const errors = [];

    allKeys.forEach((key) => {
      const field = fields[key];
      const rawValue = field.value.trim();

      if (!rawValue) {
        return;
      }

      if (field.dataset.state === "calculated") {
        return;
      }

      const storedValue = field.dataset.fullValue;
      const storedDisplay = field.dataset.displayValue;
      const useStoredValue =
        field.dataset.state === "entered" &&
        storedValue !== undefined &&
        storedDisplay === rawValue;
      const numericValue = Number(useStoredValue ? storedValue : rawValue);

      entered.push(key);

      if (!Number.isFinite(numericValue)) {
        errors.push(`${key} MUST BE A NUMBER.`);
        return;
      }

      values[key] = numericValue;
    });

    return { values, entered, errors };
  }

  function validateInputs(parsed) {
    const { values, entered } = parsed;
    const errors = [...parsed.errors];
    const sideCount = sideKeys.filter((key) => hasValue(values, key)).length;
    const angleCount = angleKeys.filter((key) => hasValue(values, key)).length;
    const enteredCount = entered.length;

    sideKeys.forEach((key) => {
      if (hasValue(values, key) && values[key] <= 0) {
        errors.push(`${key} MUST BE GREATER THAN 0.`);
      }
    });

    angleKeys.forEach((key) => {
      if (hasValue(values, key) && (values[key] <= 0 || values[key] >= 180)) {
        errors.push(`${key} MUST BE GREATER THAN 0 AND LESS THAN 180.`);
      }
    });

    const enteredAngleTotal = angleKeys.reduce(
      (total, key) => (hasValue(values, key) ? total + values[key] : total),
      0
    );

    if (angleCount === 3 && Math.abs(enteredAngleTotal - 180) > angleTolerance) {
      errors.push("ALL 3 ENTERED ANGLES MUST TOTAL 180.");
    }

    if (angleCount > 0 && angleCount < 3 && enteredAngleTotal >= 180 - angleTolerance) {
      errors.push("ENTERED ANGLES MUST TOTAL LESS THAN 180 UNLESS ALL 3 ARE ENTERED.");
    }

    if (enteredCount < 3) {
      errors.push("ENTER AT LEAST 3 VALUES.");
    }

    if (sideCount === 0) {
      errors.push("ANGLES ALONE DEFINE SHAPE, NOT SIDE LENGTHS. ENTER AT LEAST 1 SIDE.");
    }

    if (enteredCount > 3) {
      if (angleCount === 3 && sideCount >= 1) {
        errors.push("CLEAR 1 ANGLE. THIS VERSION WILL CALCULATE THE THIRD ANGLE.");
      } else {
        errors.push("ENTER EXACTLY 3 VALUES. CLEAR EXTRAS BEFORE SOLVING.");
      }
    }

    if (sideCount === 3 && enteredCount === 3 && !passesTriangleInequality(values)) {
      errors.push("SSS VALUES MUST SATISFY TRIANGLE INEQUALITY.");
    }

    return {
      errors,
      sideCount,
      angleCount,
      enteredCount,
    };
  }

  function passesTriangleInequality(values) {
    return (
      values.a + values.b > values.c + sideTolerance &&
      values.a + values.c > values.b + sideTolerance &&
      values.b + values.c > values.a + sideTolerance
    );
  }

  function solveTriangle(parsed) {
    const validation = validateInputs(parsed);

    if (validation.errors.length > 0) {
      return {
        ok: false,
        errors: validation.errors,
        entered: parsed.entered,
      };
    }

    const { values, entered } = parsed;
    const sideCount = validation.sideCount;
    const angleCount = validation.angleCount;

    if (sideCount === 3) {
      return solveSss(values, entered);
    }

    if (sideCount === 1 && angleCount === 2) {
      return solveAngleAngleSide(values, entered);
    }

    if (sideCount === 2 && angleCount === 1) {
      return solveSas(values, entered);
    }

    return {
      ok: false,
      errors: ["THIS VALUE SET IS NOT SUPPORTED IN VERSION 1."],
      entered,
    };
  }

  function solveSss(values, entered) {
    const solved = {
      a: values.a,
      b: values.b,
      c: values.c,
    };

    solved.A = angleFromSides(solved.a, solved.b, solved.c);
    solved.B = angleFromSides(solved.b, solved.a, solved.c);
    solved.C = 180 - solved.A - solved.B;

    return {
      ok: true,
      method: "SSS",
      values: solved,
      entered,
      work: [
        { type: "cosAngle", angle: "A", opposite: "a", adjacent: ["b", "c"] },
        { type: "cosAngle", angle: "B", opposite: "b", adjacent: ["a", "c"] },
        { type: "angleRemainder", angle: "C", from: ["A", "B"] },
      ],
    };
  }

  function solveSas(values, entered) {
    const knownSides = sideKeys.filter((key) => hasValue(values, key));
    const knownAngle = angleKeys.find((key) => hasValue(values, key));
    const pairKey = sortedPair(knownSides[0], knownSides[1]);
    const includedAngle = includedAngleForSides[pairKey];

    if (knownAngle !== includedAngle) {
      return solveSsa(values, entered, knownSides, knownAngle);
    }

    const missingSide = sideOppositeAngle[includedAngle];
    const solved = {
      ...values,
      [missingSide]: sideFromSas(values[knownSides[0]], values[knownSides[1]], values[includedAngle]),
    };
    const remainingAngles = angleKeys.filter((key) => key !== includedAngle);
    const angleFromCos = remainingAngles[0];
    const finalAngle = remainingAngles[1];

    solved[angleFromCos] = angleFromSides(
      solved[sideOppositeAngle[angleFromCos]],
      solved[sideEndpointLengths(angleFromCos)[0]],
      solved[sideEndpointLengths(angleFromCos)[1]]
    );
    solved[finalAngle] = 180 - solved[includedAngle] - solved[angleFromCos];

    return {
      ok: true,
      method: "SAS",
      values: solved,
      entered,
      work: [
        {
          type: "sideFromSas",
          side: missingSide,
          adjacent: knownSides,
          angle: includedAngle,
        },
        {
          type: "cosAngle",
          angle: angleFromCos,
          opposite: sideOppositeAngle[angleFromCos],
          adjacent: sideEndpointLengths(angleFromCos),
        },
        { type: "angleRemainder", angle: finalAngle, from: [includedAngle, angleFromCos] },
      ],
    };
  }

  function solveSsa(values, entered, knownSides, knownAngle) {
    const oppositeKnownSide = sideOppositeAngle[knownAngle];
    const otherKnownSide = knownSides.find((key) => key !== oppositeKnownSide);

    if (!knownSides.includes(oppositeKnownSide) || !otherKnownSide) {
      return {
        ok: false,
        errors: ["THIS SSA VALUE SET IS NOT SUPPORTED."],
        entered,
      };
    }

    const otherAngle = angleOppositeSide[otherKnownSide];
    const sineValue =
      (values[otherKnownSide] * Math.sin(toRadians(values[knownAngle]))) /
      values[oppositeKnownSide];

    if (sineValue > 1 + sideTolerance) {
      return {
        ok: false,
        errors: ["SSA VALUES DO NOT FORM A TRIANGLE."],
        entered,
      };
    }

    const primaryAngle = toDegrees(Math.asin(clamp(sineValue, -1, 1)));
    const candidateAngles = [primaryAngle];

    if (Math.abs(primaryAngle - 90) > angleTolerance) {
      candidateAngles.push(180 - primaryAngle);
    }

    const validAngles = candidateAngles.filter(
      (angle) => angle > angleTolerance && values[knownAngle] + angle < 180 - angleTolerance
    );

    if (validAngles.length === 0) {
      return {
        ok: false,
        errors: ["SSA VALUES DO NOT FORM A TRIANGLE."],
        entered,
      };
    }

    const scale = values[oppositeKnownSide] / Math.sin(toRadians(values[knownAngle]));
    const alternatives = validAngles.map((angle, index) =>
      buildSsaSolution({
        values,
        entered,
        knownAngle,
        oppositeKnownSide,
        otherKnownSide,
        otherAngle,
        otherAngleValue: angle,
        baseAngle: primaryAngle,
        usesSupplement: index > 0,
        scale,
      })
    );

    if (alternatives.length > 1) {
      return {
        ...alternatives[0],
        alternatives,
        activeIndex: 0,
      };
    }

    return alternatives[0];
  }

  function buildSsaSolution({
    values,
    entered,
    knownAngle,
    oppositeKnownSide,
    otherKnownSide,
    otherAngle,
    otherAngleValue,
    baseAngle,
    usesSupplement,
    scale,
  }) {
    const solved = { ...values };
    const missingAngle = angleKeys.find((key) => key !== knownAngle && key !== otherAngle);
    const missingSide = sideKeys.find((key) => !hasValue(values, key));

    solved[otherAngle] = otherAngleValue;
    solved[missingAngle] = 180 - solved[knownAngle] - solved[otherAngle];
    solved[missingSide] = scale * Math.sin(toRadians(solved[angleOppositeSide[missingSide]]));

    return {
      ok: true,
      method: "SSA",
      values: solved,
      entered,
      work: [
        {
          type: "angleFromSine",
          angle: otherAngle,
          side: otherKnownSide,
          knownAngle,
          knownSide: oppositeKnownSide,
          baseAngle,
          usesSupplement,
        },
        { type: "angleRemainder", angle: missingAngle, from: [knownAngle, otherAngle] },
        { type: "sineScale", side: oppositeKnownSide, angle: knownAngle, scale },
        { type: "sideFromSineScale", side: missingSide, angle: angleOppositeSide[missingSide], scale },
      ],
    };
  }

  function solveAngleAngleSide(values, entered) {
    const solved = { ...values };
    const knownSide = sideKeys.find((key) => hasValue(values, key));
    const knownAngles = angleKeys.filter((key) => hasValue(values, key));
    const missingAngle = angleKeys.find((key) => !hasValue(values, key));
    const method = isIncludedSide(knownSide, knownAngles) ? "ASA" : "AAS";

    solved[missingAngle] = 180 - values[knownAngles[0]] - values[knownAngles[1]];

    const scale = solved[knownSide] / Math.sin(toRadians(solved[angleOppositeSide[knownSide]]));

    sideKeys.forEach((key) => {
      if (!hasValue(solved, key)) {
        solved[key] = scale * Math.sin(toRadians(solved[angleOppositeSide[key]]));
      }
    });

    return {
      ok: true,
      method,
      values: solved,
      entered,
      work: [
        { type: "angleRemainder", angle: missingAngle, from: knownAngles },
        { type: "sineScale", side: knownSide, angle: angleOppositeSide[knownSide], scale },
        ...sideKeys
          .filter((key) => key !== knownSide)
          .map((key) => ({ type: "sideFromSineScale", side: key, angle: angleOppositeSide[key], scale })),
      ],
    };
  }

  function angleFromSides(opposite, adjacentOne, adjacentTwo) {
    const ratio =
      (adjacentOne * adjacentOne + adjacentTwo * adjacentTwo - opposite * opposite) /
      (2 * adjacentOne * adjacentTwo);

    return toDegrees(Math.acos(clamp(ratio, -1, 1)));
  }

  function sideFromSas(sideOne, sideTwo, includedAngle) {
    const sideSquared =
      sideOne * sideOne +
      sideTwo * sideTwo -
      2 * sideOne * sideTwo * Math.cos(toRadians(includedAngle));

    return Math.sqrt(Math.max(0, sideSquared));
  }

  function sideEndpointLengths(angle) {
    return angleAdjacentSides[angle];
  }

  function isIncludedSide(side, angles) {
    const endpoints = sideEndpoints[side];
    return endpoints.every((angle) => angles.includes(angle));
  }

  function renderResults(solution) {
    allKeys.forEach((key) => {
      const field = fields[key];
      const displayValue = formatNumber(solution.values[key]);
      const state = solution.entered.includes(key) ? "entered" : "calculated";

      field.value = displayValue;
      field.dataset.state = state;
      field.dataset.fullValue = String(solution.values[key]);
      field.dataset.displayValue = displayValue;
      field.classList.toggle("is-entered", state === "entered");
      field.classList.toggle("is-calculated", state === "calculated");
    });

    if (solution.alternatives?.length > 1) {
      renderMessage(
        `METHOD: ${getMethodLabel(solution.method)}. 2 POSSIBLE SOLUTIONS. SELECT THE ONE THAT MATCHES THE JOB.`,
        false
      );
    } else {
      renderMessage(`METHOD: ${getMethodLabel(solution.method)}.`, false);
    }

    renderSolutionOptions(solution);
  }

  function getMethodLabel(method) {
    return methodLabels[method] || method;
  }

  function renderMessage(text, isError) {
    message.textContent = text;
    message.classList.toggle("is-error", isError);
  }

  function renderWork(solution) {
    workList.innerHTML = "";

    if (!solution) {
      const item = document.createElement("li");
      item.textContent = "SOLVE A TRIANGLE TO SEE THE CALCULATION STEPS.";
      workList.append(item);
      return;
    }

    solution.work.forEach((step) => {
      const item = document.createElement("li");
      item.textContent = formatWorkStep(step, solution.values);
      workList.append(item);
    });
  }

  function renderSolutionOptions(solution) {
    solutionOptions.innerHTML = "";

    if (!solution?.alternatives || solution.alternatives.length < 2) {
      solutionOptions.hidden = true;
      return;
    }

    solutionOptions.hidden = false;

    const note = document.createElement("p");
    note.className = "solution-note";
    note.textContent =
      "THIS HAPPENS WHEN THE ENTERED ANGLE IS ACROSS FROM ONE ENTERED SIDE. THE ANGLE BETWEEN THE TWO ENTERED SIDES GIVES ONE TRIANGLE.";
    solutionOptions.append(note);

    solution.alternatives.forEach((option, index) => {
      const row = document.createElement("div");
      row.className = "solution-option";
      row.classList.toggle("is-active", index === solution.activeIndex);

      const button = document.createElement("button");
      button.type = "button";
      button.dataset.solutionIndex = String(index);
      button.textContent = `SOLUTION ${index + 1}`;
      button.setAttribute("aria-pressed", index === solution.activeIndex ? "true" : "false");

      const values = document.createElement("p");
      values.textContent = formatSolutionSummary(option.values);

      row.append(button, values);
      solutionOptions.append(row);
    });
  }

  function formatSolutionSummary(values) {
    return allKeys.map((key) => `${key}=${formatNumber(values[key])}`).join("  ");
  }

  function formatWorkStep(step, values) {
    if (step.type === "cosAngle") {
      const [adjacentOne, adjacentTwo] = step.adjacent;
      return `${step.angle} = cos^-1((${adjacentOne}^2 + ${adjacentTwo}^2 - ${step.opposite}^2) / (2 x ${adjacentOne} x ${adjacentTwo})) = cos^-1((${formatNumber(values[adjacentOne])}^2 + ${formatNumber(values[adjacentTwo])}^2 - ${formatNumber(values[step.opposite])}^2) / (2 x ${formatNumber(values[adjacentOne])} x ${formatNumber(values[adjacentTwo])})) = ${formatNumber(values[step.angle])}`;
    }

    if (step.type === "angleRemainder") {
      return `${step.angle} = 180 - ${step.from.join(" - ")} = 180 - ${step.from
        .map((angle) => formatNumber(values[angle]))
        .join(" - ")} = ${formatNumber(values[step.angle])}`;
    }

    if (step.type === "angleFromSine") {
      const baseFormula = `sin^-1(${step.side} x sin(${step.knownAngle}) / ${step.knownSide})`;
      const baseValues = `sin^-1(${formatNumber(values[step.side])} x sin(${formatNumber(values[step.knownAngle])}) / ${formatNumber(values[step.knownSide])})`;

      if (step.usesSupplement) {
        return `${step.angle} = 180 - ${baseFormula} = 180 - ${baseValues} = 180 - ${formatNumber(step.baseAngle)} = ${formatNumber(values[step.angle])}`;
      }

      return `${step.angle} = ${baseFormula} = ${baseValues} = ${formatNumber(values[step.angle])}`;
    }

    if (step.type === "sideFromSas") {
      const [sideOne, sideTwo] = step.adjacent;
      return `${step.side} = sqrt(${sideOne}^2 + ${sideTwo}^2 - 2 x ${sideOne} x ${sideTwo} x cos(${step.angle})) = sqrt(${formatNumber(values[sideOne])}^2 + ${formatNumber(values[sideTwo])}^2 - 2 x ${formatNumber(values[sideOne])} x ${formatNumber(values[sideTwo])} x cos(${formatNumber(values[step.angle])})) = ${formatNumber(values[step.side])}`;
    }

    if (step.type === "sineScale") {
      return `RATIO = ${step.side} / sin(${step.angle}) = ${formatNumber(values[step.side])} / sin(${formatNumber(values[step.angle])}) = ${formatNumber(step.scale)}`;
    }

    if (step.type === "sideFromSineScale") {
      return `${step.side} = RATIO x sin(${step.angle}) = ${formatNumber(step.scale)} x sin(${formatNumber(values[step.angle])}) = ${formatNumber(values[step.side])}`;
    }

    return "";
  }

  function renderError(result) {
    markEnteredFields(result.entered);
    renderMessage(result.errors.join(" "), true);
    renderSolutionOptions(null);
    renderWork(null);
    drawTriangleSvg(null);
  }

  function markEnteredFields(entered) {
    allKeys.forEach((key) => {
      const isEntered = entered.includes(key) && fields[key].value.trim() !== "";
      fields[key].classList.toggle("is-entered", isEntered);
      fields[key].classList.remove("is-calculated");
      fields[key].dataset.state = isEntered ? "entered" : "";
    });
  }

  function clearCalculatedValues() {
    let clearedAny = false;

    allKeys.forEach((key) => {
      const field = fields[key];

      if (field.dataset.state === "calculated") {
        field.value = "";
        clearFieldState(field);
        clearedAny = true;
      }
    });

    if (clearedAny) {
      lastSolution = null;
      renderMessage("ENTER 3 VALUES TO SOLVE.", false);
      renderSolutionOptions(null);
      renderWork(null);
      drawTriangleSvg(null);
    }
  }

  function clearFieldState(field) {
    field.classList.remove("is-entered", "is-calculated");
    delete field.dataset.state;
    delete field.dataset.fullValue;
    delete field.dataset.displayValue;
  }

  function clearAll() {
    allKeys.forEach((key) => {
      fields[key].value = "";
      clearFieldState(fields[key]);
    });

    lastSolution = null;
    renderMessage("ENTER 3 VALUES TO SOLVE.", false);
    renderSolutionOptions(null);
    renderWork(null);
    drawTriangleSvg(null);
  }

  function drawTriangleSvg(solution) {
    const sides = solution ? solution.values : defaultSides;
    const rawPoints = calculateTrianglePoints(sides);
    const points = fitTriangleToViewBox(rawPoints, 640, 430, 58);
    const pointList = `${points.A.x},${points.A.y} ${points.B.x},${points.B.y} ${points.C.x},${points.C.y}`;

    svgParts.shape.setAttribute("points", pointList);
    setLine(svgParts.lines.AB, points.A, points.B);
    setLine(svgParts.lines.BC, points.B, points.C);
    setLine(svgParts.lines.CA, points.C, points.A);
    positionLabels(points);
  }

  function calculateTrianglePoints(sides) {
    const c = sides.c;
    const b = sides.b;
    const a = sides.a;
    const x = (b * b + c * c - a * a) / (2 * c);
    const y = Math.sqrt(Math.max(0, b * b - x * x));

    return {
      A: { x: 0, y: 0 },
      B: { x: c, y: 0 },
      C: { x, y },
    };
  }

  function fitTriangleToViewBox(points, width, height, padding) {
    const raw = Object.values(points);
    const minX = Math.min(...raw.map((point) => point.x));
    const maxX = Math.max(...raw.map((point) => point.x));
    const minY = Math.min(...raw.map((point) => point.y));
    const maxY = Math.max(...raw.map((point) => point.y));
    const rangeX = Math.max(maxX - minX, sideTolerance);
    const rangeY = Math.max(maxY - minY, sideTolerance);
    const scale = Math.min((width - padding * 2) / rangeX, (height - padding * 2) / rangeY);
    const drawingWidth = rangeX * scale;
    const drawingHeight = rangeY * scale;
    const offsetX = (width - drawingWidth) / 2 - minX * scale;
    const offsetY = (height + drawingHeight) / 2 + minY * scale;

    return Object.fromEntries(
      Object.entries(points).map(([key, point]) => [
        key,
        {
          x: offsetX + point.x * scale,
          y: offsetY - point.y * scale,
        },
      ])
    );
  }

  function setLine(line, start, end) {
    line.setAttribute("x1", start.x);
    line.setAttribute("y1", start.y);
    line.setAttribute("x2", end.x);
    line.setAttribute("y2", end.y);
  }

  function positionLabels(points) {
    const center = {
      x: (points.A.x + points.B.x + points.C.x) / 3,
      y: (points.A.y + points.B.y + points.C.y) / 3,
    };

    Object.entries(points).forEach(([key, point]) => {
      setTextPosition(svgParts.vertexLabels[key], offsetFromCenter(point, center, 28));
    });

    const sidePairs = {
      a: [points.B, points.C],
      b: [points.A, points.C],
      c: [points.A, points.B],
    };

    Object.entries(sidePairs).forEach(([key, pair]) => {
      const midpoint = {
        x: (pair[0].x + pair[1].x) / 2,
        y: (pair[0].y + pair[1].y) / 2,
      };
      setTextPosition(svgParts.sideLabels[key], offsetFromCenter(midpoint, center, 24));
    });
  }

  function offsetFromCenter(point, center, distance) {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const length = Math.hypot(dx, dy) || 1;

    return {
      x: clamp(point.x + (dx / length) * distance, 18, 622),
      y: clamp(point.y + (dy / length) * distance, 22, 408),
    };
  }

  function setTextPosition(element, point) {
    element.setAttribute("x", point.x);
    element.setAttribute("y", point.y);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const parsed = parseInputs();
    const solution = solveTriangle(parsed);

    if (!solution.ok) {
      lastSolution = null;
      renderError(solution);
      return;
    }

    lastSolution = solution;
    renderResults(solution);
    renderWork(solution);
    drawTriangleSvg(solution);
  });

  clearButton.addEventListener("click", clearAll);

  solutionOptions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-solution-index]");

    if (!button || !lastSolution?.alternatives) {
      return;
    }

    const activeIndex = Number.parseInt(button.dataset.solutionIndex, 10);
    const selected = lastSolution.alternatives[activeIndex];

    lastSolution = {
      ...selected,
      alternatives: lastSolution.alternatives,
      activeIndex,
    };

    renderResults(lastSolution);
    renderWork(lastSolution);
    drawTriangleSvg(lastSolution);
  });

  allKeys.forEach((key) => {
    const field = fields[key];

    field.addEventListener("focus", clearCalculatedValues);
    field.addEventListener("input", () => {
      clearCalculatedValues();
      delete field.dataset.fullValue;
      delete field.dataset.displayValue;
      field.dataset.state = field.value.trim() ? "entered" : "";
      field.classList.toggle("is-entered", field.value.trim() !== "");
      field.classList.remove("is-calculated");
    });
  });

  precisionSelect.addEventListener("change", () => {
    if (!lastSolution) {
      return;
    }

    renderResults(lastSolution);
    renderWork(lastSolution);
    renderSolutionOptions(lastSolution);
  });

  drawTriangleSvg(null);
})();
