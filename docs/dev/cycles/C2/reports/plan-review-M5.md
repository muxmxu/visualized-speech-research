# M5 plan review

The disjoint implementation slices and combined real-browser integration cover the C2 analyzer scope and all four §19 exits.
Two wording corrections are required before dispatch.

- Bind the §12 `plugins_changed` broadcast to detected module mtime changes as well as additions and removals, including an edit that leaves all analyzer IDs and declared versions unchanged.
- For M5.1 set the UI parameter once and keep the lane, selection, channel and parameter values fixed for both runs, so the change from 1.25 to 2.25 establishes that the edited source was used and its cached result was invalidated.

Both corrections use the existing reload case and write sets.
No tests were run.
