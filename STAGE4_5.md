# Stages 4 and 5 implementation

Run the existing project with `bash run_app.sh` in Git Bash, open the Local address Vite prints
(usually http://127.0.0.1:5173/), and stop with Ctrl+C. If the app is already running, refresh it.

## Stage 4

The two experiment sections retain the existing app design and use separate aligned histograms.
Experiment A compares three methods at n = 100. Experiment B uses simple random sampling at
n = 1, 10 and 100. Each has a seed and a 100 or 1,000 repetition control, separate from n.
No experiment runs on page load. Run buttons replace the current results without saving history.
Matching current SRS n = 100 results are reused between A and B without pooling estimates.

Each result labels its population, method settings, n, repetition or exact-start count, and type.
Monte Carlo results show a seed; whole-number systematic sampling enumerates every possible
start once and uses no seed. Every condition has its own true mean, bias, SD and RMSE in bpm.
Within each experiment, histogram bin boundaries and axes match across conditions.

## Stage 5

The approved condition is a checkbox that relabels every recorded minute as exercise on an
independent in-memory copy. Heart-rate values, membership and chronological order are retained.
Return to baseline restores the original labels in the preview and clears challenge results.
Neither action writes to the CSV or runs repeated sampling.

Run challenge produces stratified and simple random results for baseline and modified populations,
using the same total n, seed and repetition count. Baseline activity groups require n >= 3; this
constraint is shown explicitly. Each method's summary compares baseline and modified side by side.
Four aligned histograms retain separate condition labels, allocation settings and population means.
Editing n, seed or repetitions marks displayed results as awaiting a rerun; changing the condition
clears challenge results. No earlier results are retained.

## Verification

`npm test` runs 25 checks, including repeated-draw uniqueness, seeded reproducibility, estimate
counts, exact enumeration, synthetic known-answer arithmetic, RMSE squared decomposition,
matched result reuse, independent modified rows, baseline restoration, recalculation against each
population's own rows, invariance under reordering, modified-N systematic design checks, equal n
across all four results, and byte-level CSV preservation. `npm run build` passed.

Browser checks confirmed initial unrun states, enabling the modified preview and challenge button,
and restoring baseline without running any heart-rate investigation. Repeated-sampling checks use
synthetic populations. No investigation results or interpretations are supplied. The student runs
the experiments, checks their displayed evidence, and writes their own notes in DECISIONS.md.
