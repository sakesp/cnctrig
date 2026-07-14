(() => {
  const inputKeys = ["D", "A", "C", "Z"];
  const tolerance = 1e-10;
  const defaultValues = { D: 1, A: 45, C: 0.05, Z: 0 };

  const controls = document.querySelector("#chamfer-form");
  const precisionSelect = document.querySelector("#precision");
  const solveButton = document.querySelector("#solve-button");
  const clearButton = document.querySelector("#clear-button");
  const message = document.querySelector("#solver-message");
  const resultPanel = document.querySelector("#chamfer-results");
  const workList = document.querySelector("#work-list");
  const pointOneOutput = document.querySelector("#input-point-output");
  const pointTwoOutput = document.querySelector("#diameter-point-output");
  const pointOneExtensionOutputCard = document.querySelector("#point-one-extension-output-card");
  const pointOneExtensionOutput = document.querySelector("#point-one-extension-output");
  const pointTwoExtensionOutputCard = document.querySelector("#point-two-extension-output-card");
  const pointTwoExtensionOutput = document.querySelector("#point-two-extension-output");
  const diameterChangeOutput = document.querySelector("#diameter-change-output");
  const zChangeOutput = document.querySelector("#z-change-output");
  const fields = Object.fromEntries(
    inputKeys.map((key) => [key, document.querySelector(`[data-key="${key}"]`)])
  );
  const extensionControls = {
    pointOne: {
      toggle: document.querySelector("#point-one-extension-toggle"),
      fieldWrap: document.querySelector("#point-one-extension-field"),
      field: document.querySelector("#point-one-extension-z"),
    },
    pointTwo: {
      toggle: document.querySelector("#point-two-extension-toggle"),
      fieldWrap: document.querySelector("#point-two-extension-field"),
      field: document.querySelector("#point-two-extension-x"),
      axisLabel: document.querySelector("#point-two-extension-axis-label"),
    },
  };
  const svgParts = {
    solid: document.querySelector("#chamfer-solid"),
    centerline: document.querySelector("#chamfer-centerline"),
    profile: document.querySelector("#chamfer-profile"),
    pointOneExtensionCut: document.querySelector("#chamfer-point-one-extension-cut"),
    cut: document.querySelector("#chamfer-cut"),
    pointTwoExtensionCut: document.querySelector("#chamfer-point-two-extension-cut"),
    diameterLeader: document.querySelector("#chamfer-diameter-dim"),
    sizeDim: document.querySelector("#chamfer-size-dim"),
    cExtensionOne: document.querySelector("#chamfer-c-extension-one"),
    cExtensionTwo: document.querySelector("#chamfer-c-extension-two"),
    pointOneLeader: document.querySelector("#chamfer-point-one-leader"),
    pointTwoLeader: document.querySelector("#chamfer-point-two-leader"),
    pointOneExtensionLeader: document.querySelector("#chamfer-point-one-extension-leader"),
    pointTwoExtensionLeader: document.querySelector("#chamfer-point-two-extension-leader"),
    angleArc: document.querySelector("#chamfer-angle-arc"),
    pointTwoDot: document.querySelector("#chamfer-point-diameter"),
    pointOneDot: document.querySelector("#chamfer-point-input"),
    pointOneExtensionDot: document.querySelector("#chamfer-point-one-extension"),
    pointTwoExtensionDot: document.querySelector("#chamfer-point-two-extension"),
    dLabel: document.querySelector("#chamfer-d-label"),
    cLabel: document.querySelector("#chamfer-c-label"),
    aLabel: document.querySelector("#chamfer-a-label"),
    zLabel: document.querySelector("#chamfer-z-label"),
    pointTwoLabel: document.querySelector("#chamfer-diameter-label"),
    pointOneLabel: document.querySelector("#chamfer-input-label"),
    pointOneExtensionLabel: document.querySelector("#chamfer-point-one-extension-label"),
    pointTwoExtensionLabel: document.querySelector("#chamfer-point-two-extension-label"),
  };

  let lastSolution = null;

  function getMode() {
    return controls.querySelector('input[name="mode"]:checked').value;
  }

  function getPrecision() {
    return Number.parseInt(precisionSelect.value, 10);
  }

  function getPointTwoExtensionAxis(mode = getMode()) {
    return mode === "turning" ? "X+" : "X-";
  }

  function syncExtensionControls() {
    Object.values(extensionControls).forEach((control) => {
      control.fieldWrap.hidden = !control.toggle.checked;

      if (!control.toggle.checked) {
        control.field.classList.remove("is-entered");
      }
    });

    extensionControls.pointTwo.axisLabel.textContent = getPointTwoExtensionAxis();
  }

  function toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function formatNumber(value, places = getPrecision()) {
    const factor = 10 ** places;
    const rounded = Math.round((value + Number.EPSILON) * factor) / factor;

    if (Math.abs(rounded) < 0.5 / factor) {
      return "0";
    }

    let text = places === 0 ? String(Math.round(rounded)) : rounded.toFixed(places);

    if (text.includes(".")) {
      text = text.replace(/0+$/, "").replace(/\.$/, "");
    }

    if (text.startsWith("0.")) {
      text = text.slice(1);
    }

    if (text.startsWith("-0.")) {
      text = `-${text.slice(2)}`;
    }

    return text;
  }

  function formatPoint(point) {
    return `X${formatNumber(point.x)} Z${formatNumber(point.z)}`;
  }

  function parseInputs(mode) {
    const values = {};
    const entered = [];
    const extensionEntered = [];
    const errors = [];
    const extensions = {
      pointOne: {
        enabled: extensionControls.pointOne.toggle.checked,
        value: null,
      },
      pointTwo: {
        enabled: extensionControls.pointTwo.toggle.checked,
        value: null,
      },
    };

    inputKeys.forEach((key) => {
      const field = fields[key];
      const rawValue = field.value.trim();

      if (!rawValue) {
        return;
      }

      entered.push(key);

      const numericValue = Number(rawValue);

      if (!Number.isFinite(numericValue)) {
        errors.push(`${key} MUST BE A NUMBER.`);
        return;
      }

      values[key] = numericValue;
    });

    parseExtensionInput("pointOne", "POINT 1 Z+");
    parseExtensionInput("pointTwo", `POINT 2 ${getPointTwoExtensionAxis(mode)}`);

    return { values, entered, extensionEntered, errors, extensions };

    function parseExtensionInput(key, label) {
      if (!extensions[key].enabled) {
        return;
      }

      const field = extensionControls[key].field;
      const rawValue = field.value.trim();

      if (!rawValue) {
        errors.push(`ENTER ${label}.`);
        return;
      }

      extensionEntered.push(key);

      const numericValue = Number(rawValue);

      if (!Number.isFinite(numericValue)) {
        errors.push(`${label} MUST BE A NUMBER.`);
        return;
      }

      if (numericValue <= 0) {
        errors.push(`${label} MUST BE GREATER THAN 0.`);
        return;
      }

      extensions[key].value = numericValue;
    }
  }

  function validateInputs(parsed, mode) {
    const errors = [...parsed.errors];
    const missing = inputKeys.filter((key) => !Object.prototype.hasOwnProperty.call(parsed.values, key));

    if (missing.length > 0) {
      errors.push("ENTER \u00d8D, A, C, AND Z.");
    }

    if (errors.length > 0) {
      return errors;
    }

    const { D, A, C } = parsed.values;

    if (D <= 0) {
      errors.push("\u00d8D MUST BE GREATER THAN 0.");
    }

    if (C <= 0) {
      errors.push("C MUST BE GREATER THAN 0.");
    }

    if (A <= 0 || A >= 90) {
      errors.push("A MUST BE GREATER THAN 0 AND LESS THAN 90 DECIMAL DEGREES.");
    }

    if (mode === "turning" && D - 2 * C <= tolerance) {
      errors.push("\u00d8D - 2C MUST BE GREATER THAN 0 FOR TURNING.");
    }

    return errors;
  }

  function solveChamfer(values, mode, extensions = {}) {
    const diameterChange = 2 * values.C;
    const zChange = values.C / Math.tan(toRadians(values.A));
    const pointOneX = mode === "turning" ? values.D - diameterChange : values.D + diameterChange;
    const pointOne = {
      x: pointOneX,
      z: values.Z,
    };
    const pointTwo = {
      x: values.D,
      z: values.Z - zChange,
    };
    const solution = {
      mode,
      values,
      diameterChange,
      zChange,
      pointOne,
      pointTwo,
      pointOneExtension: null,
      pointTwoExtension: null,
    };

    if (extensions.pointOne?.enabled) {
      const zExtension = extensions.pointOne.value;
      const xChangePerZ = (pointOne.x - pointTwo.x) / zChange;

      solution.pointOneExtension = {
        x: pointOne.x + xChangePerZ * zExtension,
        z: pointOne.z + zExtension,
        amount: zExtension,
      };
    }

    if (extensions.pointTwo?.enabled) {
      const xExtension = extensions.pointTwo.value;
      const xDirection = mode === "turning" ? 1 : -1;
      const zExtension = (zChange / diameterChange) * xExtension;

      solution.pointTwoExtension = {
        x: pointTwo.x + xDirection * xExtension,
        z: pointTwo.z - zExtension,
        amount: xExtension,
        zExtension,
      };
    }

    return solution;
  }

  function renderSolution(solution) {
    inputKeys.forEach((key) => {
      fields[key].classList.add("is-entered");
    });
    extensionControls.pointOne.field.classList.toggle("is-entered", Boolean(solution.pointOneExtension));
    extensionControls.pointTwo.field.classList.toggle("is-entered", Boolean(solution.pointTwoExtension));

    resultPanel.hidden = false;
    pointOneExtensionOutputCard.hidden = !solution.pointOneExtension;
    pointTwoExtensionOutputCard.hidden = !solution.pointTwoExtension;
    pointOneExtensionOutput.textContent = solution.pointOneExtension ? formatPoint(solution.pointOneExtension) : "";
    pointOneOutput.textContent = formatPoint(solution.pointOne);
    pointTwoOutput.textContent = formatPoint(solution.pointTwo);
    pointTwoExtensionOutput.textContent = solution.pointTwoExtension ? formatPoint(solution.pointTwoExtension) : "";
    const toolpathChange = getToolpathChange(solution);
    diameterChangeOutput.textContent = `X CHANGE ${formatNumber(toolpathChange.x)}`;
    zChangeOutput.textContent = `Z CHANGE ${formatNumber(toolpathChange.z)}`;
    renderMessage(`${solution.mode.toUpperCase()} CHAMFER SOLVED.`, false);
    renderWork(solution);
    drawDiagram(solution);
  }

  function renderMessage(text, isError) {
    message.textContent = text;
    message.classList.toggle("is-error", isError);
  }

  function getOrderedToolpathPoints(solution) {
    return [
      solution.pointOneExtension,
      solution.pointOne,
      solution.pointTwo,
      solution.pointTwoExtension,
    ].filter(Boolean);
  }

  function getToolpathChange(solution) {
    const points = getOrderedToolpathPoints(solution);
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];

    return {
      x: Math.abs(lastPoint.x - firstPoint.x),
      z: Math.abs(lastPoint.z - firstPoint.z),
    };
  }

  function renderWork(solution) {
    workList.innerHTML = "";

    if (!solution) {
      appendWorkItem("SOLVE A CHAMFER TO SEE THE CALCULATION STEPS.");
      return;
    }

    appendWorkItem(
      `X CHANGE = 2 x C = 2 x ${formatNumber(solution.values.C)} = ${formatNumber(
        solution.diameterChange
      )}`
    );
    appendWorkItem(
      `Z CHANGE = C / tan(A) = ${formatNumber(solution.values.C)} / tan(${formatNumber(
        solution.values.A
      )}) = ${formatNumber(solution.zChange)}`
    );

    if (solution.pointOneExtension) {
      const xDelta = solution.pointOneExtension.x - solution.pointOne.x;
      const xSign = xDelta >= 0 ? "+" : "-";

      appendWorkItem(
        `POINT 1.1 Z = POINT 1 Z + ${formatNumber(solution.pointOneExtension.amount)} = ${formatNumber(
          solution.pointOneExtension.z
        )}`
      );
      appendWorkItem(
        `POINT 1.1 X = POINT 1 X ${xSign} ${formatNumber(Math.abs(xDelta))} = ${formatNumber(
          solution.pointOneExtension.x
        )}`
      );
    }

    if (solution.pointTwoExtension) {
      const xSign = solution.mode === "turning" ? "+" : "-";

      appendWorkItem(
        `POINT 2.2 X = POINT 2 X ${xSign} ${formatNumber(solution.pointTwoExtension.amount)} = ${formatNumber(
          solution.pointTwoExtension.x
        )}`
      );
      appendWorkItem(
        `POINT 2.2 Z = POINT 2 Z - ${formatNumber(solution.pointTwoExtension.zExtension)} = ${formatNumber(
          solution.pointTwoExtension.z
        )}`
      );
    }
  }

  function appendWorkItem(text) {
    const item = document.createElement("li");
    item.textContent = text;
    workList.append(item);
  }

  function renderError(errors, entered, extensionEntered = []) {
    inputKeys.forEach((key) => {
      fields[key].classList.toggle("is-entered", entered.includes(key));
    });
    Object.entries(extensionControls).forEach(([key, control]) => {
      control.field.classList.toggle("is-entered", control.toggle.checked && extensionEntered.includes(key));
    });
    resultPanel.hidden = true;
    clearOutputs();
    lastSolution = null;
    renderMessage(errors.join(" "), true);
    renderWork(null);
    drawDiagram(null, getMode());
  }

  function clearSolutionState(messageText) {
    if (!lastSolution && resultPanel.hidden) {
      return;
    }

    lastSolution = null;
    resultPanel.hidden = true;
    clearOutputs();
    renderMessage(messageText, false);
    renderWork(null);
    drawDiagram(null, getMode());
  }

  function clearAll() {
    inputKeys.forEach((key) => {
      fields[key].value = "";
      fields[key].classList.remove("is-entered");
    });
    Object.values(extensionControls).forEach((control) => {
      control.toggle.checked = false;
      control.field.value = "";
      control.field.classList.remove("is-entered");
    });
    syncExtensionControls();

    lastSolution = null;
    resultPanel.hidden = true;
    clearOutputs();
    renderMessage("ENTER \u00d8D, A, C, AND Z TO SOLVE.", false);
    renderWork(null);
    drawDiagram(null, getMode());
  }

  function clearOutputs() {
    pointOneExtensionOutputCard.hidden = true;
    pointTwoExtensionOutputCard.hidden = true;
    pointOneExtensionOutput.textContent = "";
    pointOneOutput.textContent = "";
    pointTwoOutput.textContent = "";
    pointTwoExtensionOutput.textContent = "";
    diameterChangeOutput.textContent = "";
    zChangeOutput.textContent = "";
  }

  function drawDiagram(solution, fallbackMode = getMode()) {
    const mode = solution?.mode || fallbackMode;
    const preview = solution || solveChamfer(defaultValues, mode);
    const points = getDiagramPoints(preview, mode);
    const cDimX = points.pointOne.x + 86;
    const cTopY = Math.min(points.pointOne.y, points.pointTwo.y);
    const cBottomY = Math.max(points.pointOne.y, points.pointTwo.y);
    const diameterLabel = getDiameterLabelPosition(points, mode);
    const zLabel = getZLabelPosition(points, mode);
    const angleLabel = getAngleLabelPosition(points.pointTwo, preview.values.A, mode);
    const sizeDimStart = { x: cDimX, y: cTopY + 8 };
    const sizeDimEnd = { x: cDimX, y: cBottomY - 8 };
    const cExtensionOneStart = { x: points.pointOne.x + 10, y: points.pointOne.y };
    const cExtensionOneEnd = { x: cDimX + 18, y: points.pointOne.y };
    const cExtensionTwoStart = { x: points.pointTwo.x + 10, y: points.pointTwo.y };
    const cExtensionTwoEnd = { x: cDimX + 18, y: points.pointTwo.y };
    const pointLabels = getPointLabelLayout(points, mode, [
      makeTextBox("\u00d8D", diameterLabel.text.x, diameterLabel.text.y, "dimension"),
      makeTextBox("C", cDimX + 30, (cTopY + cBottomY) / 2, "dimension"),
      makeTextBox("A", angleLabel.x, angleLabel.y, "dimension"),
      makeTextBox("Z", zLabel.x, zLabel.y, "dimension"),
      makeLineBox(sizeDimStart, sizeDimEnd, 8),
      makeLineBox(cExtensionOneStart, cExtensionOneEnd, 8),
      makeLineBox(cExtensionTwoStart, cExtensionTwoEnd, 8),
    ]);

    svgParts.solid.setAttribute("d", getSolidPath(points, mode));
    setLine(svgParts.centerline, { x: 64, y: points.centerY }, { x: 584, y: points.centerY });
    svgParts.profile.setAttribute("d", getProfilePath(points, mode));
    svgParts.cut.setAttribute("d", getCutPath(points));
    renderOptionalCutSegment(svgParts.pointOneExtensionCut, points.pointOneExtension, points.pointOne);
    renderOptionalCutSegment(svgParts.pointTwoExtensionCut, points.pointTwo, points.pointTwoExtension);
    setLine(svgParts.diameterLeader, diameterLabel.leaderStart, diameterLabel.leaderEnd);
    setLine(svgParts.sizeDim, sizeDimStart, sizeDimEnd);
    setLine(svgParts.cExtensionOne, cExtensionOneStart, cExtensionOneEnd);
    setLine(svgParts.cExtensionTwo, cExtensionTwoStart, cExtensionTwoEnd);
    setLine(svgParts.pointOneLeader, pointLabels.pointOne.leaderStart, stopShort(pointLabels.pointOne.leaderStart, points.pointOne, 12));
    setLine(svgParts.pointTwoLeader, pointLabels.pointTwo.leaderStart, stopShort(pointLabels.pointTwo.leaderStart, points.pointTwo, 12));
    renderOptionalDiagramPoint(
      points.pointOneExtension,
      pointLabels.pointOneExtension,
      svgParts.pointOneExtensionDot,
      svgParts.pointOneExtensionLabel,
      svgParts.pointOneExtensionLeader,
      "POINT 1.1"
    );
    renderOptionalDiagramPoint(
      points.pointTwoExtension,
      pointLabels.pointTwoExtension,
      svgParts.pointTwoExtensionDot,
      svgParts.pointTwoExtensionLabel,
      svgParts.pointTwoExtensionLeader,
      "POINT 2.2"
    );
    svgParts.angleArc.setAttribute("d", getAngleArc(points.pointTwo, preview.values.A, mode));
    setCircle(svgParts.pointTwoDot, points.pointTwo, 6);
    setCircle(svgParts.pointOneDot, points.pointOne, 6);
    setText(svgParts.dLabel, "\u00d8D", diameterLabel.text.x, diameterLabel.text.y);
    setText(svgParts.cLabel, "C", cDimX + 30, (cTopY + cBottomY) / 2);
    setText(svgParts.aLabel, "A", angleLabel.x, angleLabel.y);
    setText(svgParts.zLabel, "Z", zLabel.x, zLabel.y);
    setText(svgParts.pointOneLabel, "POINT 1", pointLabels.pointOne.text.x, pointLabels.pointOne.text.y);
    setText(svgParts.pointTwoLabel, "POINT 2", pointLabels.pointTwo.text.x, pointLabels.pointTwo.text.y);
  }

  function getCutPath(points) {
    return `M${points.pointOne.x} ${points.pointOne.y} L${points.pointTwo.x} ${points.pointTwo.y}`;
  }

  function renderOptionalCutSegment(path, start, end) {
    const hidden = !start || !end;

    setElementHidden(path, hidden);

    if (hidden) {
      return;
    }

    path.setAttribute("d", `M${start.x} ${start.y} L${end.x} ${end.y}`);
  }

  function renderOptionalDiagramPoint(point, labelPosition, dot, label, leader, labelText) {
    const hidden = !point || !labelPosition;

    setElementHidden(dot, hidden);
    setElementHidden(label, hidden);
    setElementHidden(leader, hidden);

    if (hidden) {
      return;
    }

    setCircle(dot, point, 6);
    setText(label, labelText, labelPosition.text.x, labelPosition.text.y);
    setLine(leader, labelPosition.leaderStart, stopShort(labelPosition.leaderStart, point, 11));
  }

  function setElementHidden(element, hidden) {
    element.style.display = hidden ? "none" : "";
  }

  function getDiagramPoints(solution, mode) {
    if (solution.pointOneExtension || solution.pointTwoExtension) {
      return getExtendedDiagramPoints(solution, mode);
    }

    const rawDz = Math.max(solution.zChange, tolerance);
    const rawRadialChange = Math.max(solution.values.C, tolerance);
    const scale = Math.min(180 / rawDz, 112 / rawRadialChange);
    const dz = clamp(rawDz * scale, 70, 180);
    const radialChange = clamp(rawRadialChange * scale, 44, 116);
    const pointTwo = mode === "turning" ? { x: 188, y: 128 } : { x: 188, y: 294 };
    const pointOne = {
      x: pointTwo.x + dz,
      y: pointTwo.y + (mode === "turning" ? radialChange : -radialChange),
    };

    return {
      centerY: 374,
      pointOne,
      pointTwo,
    };
  }

  function getExtendedDiagramPoints(solution, mode) {
    const worldPoints = {
      pointOne: solution.pointOne,
      pointTwo: solution.pointTwo,
      pointOneExtension: solution.pointOneExtension,
      pointTwoExtension: solution.pointTwoExtension,
    };
    const visiblePoints = Object.values(worldPoints).filter(Boolean);
    const zValues = visiblePoints.map((point) => point.z);
    const radialValues = visiblePoints.map((point) => getRadialOffset(point, solution, mode));
    const minZ = Math.min(...zValues);
    const maxZ = Math.max(...zValues);
    const minRadial = Math.min(...radialValues);
    const maxRadial = Math.max(...radialValues);
    const rawDz = Math.max(maxZ - minZ, tolerance);
    const rawRadialRange = Math.max(maxRadial - minRadial, tolerance);
    const scale = Math.min(304 / rawDz, 178 / rawRadialRange);
    const left = 150;
    const top = mode === "turning" ? 92 : 116;

    return {
      centerY: 374,
      pointOne: toExtendedScreenPoint(solution.pointOne),
      pointTwo: toExtendedScreenPoint(solution.pointTwo),
      pointOneExtension: solution.pointOneExtension ? toExtendedScreenPoint(solution.pointOneExtension) : null,
      pointTwoExtension: solution.pointTwoExtension ? toExtendedScreenPoint(solution.pointTwoExtension) : null,
    };

    function toExtendedScreenPoint(point) {
      const radial = getRadialOffset(point, solution, mode);

      return {
        x: left + (point.z - minZ) * scale,
        y:
          mode === "turning"
            ? top + (radial - minRadial) * scale
            : top + (maxRadial - radial) * scale,
      };
    }
  }

  function getRadialOffset(point, solution, mode) {
    if (mode === "turning") {
      return (solution.pointTwo.x - point.x) / 2;
    }

    return (point.x - solution.pointTwo.x) / 2;
  }

  function getSolidPath(points, mode) {
    if (mode === "turning") {
      return `M72 ${points.pointTwo.y} L${points.pointTwo.x} ${points.pointTwo.y} L${points.pointOne.x} ${points.pointOne.y} L${points.pointOne.x} 360 L72 360 Z`;
    }

    return `M72 72 L${points.pointOne.x} 72 L${points.pointOne.x} ${points.pointOne.y} L${points.pointTwo.x} ${points.pointTwo.y} L72 ${points.pointTwo.y} Z`;
  }

  function getProfilePath(points, mode) {
    if (mode === "turning") {
      return `M72 ${points.pointTwo.y} L${points.pointTwo.x} ${points.pointTwo.y} L${points.pointOne.x} ${points.pointOne.y} L${points.pointOne.x} 360`;
    }

    return `M72 ${points.pointTwo.y} L${points.pointTwo.x} ${points.pointTwo.y} L${points.pointOne.x} ${points.pointOne.y} M${points.pointOne.x} ${points.pointOne.y} L${points.pointOne.x} 72`;
  }

  function getDiameterLabelPosition(points, mode) {
    const lineX = 112;

    if (mode === "turning") {
      return {
        text: { x: 92, y: points.pointTwo.y - 50 },
        leaderStart: { x: lineX, y: points.pointTwo.y - 42 },
        leaderEnd: { x: lineX, y: points.pointTwo.y - 9 },
      };
    }

    return {
      text: { x: 92, y: points.pointTwo.y + 96 },
      leaderStart: { x: lineX, y: points.pointTwo.y + 62 },
      leaderEnd: { x: lineX, y: points.pointTwo.y + 9 },
    };
  }

  function getZLabelPosition(points, mode) {
    return {
      x: points.pointOne.x,
      y: mode === "turning" ? 388 : 52,
    };
  }

  function getPointLabelLayout(points, mode, fixedBoxes) {
    const stockPolygon = getStockPolygon(points, mode);
    const fixedSegments = getFixedSegments(points);
    const placed = [];
    const layout = {};
    const labelRequests = [
      { key: "pointOne", point: points.pointOne, text: "POINT 1", zone: "inside" },
      { key: "pointTwo", point: points.pointTwo, text: "POINT 2", zone: "inside" },
      { key: "pointOneExtension", point: points.pointOneExtension, text: "POINT 1.1", zone: "outside" },
      { key: "pointTwoExtension", point: points.pointTwoExtension, text: "POINT 2.2", zone: "outside" },
    ];

    labelRequests.forEach((request) => {
      if (!request.point) {
        layout[request.key] = null;
        return;
      }

      const label = getBestPointLabelPosition(request, {
        fixedBoxes,
        fixedSegments,
        placed,
        stockPolygon,
      });

      layout[request.key] = label;
      placed.push({
        box: label.box,
        leader: { start: label.leaderStart, end: request.point },
      });
    });

    return layout;
  }

  function getBestPointLabelPosition(request, context) {
    return getPointLabelCandidates(request).reduce((best, candidate) => {
      const score = scorePointLabelCandidate(candidate, request, context);

      return !best || score < best.score ? { ...candidate, score } : best;
    }, null);
  }

  function getPointLabelCandidates(request) {
    const distances = request.zone === "inside" ? [66, 84, 104, 126, 148] : [60, 78, 100, 124, 150];
    const directions = [
      { x: 1, y: 0 },
      { x: 0.86, y: -0.5 },
      { x: 0.86, y: 0.5 },
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -0.86, y: -0.5 },
      { x: -0.86, y: 0.5 },
      { x: -1, y: 0 },
      { x: 0.55, y: -0.83 },
      { x: 0.55, y: 0.83 },
      { x: -0.55, y: -0.83 },
      { x: -0.55, y: 0.83 },
    ];
    const candidates = [];

    distances.forEach((distance) => {
      directions.forEach((direction) => {
        const text = {
          x: request.point.x + direction.x * distance,
          y: request.point.y + direction.y * distance,
        };
        const box = makeTextBox(request.text, text.x, text.y, "coordinate");

        candidates.push({
          box,
          direction,
          distance,
          leaderStart: getLeaderStart(box, request.point),
          text,
        });
      });
    });

    return candidates;
  }

  function scorePointLabelCandidate(candidate, request, context) {
    const leader = { start: candidate.leaderStart, end: request.point };
    const obstacles = [
      ...context.fixedBoxes,
      ...context.placed.map((placedLabel) => placedLabel.box),
      ...getPointObstacleBoxes(context.fixedSegments),
    ];
    let score = candidate.distance;
    const leaderLength = Math.hypot(leader.end.x - leader.start.x, leader.end.y - leader.start.y);

    score += getZonePenalty(candidate.box, context.stockPolygon, request.zone);
    score += getBoundsPenalty(candidate.box);
    score += getPreferredDirectionPenalty(candidate.direction, request.key);
    score += leaderLength < 24 ? 1400 + (24 - leaderLength) * 30 : 0;

    obstacles.forEach((box) => {
      if (boxesOverlap(candidate.box, box)) {
        score += 1800 + getBoxOverlapArea(candidate.box, box) * 4;
      }
    });

    context.placed.forEach((placedLabel) => {
      if (segmentsIntersect(leader.start, leader.end, placedLabel.leader.start, placedLabel.leader.end)) {
        score += 1800;
      }
    });

    context.fixedSegments.forEach((segment) => {
      if (pointsAlmostEqual(segment.start, request.point) || pointsAlmostEqual(segment.end, request.point)) {
        return;
      }

      if (segmentsIntersect(leader.start, leader.end, segment.start, segment.end)) {
        score += 850;
      }
    });

    return score;
  }

  function getStockPolygon(points, mode) {
    if (mode === "turning") {
      return [
        { x: 72, y: points.pointTwo.y },
        { x: points.pointTwo.x, y: points.pointTwo.y },
        { x: points.pointOne.x, y: points.pointOne.y },
        { x: points.pointOne.x, y: 360 },
        { x: 72, y: 360 },
      ];
    }

    return [
      { x: 72, y: 72 },
      { x: points.pointOne.x, y: 72 },
      { x: points.pointOne.x, y: points.pointOne.y },
      { x: points.pointTwo.x, y: points.pointTwo.y },
      { x: 72, y: points.pointTwo.y },
    ];
  }

  function getFixedSegments(points) {
    return [
      points.pointOneExtension ? { start: points.pointOneExtension, end: points.pointOne } : null,
      { start: points.pointOne, end: points.pointTwo },
      points.pointTwoExtension ? { start: points.pointTwo, end: points.pointTwoExtension } : null,
    ].filter(Boolean);
  }

  function getPointObstacleBoxes(segments) {
    const uniquePoints = [];

    segments.forEach((segment) => {
      [segment.start, segment.end].forEach((point) => {
        if (!uniquePoints.some((existing) => pointsAlmostEqual(existing, point))) {
          uniquePoints.push(point);
        }
      });
    });

    return uniquePoints.map((point) => ({
      left: point.x - 12,
      right: point.x + 12,
      top: point.y - 12,
      bottom: point.y + 12,
    }));
  }

  function makeTextBox(text, x, y, size = "coordinate") {
    const width = text.length * (size === "dimension" ? 14 : 10);
    const height = size === "dimension" ? 28 : 22;

    return {
      left: x - width / 2,
      right: x + width / 2,
      top: y - height / 2,
      bottom: y + height / 2,
    };
  }

  function makeLineBox(start, end, padding) {
    return {
      left: Math.min(start.x, end.x) - padding,
      right: Math.max(start.x, end.x) + padding,
      top: Math.min(start.y, end.y) - padding,
      bottom: Math.max(start.y, end.y) + padding,
    };
  }

  function getLeaderStart(box, point) {
    return {
      x: clamp(point.x, box.left, box.right),
      y: clamp(point.y, box.top, box.bottom),
    };
  }

  function getZonePenalty(box, polygon, zone) {
    const center = getBoxCenter(box);
    const corners = getBoxCorners(box);
    const insideCorners = corners.filter((corner) => pointInPolygon(corner, polygon)).length;
    const centerInside = pointInPolygon(center, polygon);

    if (zone === "inside") {
      if (insideCorners === corners.length) {
        return 0;
      }

      return centerInside ? 900 : 12000;
    }

    if (insideCorners === 0 && !centerInside) {
      return 0;
    }

    return centerInside ? 12000 : 900;
  }

  function getBoundsPenalty(box) {
    const bounds = { left: 28, right: 612, top: 28, bottom: 402 };
    const overflow =
      Math.max(0, bounds.left - box.left) +
      Math.max(0, box.right - bounds.right) +
      Math.max(0, bounds.top - box.top) +
      Math.max(0, box.bottom - bounds.bottom);

    return overflow > 0 ? 2200 + overflow * 22 : 0;
  }

  function getPreferredDirectionPenalty(direction, key) {
    const preferredDirections = {
      pointOne: [
        { x: -0.8, y: 0.6 },
        { x: -1, y: 0 },
      ],
      pointTwo: [
        { x: 0.8, y: 0.6 },
        { x: 1, y: 0 },
      ],
      pointOneExtension: [
        { x: 0.8, y: 0.6 },
        { x: 1, y: 0 },
      ],
      pointTwoExtension: [
        { x: 0.8, y: -0.6 },
        { x: 1, y: 0 },
      ],
    };
    const bestDot = Math.max(
      ...preferredDirections[key].map((preferred) => direction.x * preferred.x + direction.y * preferred.y)
    );

    return (1 - bestDot) * 18;
  }

  function getBoxCenter(box) {
    return {
      x: (box.left + box.right) / 2,
      y: (box.top + box.bottom) / 2,
    };
  }

  function getBoxCorners(box) {
    return [
      { x: box.left, y: box.top },
      { x: box.right, y: box.top },
      { x: box.right, y: box.bottom },
      { x: box.left, y: box.bottom },
    ];
  }

  function pointInPolygon(point, polygon) {
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const start = polygon[i];
      const end = polygon[j];
      const intersects =
        start.y > point.y !== end.y > point.y &&
        point.x < ((end.x - start.x) * (point.y - start.y)) / (end.y - start.y) + start.x;

      if (intersects) {
        inside = !inside;
      }
    }

    return inside;
  }

  function boxesOverlap(first, second) {
    return first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
  }

  function getBoxOverlapArea(first, second) {
    if (!boxesOverlap(first, second)) {
      return 0;
    }

    return (Math.min(first.right, second.right) - Math.max(first.left, second.left)) *
      (Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
  }

  function segmentsIntersect(a, b, c, d) {
    const denominator = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);

    if (Math.abs(denominator) < tolerance) {
      return false;
    }

    const ua = ((d.x - c.x) * (a.y - c.y) - (d.y - c.y) * (a.x - c.x)) / denominator;
    const ub = ((b.x - a.x) * (a.y - c.y) - (b.y - a.y) * (a.x - c.x)) / denominator;

    return ua > 0.04 && ua < 0.96 && ub > 0.04 && ub < 0.96;
  }

  function pointsAlmostEqual(first, second) {
    return Math.abs(first.x - second.x) < 0.01 && Math.abs(first.y - second.y) < 0.01;
  }

  function getAngleArc(point, angle, mode) {
    const radius = 86;
    const direction = mode === "turning" ? 1 : -1;
    const inset = Math.min(7, angle * 0.17);
    const startAngle = inset;
    const endAngle = angle - inset;
    const start = {
      x: point.x + radius * Math.cos(toRadians(startAngle)),
      y: point.y + direction * radius * Math.sin(toRadians(startAngle)),
    };
    const end = {
      x: point.x + radius * Math.cos(toRadians(endAngle)),
      y: point.y + direction * radius * Math.sin(toRadians(endAngle)),
    };
    const sweep = mode === "turning" ? 1 : 0;

    return `M${start.x} ${start.y} A${radius} ${radius} 0 0 ${sweep} ${end.x} ${end.y}`;
  }

  function getAngleLabelPosition(point, angle, mode) {
    const radius = 102;
    const direction = mode === "turning" ? 1 : -1;
    const halfAngle = angle / 2;

    return {
      x: point.x + radius * Math.cos(toRadians(halfAngle)),
      y: point.y + direction * radius * Math.sin(toRadians(halfAngle)),
    };
  }

  function stopShort(start, end, gap) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;

    return {
      x: end.x - (dx / length) * gap,
      y: end.y - (dy / length) * gap,
    };
  }

  function setLine(line, start, end) {
    line.setAttribute("x1", start.x);
    line.setAttribute("y1", start.y);
    line.setAttribute("x2", end.x);
    line.setAttribute("y2", end.y);
  }

  function setCircle(circle, point, radius) {
    circle.setAttribute("cx", point.x);
    circle.setAttribute("cy", point.y);
    circle.setAttribute("r", radius);
  }

  function setText(text, value, x, y) {
    text.textContent = value;
    text.setAttribute("x", x);
    text.setAttribute("y", y);
  }

  function solveFromInputs() {
    const mode = getMode();
    const parsed = parseInputs(mode);
    const errors = validateInputs(parsed, mode);

    if (errors.length > 0) {
      renderError(errors, parsed.entered, parsed.extensionEntered);
      return;
    }

    lastSolution = solveChamfer(parsed.values, mode, parsed.extensions);
    renderSolution(lastSolution);
  }

  solveButton.addEventListener("click", solveFromInputs);

  controls.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !event.target.matches("input")) {
      return;
    }

    event.preventDefault();
    solveFromInputs();
  });

  clearButton.addEventListener("click", clearAll);

  inputKeys.forEach((key) => {
    fields[key].addEventListener("input", () => {
      const hasValue = fields[key].value.trim() !== "";
      fields[key].classList.toggle("is-entered", hasValue);
      clearSolutionState("INPUT CHANGED. PRESS SOLVE TO UPDATE.");
    });
  });

  Object.values(extensionControls).forEach((control) => {
    control.toggle.addEventListener("change", () => {
      syncExtensionControls();
      clearSolutionState("EXTENDED TOOLPATH CHANGED. PRESS SOLVE TO UPDATE.");
    });

    control.field.addEventListener("input", () => {
      const hasValue = control.field.value.trim() !== "";
      control.field.classList.toggle("is-entered", control.toggle.checked && hasValue);
      clearSolutionState("INPUT CHANGED. PRESS SOLVE TO UPDATE.");
    });
  });

  controls.addEventListener("change", (event) => {
    if (event.target.name !== "mode") {
      return;
    }

    syncExtensionControls();
    clearSolutionState("MODE CHANGED. PRESS SOLVE TO UPDATE.");
    drawDiagram(null, getMode());
  });

  precisionSelect.addEventListener("change", () => {
    if (!lastSolution) {
      return;
    }

    renderSolution(lastSolution);
  });

  syncExtensionControls();
  drawDiagram(null, getMode());
})();
