(() => {
  const tolerance = 1e-12;
  const diagramCenter = { x: 320, y: 226 };
  const diagramRadius = 142;

  function toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  function rotatePoint(x, z, degrees) {
    // Top (+Y) view: X+ right, Z+ down, and physical B+ moves clockwise.
    const radians = toRadians(degrees);
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);

    return {
      originalX: x,
      originalZ: z,
      degrees,
      radians,
      cosine,
      sine,
      newX: x * cosine - z * sine,
      newZ: x * sine + z * cosine,
      radius: Math.hypot(x, z),
    };
  }

  if (typeof module === "object" && module.exports) {
    module.exports = { rotatePoint };
  }

  if (typeof document === "undefined") {
    return;
  }

  const inputKeys = ["X", "Z", "B"];
  const form = document.querySelector("#rotary-form");
  const precisionSelect = document.querySelector("#precision");
  const clearButton = document.querySelector("#clear-button");
  const message = document.querySelector("#solver-message");
  const resultPanel = document.querySelector("#rotary-results");
  const newXOutput = document.querySelector("#new-x-output");
  const newZOutput = document.querySelector("#new-z-output");
  const radiusOutput = document.querySelector("#radius-output");
  const workList = document.querySelector("#work-list");
  const fields = Object.fromEntries(
    inputKeys.map((key) => [key, document.querySelector(`[data-key="${key}"]`)])
  );
  const svgParts = {
    description: document.querySelector("#rotary-svg-description"),
    orbit: document.querySelector("#rotary-orbit"),
    originalRadius: document.querySelector("#rotary-original-radius"),
    newRadius: document.querySelector("#rotary-new-radius"),
    angleArc: document.querySelector("#rotary-angle-arc"),
    angleLabel: document.querySelector("#rotary-angle-label"),
    originalPoint: document.querySelector("#rotary-original-point"),
    newPoint: document.querySelector("#rotary-new-point"),
    originalLabel: document.querySelector("#rotary-original-label"),
    newLabel: document.querySelector("#rotary-new-label"),
  };

  let lastSolution = null;

  function getPrecision() {
    return Number.parseInt(precisionSelect.value, 10);
  }

  function formatNumber(value, places = getPrecision()) {
    if (!Number.isFinite(value)) {
      return "";
    }

    if (Math.abs(value) >= 1e21) {
      const [mantissa, exponent] = value.toExponential(places).split("e");
      const trimmedMantissa = mantissa.replace(/0+$/, "").replace(/\.$/, "");

      return `${trimmedMantissa}e${exponent}`;
    }

    const factor = 10 ** places;
    const roundedMagnitude = Math.round((Math.abs(value) + Number.EPSILON) * factor) / factor;
    const rounded = Math.sign(value) * roundedMagnitude;

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

  function formatAngle(degrees) {
    const magnitude = formatNumber(Math.abs(degrees));

    if (degrees > tolerance) {
      return `B+${magnitude}\u00b0`;
    }

    if (degrees < -tolerance) {
      return `B-${magnitude}\u00b0`;
    }

    return "B0\u00b0";
  }

  function parseInputs() {
    const values = {};
    const missing = [];
    const errors = [];

    inputKeys.forEach((key) => {
      const field = fields[key];
      const rawValue = field.value.trim();
      const isEntered = rawValue !== "";

      field.classList.toggle("is-entered", isEntered);
      field.setAttribute("aria-invalid", "false");

      if (!isEntered) {
        missing.push(key);
        return;
      }

      const numericValue = Number(rawValue);

      if (!Number.isFinite(numericValue)) {
        errors.push(`${key} MUST BE A FINITE NUMBER.`);
        field.setAttribute("aria-invalid", "true");
        return;
      }

      values[key] = numericValue;
    });

    return { values, missing, errors };
  }

  function updateCalculator() {
    const parsed = parseInputs();

    if (parsed.errors.length > 0) {
      lastSolution = null;
      clearRenderedSolution();
      renderMessage(parsed.errors.join(" "), true);
      return;
    }

    if (parsed.missing.length > 0) {
      lastSolution = null;
      clearRenderedSolution();
      renderMessage("ENTER ORIGINAL X, ORIGINAL Z, AND B ROTATION.", false);
      return;
    }

    lastSolution = rotatePoint(parsed.values.X, parsed.values.Z, parsed.values.B);

    const calculatedValues = [
      lastSolution.radians,
      lastSolution.cosine,
      lastSolution.sine,
      lastSolution.newX,
      lastSolution.newZ,
      lastSolution.radius,
    ];

    if (!calculatedValues.every(Number.isFinite)) {
      lastSolution = null;
      clearRenderedSolution();
      renderMessage("VALUES ARE TOO LARGE TO CALCULATE.", true);
      return;
    }

    renderSolution(lastSolution);
  }

  function renderSolution(solution) {
    resultPanel.hidden = false;
    newXOutput.textContent = formatNumber(solution.newX);
    newZOutput.textContent = formatNumber(solution.newZ);
    radiusOutput.textContent = formatNumber(solution.radius);
    renderMessage(`${formatAngle(solution.degrees)} COORDINATES UPDATED.`, false);
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
      appendWorkItem("ENTER ALL 3 VALUES TO SEE THE CALCULATION STEPS.");
      return;
    }

    appendWorkItem(
      `NEW X = X cos(B) - Z sin(B) = ${formatNumber(solution.originalX)} cos(${formatNumber(
        solution.degrees
      )}\u00b0) - ${formatNumber(solution.originalZ)} sin(${formatNumber(solution.degrees)}\u00b0) = ${formatNumber(
        solution.newX
      )}`
    );
    appendWorkItem(
      `NEW Z = X sin(B) + Z cos(B) = ${formatNumber(solution.originalX)} sin(${formatNumber(
        solution.degrees
      )}\u00b0) + ${formatNumber(solution.originalZ)} cos(${formatNumber(solution.degrees)}\u00b0) = ${formatNumber(
        solution.newZ
      )}`
    );
    appendWorkItem(
      `RADIUS = sqrt(X^2 + Z^2) = sqrt(${formatNumber(solution.originalX)}^2 + ${formatNumber(
        solution.originalZ
      )}^2) = ${formatNumber(solution.radius)}`
    );
  }

  function appendWorkItem(text) {
    const item = document.createElement("li");
    item.textContent = text;
    workList.append(item);
  }

  function clearRenderedSolution() {
    resultPanel.hidden = true;
    newXOutput.textContent = "";
    newZOutput.textContent = "";
    radiusOutput.textContent = "";
    renderWork(null);
    drawDiagram(null);
  }

  function clearAll() {
    inputKeys.forEach((key) => {
      fields[key].value = "";
      fields[key].classList.remove("is-entered");
      fields[key].setAttribute("aria-invalid", "false");
    });

    lastSolution = null;
    clearRenderedSolution();
    renderMessage("ENTER ORIGINAL X, ORIGINAL Z, AND B ROTATION.", false);
    fields.X.focus();
  }

  function drawDiagram(solution) {
    if (!solution) {
      hidePlottedElements();
      svgParts.description.textContent =
        "Enter original X and Z coordinates and a B rotation to plot the point.";
      return;
    }

    const hasRadius = solution.radius > tolerance;
    const scale = hasRadius ? diagramRadius / solution.radius : 0;
    const originalPoint = {
      x: diagramCenter.x + solution.originalX * scale,
      y: diagramCenter.y + solution.originalZ * scale,
    };
    const newPoint = {
      x: diagramCenter.x + solution.newX * scale,
      y: diagramCenter.y + solution.newZ * scale,
    };
    const pointsOverlap = Math.hypot(newPoint.x - originalPoint.x, newPoint.y - originalPoint.y) < 34;
    const originalLabel = getPointLabelPosition(originalPoint, pointsOverlap ? -1 : 0, hasRadius, "original");
    const newLabel = getPointLabelPosition(newPoint, pointsOverlap ? 1 : 0, hasRadius, "new");

    setElementHidden(svgParts.orbit, !hasRadius);
    svgParts.orbit.setAttribute("r", hasRadius ? diagramRadius : 0);
    setLine(svgParts.originalRadius, diagramCenter, originalPoint);
    setLine(svgParts.newRadius, diagramCenter, newPoint);
    setElementHidden(svgParts.originalRadius, !hasRadius);
    setElementHidden(svgParts.newRadius, !hasRadius);
    setCircle(svgParts.originalPoint, originalPoint, 9);
    setCircle(svgParts.newPoint, newPoint, 5.5);
    setText(svgParts.originalLabel, "ORIGINAL", originalLabel.x, originalLabel.y);
    setText(svgParts.newLabel, "ROTATED", newLabel.x, newLabel.y);
    drawAngleArc(solution, hasRadius);

    const direction =
      solution.degrees > tolerance
        ? "clockwise"
        : solution.degrees < -tolerance
          ? "counter-clockwise"
          : "with no rotation";
    svgParts.description.textContent = `Original point X ${formatNumber(solution.originalX)} Z ${formatNumber(
      solution.originalZ
    )} moves ${direction} by ${formatNumber(Math.abs(solution.degrees))} degrees to X ${formatNumber(
      solution.newX
    )} Z ${formatNumber(solution.newZ)}. Radius ${formatNumber(solution.radius)}.`;
  }

  function hidePlottedElements() {
    [
      svgParts.orbit,
      svgParts.originalRadius,
      svgParts.newRadius,
      svgParts.angleArc,
      svgParts.originalPoint,
      svgParts.newPoint,
    ].forEach((element) => setElementHidden(element, true));

    svgParts.angleArc.setAttribute("d", "");
    svgParts.angleLabel.textContent = "";
    svgParts.originalLabel.textContent = "";
    svgParts.newLabel.textContent = "";
  }

  function drawAngleArc(solution, hasRadius) {
    const hasRotation = Math.abs(solution.degrees) > tolerance;

    svgParts.angleLabel.textContent = formatAngle(solution.degrees);

    if (!hasRadius || !hasRotation) {
      setElementHidden(svgParts.angleArc, true);
      setText(svgParts.angleLabel, formatAngle(solution.degrees), diagramCenter.x + 50, diagramCenter.y - 25);
      return;
    }

    let visibleDegrees = solution.degrees % 360;

    if (Math.abs(visibleDegrees) < tolerance) {
      visibleDegrees = Math.sign(solution.degrees) * 359.999;
    }

    const startAngle = Math.atan2(solution.originalZ, solution.originalX);
    const visibleRadians = toRadians(visibleDegrees);
    const arcRadius = 70;
    const start = pointOnArc(startAngle, arcRadius);
    const end = pointOnArc(startAngle + visibleRadians, arcRadius);
    const sweepFlag = visibleDegrees > 0 ? 1 : 0;
    const largeArcFlag = Math.abs(visibleDegrees) > 180 ? 1 : 0;

    if (Math.abs(visibleDegrees) > 359) {
      const middle = pointOnArc(startAngle + visibleRadians / 2, arcRadius);
      svgParts.angleArc.setAttribute(
        "d",
        `M${start.x} ${start.y} A${arcRadius} ${arcRadius} 0 0 ${sweepFlag} ${middle.x} ${middle.y} A${arcRadius} ${arcRadius} 0 0 ${sweepFlag} ${end.x} ${end.y}`
      );
    } else {
      svgParts.angleArc.setAttribute(
        "d",
        `M${start.x} ${start.y} A${arcRadius} ${arcRadius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`
      );
    }

    const labelAngle = startAngle + visibleRadians / 2;
    const labelPoint = pointOnArc(labelAngle, arcRadius + 28);

    setText(svgParts.angleLabel, formatAngle(solution.degrees), labelPoint.x, labelPoint.y);
    setElementHidden(svgParts.angleArc, false);
  }

  function pointOnArc(angle, radius) {
    return {
      x: diagramCenter.x + Math.cos(angle) * radius,
      y: diagramCenter.y + Math.sin(angle) * radius,
    };
  }

  function getPointLabelPosition(point, sideOffset, hasRadius, key) {
    if (!hasRadius) {
      return key === "original"
        ? { x: diagramCenter.x - 64, y: diagramCenter.y - 30 }
        : { x: diagramCenter.x + 62, y: diagramCenter.y + 38 };
    }

    const dx = point.x - diagramCenter.x;
    const dy = point.y - diagramCenter.y;
    const length = Math.hypot(dx, dy) || 1;
    const radialX = dx / length;
    const radialY = dy / length;
    const normalX = -radialY;
    const normalY = radialX;

    return {
      x: clamp(point.x + radialX * 24 + normalX * sideOffset * 18, 62, 578),
      y: clamp(point.y + radialY * 24 + normalY * sideOffset * 18, 38, 408),
    };
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function setElementHidden(element, hidden) {
    element.style.display = hidden ? "none" : "";
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
    setElementHidden(circle, false);
  }

  function setText(text, value, x, y) {
    text.textContent = value;
    text.setAttribute("x", x);
    text.setAttribute("y", y);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    updateCalculator();
  });

  inputKeys.forEach((key) => {
    fields[key].addEventListener("input", updateCalculator);
  });

  precisionSelect.addEventListener("change", () => {
    if (lastSolution) {
      renderSolution(lastSolution);
    }
  });

  clearButton.addEventListener("click", clearAll);

  hidePlottedElements();
})();
