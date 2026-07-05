(() => {
  const pad = (value) => String(value).padStart(2, "0");
  const clock = document.querySelector("[data-clock]");

  if (clock) {
    const tick = () => {
      const now = new Date();
      clock.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    };

    tick();
    setInterval(tick, 1000);
  }

  document.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const active = document.activeElement;

    if (active && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(active.tagName)) {
      return;
    }

    const target = document.querySelector(`[data-hotkey="${event.key}"]`);

    if (target) {
      target.click();
    }
  });
})();
