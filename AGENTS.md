# AGENTS.md

## Project

This is a static GitHub Pages site for machinist-focused trig and geometry calculators.

## Goals

- Build a fast, simple, static website using HTML, CSS, and JavaScript.
- No backend server.
- No database.
- No paid services.
- No analytics or tracking unless explicitly requested.
- The site should work locally by opening `index.html` or by using a simple local dev server.
- The site should be deployable to GitHub Pages.

## Style

- Keep the interface practical and shop-friendly.
- Prioritize correctness, clear labels, and readable results over fancy visuals.
- Use plain language familiar to machinists.
- Units should be unlabeled so calculators can be used for inch or metric with no conversions.
- Each calculator should have a selector for how many places after the decimal to round to.
- Avoid unnecessary frameworks unless asked.

## Calculators to eventually include

- Generic Triangle solver
- Lathe chamfer solver
- Horizontal mill B axis rotation coordinate solver

## Rules for Codex

- Make small, reviewable changes.
- Explain what changed after each task.
- Do not rewrite the whole project unless asked.
- Do not add dependencies without asking.
- Do not use external APIs.
- Do not put secrets, API keys, or credentials in the project.
- When adding a calculator, use test values to confirm expected results before deployment.