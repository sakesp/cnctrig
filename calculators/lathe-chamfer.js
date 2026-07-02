(() => {
  const inputKeys = ["D", "A", "C", "Z"];
  const tolerance = 1e-10;
  const defaultValues = { D: 1, A: 45, C: 0.05, Z: 0 };

  const form = document.querySelector("#chamfer-form");
  const precisionSelect = document.querySelector("#precision");
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
    return form.elements.mode.value;
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
    const pointOneLabel = getPointOneLabelPosition(points, mode);
    const pointTwoLabel = getPointTwoLabelPosition(points, mode);
    const pointOneExtensionLabel = points.pointOneExtension
      ? getPointOneExtensionLabelPosition(points, mode)
      : null;
    const pointTwoExtensionLabel = points.pointTwoExtension
      ? getPointTwoExtensionLabelPosition(points, mode)
      : null;
    const diameterLabel = getDiameterLabelPosition(points, mode);
    const zLabel = getZLabelPosition(points, mode);

    svgParts.solid.setAttribute("d", getSolidPath(points, mode));
    setLine(svgParts.centerline, { x: 64, y: points.centerY }, { x: 584, y: points.centerY });
    svgParts.profile.setAttribute("d", getProfilePath(points, mode));
    svgParts.cut.setAttribute("d", getCutPath(points));
    renderOptionalCutSegment(svgParts.pointOneExtensionCut, points.pointOneExtension, points.pointOne);
    renderOptionalCutSegment(svgParts.pointTwoExtensionCut, points.pointTwo, points.pointTwoExtension);
    setLine(svgParts.diameterLeader, diameterLabel.leaderStart, diameterLabel.leaderEnd);
    setLine(
      svgParts.sizeDim,
      { x: cDimX, y: cTopY + 8 },
      { x: cDimX, y: cBottomY - 8 }
    );
    setLine(svgParts.cExtensionOne, { x: points.pointOne.x + 10, y: points.pointOne.y }, { x: cDimX + 18, y: points.pointOne.y });
    setLine(svgParts.cExtensionTwo, { x: points.pointTwo.x + 10, y: points.pointTwo.y }, { x: cDimX + 18, y: points.pointTwo.y });
    setLine(svgParts.pointOneLeader, pointOneLabel.leaderStart, stopShort(pointOneLabel.leaderStart, points.pointOne, 12));
    setLine(svgParts.pointTwoLeader, pointTwoLabel.leaderStart, stopShort(pointTwoLabel.leaderStart, points.pointTwo, 12));
    renderOptionalDiagramPoint(
      points.pointOneExtension,
      pointOneExtensionLabel,
      svgParts.pointOneExtensionDot,
      svgParts.pointOneExtensionLabel,
      svgParts.pointOneExtensionLeader,
      "POINT 1.1"
    );
    renderOptionalDiagramPoint(
      points.pointTwoExtension,
      pointTwoExtensionLabel,
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
    const angleLabel = getAngleLabelPosition(points.pointTwo, preview.values.A, mode);
    setText(svgParts.aLabel, "A", angleLabel.x, angleLabel.y);
    setText(svgParts.zLabel, "Z", zLabel.x, zLabel.y);
    setText(svgParts.pointOneLabel, "POINT 1", pointOneLabel.text.x, pointOneLabel.text.y);
    setText(svgParts.pointTwoLabel, "POINT 2", pointTwoLabel.text.x, pointTwoLabel.text.y);
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

  function getPointOneLabelPosition(points, mode) {
    const text = {
      x: clamp(points.pointOne.x + 96, 300, 548),
      y: points.pointOne.y + (mode === "turning" ? 28 : -28),
    };

    return {
      text,
      leaderStart: { x: text.x - 50, y: text.y - (mode === "turning" ? 8 : -8) },
    };
  }

  function getPointTwoLabelPosition(points, mode) {
    const text = {
      x: mode === "turning" ? points.pointTwo.x + 22 : points.pointTwo.x + 68,
      y: points.pointTwo.y + (mode === "turning" ? 96 : 66),
    };

    return {
      text,
      leaderStart: { x: text.x - (mode === "turning" ? 8 : 28), y: text.y - 22 },
    };
  }

  function getPointOneExtensionLabelPosition(points, mode) {
    const text = {
      x: clamp(points.pointOneExtension.x + 84, 292, 570),
      y: points.pointOneExtension.y + (mode === "turning" ? 28 : -28),
    };

    return {
      text,
      leaderStart: { x: text.x - 42, y: text.y - (mode === "turning" ? 8 : -8) },
    };
  }

  function getPointTwoExtensionLabelPosition(points, mode) {
    const text = {
      x: clamp(points.pointTwoExtension.x + 76, 190, 430),
      y: points.pointTwoExtension.y - 38,
    };

    return {
      text,
      leaderStart: { x: text.x - 36, y: text.y + 14 },
    };
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

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const mode = getMode();
    const parsed = parseInputs(mode);
    const errors = validateInputs(parsed, mode);

    if (errors.length > 0) {
      renderError(errors, parsed.entered, parsed.extensionEntered);
      return;
    }

    lastSolution = solveChamfer(parsed.values, mode, parsed.extensions);
    renderSolution(lastSolution);
  });

  form.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !event.target.matches("input")) {
      return;
    }

    event.preventDefault();
    form.requestSubmit();
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

  form.addEventListener("change", (event) => {
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
