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
  const diameterChangeOutput = document.querySelector("#diameter-change-output");
  const zChangeOutput = document.querySelector("#z-change-output");
  const fields = Object.fromEntries(
    inputKeys.map((key) => [key, document.querySelector(`[data-key="${key}"]`)])
  );
  const svgParts = {
    solid: document.querySelector("#chamfer-solid"),
    centerline: document.querySelector("#chamfer-centerline"),
    profile: document.querySelector("#chamfer-profile"),
    cut: document.querySelector("#chamfer-cut"),
    diameterLeader: document.querySelector("#chamfer-diameter-dim"),
    sizeDim: document.querySelector("#chamfer-size-dim"),
    cExtensionOne: document.querySelector("#chamfer-c-extension-one"),
    cExtensionTwo: document.querySelector("#chamfer-c-extension-two"),
    pointOneLeader: document.querySelector("#chamfer-point-one-leader"),
    pointTwoLeader: document.querySelector("#chamfer-point-two-leader"),
    angleArc: document.querySelector("#chamfer-angle-arc"),
    pointTwoDot: document.querySelector("#chamfer-point-diameter"),
    pointOneDot: document.querySelector("#chamfer-point-input"),
    modeLabel: document.querySelector("#chamfer-mode-label"),
    dLabel: document.querySelector("#chamfer-d-label"),
    cLabel: document.querySelector("#chamfer-c-label"),
    aLabel: document.querySelector("#chamfer-a-label"),
    zLabel: document.querySelector("#chamfer-z-label"),
    pointTwoLabel: document.querySelector("#chamfer-diameter-label"),
    pointOneLabel: document.querySelector("#chamfer-input-label"),
  };

  let lastSolution = null;

  function getMode() {
    return form.elements.mode.value;
  }

  function getPrecision() {
    return Number.parseInt(precisionSelect.value, 10);
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

  function parseInputs() {
    const values = {};
    const entered = [];
    const errors = [];

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

    return { values, entered, errors };
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

  function solveChamfer(values, mode) {
    const diameterChange = 2 * values.C;
    const zChange = values.C / Math.tan(toRadians(values.A));
    const pointOneX = mode === "turning" ? values.D - diameterChange : values.D + diameterChange;

    return {
      mode,
      values,
      diameterChange,
      zChange,
      pointOne: {
        x: pointOneX,
        z: values.Z,
      },
      pointTwo: {
        x: values.D,
        z: values.Z - zChange,
      },
    };
  }

  function renderSolution(solution) {
    inputKeys.forEach((key) => {
      fields[key].classList.add("is-entered");
    });

    resultPanel.hidden = false;
    pointOneOutput.textContent = formatPoint(solution.pointOne);
    pointTwoOutput.textContent = formatPoint(solution.pointTwo);
    diameterChangeOutput.textContent = `X CHANGE ${formatNumber(solution.diameterChange)}`;
    zChangeOutput.textContent = `Z CHANGE ${formatNumber(solution.zChange)}`;
    renderMessage(`${solution.mode.toUpperCase()} CHAMFER SOLVED.`, false);
    renderWork(solution);
    drawDiagram(solution);
  }

  function renderMessage(text, isError) {
    message.textContent = text;
    message.classList.toggle("is-error", isError);
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

  }

  function appendWorkItem(text) {
    const item = document.createElement("li");
    item.textContent = text;
    workList.append(item);
  }

  function renderError(errors, entered) {
    inputKeys.forEach((key) => {
      fields[key].classList.toggle("is-entered", entered.includes(key));
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

    lastSolution = null;
    resultPanel.hidden = true;
    clearOutputs();
    renderMessage("ENTER \u00d8D, A, C, AND Z TO SOLVE.", false);
    renderWork(null);
    drawDiagram(null, getMode());
  }

  function clearOutputs() {
    pointOneOutput.textContent = "";
    pointTwoOutput.textContent = "";
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
    const diameterLabel = getDiameterLabelPosition(points, mode);
    const zLabel = getZLabelPosition(points, mode);

    svgParts.solid.setAttribute("d", getSolidPath(points, mode));
    setLine(svgParts.centerline, { x: 64, y: points.centerY }, { x: 584, y: points.centerY });
    svgParts.profile.setAttribute("d", getProfilePath(points, mode));
    svgParts.cut.setAttribute(
      "d",
      `M${points.pointTwo.x} ${points.pointTwo.y} L${points.pointOne.x} ${points.pointOne.y}`
    );
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
    svgParts.angleArc.setAttribute("d", getAngleArc(points.pointTwo, preview.values.A, mode));
    setCircle(svgParts.pointTwoDot, points.pointTwo, 6);
    setCircle(svgParts.pointOneDot, points.pointOne, 6);
    setText(svgParts.modeLabel, mode === "turning" ? "TURNING" : "BORING", 88, 44);
    setText(svgParts.dLabel, "\u00d8D", diameterLabel.text.x, diameterLabel.text.y);
    setText(svgParts.cLabel, "C", cDimX + 30, (cTopY + cBottomY) / 2);
    const angleLabel = getAngleLabelPosition(points.pointTwo, preview.values.A, mode);
    setText(svgParts.aLabel, "A", angleLabel.x, angleLabel.y);
    setText(svgParts.zLabel, "Z", zLabel.x, zLabel.y);
    setText(svgParts.pointOneLabel, "POINT 1", pointOneLabel.text.x, pointOneLabel.text.y);
    setText(svgParts.pointTwoLabel, "POINT 2", pointTwoLabel.text.x, pointTwoLabel.text.y);
  }

  function getDiagramPoints(solution, mode) {
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
    const parsed = parseInputs();
    const errors = validateInputs(parsed, mode);

    if (errors.length > 0) {
      renderError(errors, parsed.entered);
      return;
    }

    lastSolution = solveChamfer(parsed.values, mode);
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

  form.addEventListener("change", (event) => {
    if (event.target.name !== "mode") {
      return;
    }

    clearSolutionState("MODE CHANGED. PRESS SOLVE TO UPDATE.");
    drawDiagram(null, getMode());
  });

  precisionSelect.addEventListener("change", () => {
    if (!lastSolution) {
      return;
    }

    renderSolution(lastSolution);
  });

  drawDiagram(null, getMode());
})();
