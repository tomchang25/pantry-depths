# Code Style Addendum

This file is the project-local delta to `dev/foundation/platforms/web-react/standards/code_style_standard.md`. Read that document first; it owns control flow, logical spacing, and the general `if`/`else` conventions. Only the narrowing below is project-specific.

## A Branch Chain Over A Closed Enumeration Ends In An Exception

When a chain of `if`, `else if`, or `switch` branches dispatches over a **closed enumeration** — a discriminated union, a string-literal union, or an enum — the final position must be an exception branch that the compiler proves unreachable. It must never be an unguarded fallthrough that produces one of the enumerated results.

Concretely: every enumerated member gets its own guarded branch, and the chain ends with `assertNever(value)` or `value satisfies never`.

```ts
// Correct: every member is named, and the tail proves the chain is complete.
if (entity.kind === "hotSpring") {
  return assembleHotSpring(entity);
}

if (entity.kind === "exit") {
  return assembleExit(entity);
}

return assertNever(entity);
```

```ts
// Wrong: the last member rides the fallthrough.
if (entity.kind === "hotSpring") {
  return assembleHotSpring(entity);
}

return assembleExit(entity);
```

**Why:** the wrong shape is silent at exactly the moment it matters. Adding an eighth entity kind to the union does not fail to compile — the new kind falls through and is assembled as an exit, and the defect surfaces later as wrong behavior rather than as a type error. The correct shape converts every future addition into a compile error at every site that must handle it, which is the only mechanism this project has for that guarantee.

**How to apply:** this rule is enforced by TypeScript, not by the linter. `oxlint` is configured without type information, so no lint rule can see an unhandled union member; the compiler only rejects the omission when the never-check is present in the source. Writing it is therefore not optional decoration — it is the enforcement.

Scope note: this governs dispatch over a **closed** enumeration. A chain of unrelated boolean conditions, a guard sequence with a genuine default result, or a lookup over an open-ended string keyspace is not an enumeration and keeps an ordinary fallthrough.

An exception branch that is genuinely reachable — an unknown value arriving from untrusted input, for example — is a validation concern and belongs in the parser that closes the enumeration, not in the dispatch that consumes it.
