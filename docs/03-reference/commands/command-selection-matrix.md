# Command Selection Matrix

Use this table to choose the right command based on your current situation.

## Situation → Command Mapping

| Current Situation | Command | Reason |
| :--- | :--- | :--- |
| You have a rough or vague idea | `/dk-idea` | Runs discovery, requirements interview, scope definition |
| You have a defined feature but no specification | `/dk-spec` | Creates minimal specification artifacts and acceptance criteria |
| You have an approved specification but no design | `/dk-design` | Produces data models, API contracts, user flows |
| You have an approved design but no task plan | `/dk-tasks` | Decomposes work into risk-ordered, verifiable tasks |
| You have approved tasks, implementing one at a time | `/dk-build` | Implements next task through full gate cycle |
| You have approved tasks, want automatic progression | `/dk-build-auto` | Processes all tasks sequentially, pausing on failures |
| Implementation is done, need to verify | `/dk-test` | Runs verification suite with unit, integration, edge-case tests |
| Tests pass, need code review | `/dk-review` | Runs spec compliance → code quality → specialist reviews |
| Review passed, want to remove bloat | `/dk-simplify` | Applies Ponytail ladder to eliminate unnecessary code |
| Something is broken and you need to debug | `/dk-debug` | Systematic reproduce → localise → fix → protect cycle |
| Ready to merge or ship | `/dk-ship` | Final gate: full suite, task completion gate, release readiness |
| Not sure where you are in the workflow | `/dk-status` | Reports lifecycle stage, current task, completed tasks, blockers |
