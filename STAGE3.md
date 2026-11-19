# Stage 3 implementation

The app now contains three vertically aligned timelines for simple random, systematic and
stratified sampling. All use identical timestamp and heart-rate axes and the same total n.
The original population and notes are unchanged.

## Use the running app

Refresh `http://127.0.0.1:5173/` if Vite is already running. Otherwise, open Git Bash in the
project root and run `bash run_app.sh`. Open the Local address printed by Vite; stop with Ctrl+C.

Enter sample size and seed, then select Apply settings. Edits do not change the displayed samples
until applied. Every panel identifies its current settings. Applying identical settings reproduces
the same selections. No repetition experiment runs in this stage.

- Simple random sampling selects n distinct recorded rows without replacement and estimates
  the population mean with the sample mean.
- Systematic sampling follows the original chronological row order. The app displays N/n,
  its random start, its whole-number or fractional interval design, and the selection formula.
  The interval is in recorded rows, not elapsed minutes. Every n from 1 through N is supported.
- Stratified sampling groups by activity_state. Proportional allocation uses largest-remainder
  rounding subject to at least one row per group and at most the available rows. Integer counts
  sum to n. Quota deficits determine remaining places; excess allocations are removed from the
  largest quota excess when lower bounds require it. Ties use alphabetical group order.
  Within each group, selection is simple random without replacement. The estimator weights
  each group sample mean by its population share, N_h/N.
- At n = 1 or 2, only the stratified panel is unavailable, with an explanation. Both other
  methods remain active. Choose n >= 3 for stratified sampling.

Expand each sampled-row list to inspect selections in chronological order. Recording gaps remain
visible as amber bands and breaks in the background trace, with an exact-time list below the panels.

## Verification

`npm test` runs fourteen automated checks: reproducibility and SRS invariants, synthetic known-answer
means, timestamp and gap parsing, all systematic sample sizes for small synthetic populations,
whole-number and fractional interval rules, equal fractional inclusion probabilities, constrained
allocation totals and bounds, weighted estimation, small-sample unavailability, summary arithmetic,
and distinct real-data sample rows at boundary sample sizes. No real-data investigation findings
are printed or interpreted. `npm run build` produces the static app in dist.

Browser checks confirmed rendering of the three timelines, the n = 2 message with other methods
available, and restoration of stratified sampling at n = 100. The student checks and interprets
their own app selections and records their own decisions and observations in DECISIONS.md.
