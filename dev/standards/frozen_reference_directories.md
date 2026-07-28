# Frozen Reference Directories

`dev/docs/design/` and `dev/docs/reports/` are frozen. Do not read, cite, or edit anything in either directory unless an instruction names the specific document.

## What This Covers

| Directory           | What it holds                                                              |
| ------------------- | -------------------------------------------------------------------------- |
| `dev/docs/design/`  | Direction documents the project was originally derived from                |
| `dev/docs/reports/` | Generated and hand-written snapshots of how the project looked at a moment |

Both are historical records. Both are expected to contradict the codebase, and neither may be used as evidence about how the project currently works or should work.

## Why

These documents describe intentions and measurements from the moment they were written. The project has moved since, and it will keep moving. A frozen document that stays readable becomes an authority nobody agreed to: work gets justified by what the old text says instead of by what the code does, and the contradiction gets "repaired" in the wrong direction — by changing working code to match a stale document.

Adding a new document to either directory is allowed. Editing an existing one to agree with the present is not; that erases the record without adding anything.

## Where The Answers Actually Live

| Question                                | Authority                                            |
| --------------------------------------- | ---------------------------------------------------- |
| What are the rules, numbers, behaviour? | The code under `src/`                                |
| What is being built next?               | `dev/docs/plans/` and `TODO.md`                      |
| What was deliberately ruled out?        | The plan that decided it, or `TODO.md` under `Draft` |

## The One Exception

An instruction that names a specific document — "read `dev/docs/design/<file>`", "update the balance report" — authorizes exactly that document for exactly that task. It is not a standing permission and does not extend to the rest of the directory.
