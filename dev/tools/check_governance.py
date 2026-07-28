#!/usr/bin/env python3
# Local governance checker for Pantry Depths.
#
# Foundation shape (layer selection, required operation contracts) is verified by
# dev/foundation/tools/verify_consumer.py. This checker protects THIS project's own
# discovery wiring: each listed file must exist and contain its declared pointer
# strings, so a rename that breaks a pointer fails loudly instead of rotting silently.
#
# The CONTRACTS map below is a starter covering the universal startup chain. Extend it
# with this project's addenda, skill cards, and any local contract that has a real
# silent-loss risk; keep the human-readable rule in its canonical document and treat
# this list as protection, not the source of truth.

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
errors: list[str] = []

# relativePath -> load-bearing pointer strings the file must contain.
CONTRACTS: dict[str, list[str]] = {
    "AGENTS.md": ["foundation_startup.md", "platform_startup.md", "dev/agent_rules/agent_startup.md"],
    "CLAUDE.md": ["foundation_startup.md", "platform_startup.md", "dev/agent_rules/agent_startup.md"],
    "dev/README.md": ["foundation_startup.md", "work_lifecycle.md", "dev/agent_rules/git_operations.md"],
    "dev/agent_rules/agent_startup.md": [
        "git_operations.md",
        "test_operations.md",
        "implement_operations.md",
        "frozen_reference_directories.md",
    ],
    "dev/agent_rules/implement_operations.md": [
        "commands/implement.md",
        "Explicit Second-Confirmation Bypass",
        "Phase 1 target confirmation remains mandatory",
    ],
    "dev/agent_rules/git_operations.md": ["dev/foundation/core/agent_rules/git_operations.md"],
    "dev/agent_rules/test_operations.md": ["# Test Operations"],
    "dev/standards/frozen_reference_directories.md": [
        "# Frozen Reference Directories",
        "dev/docs/design/",
        "dev/docs/reports/",
    ],
}

# The freeze rule's real failure mode is a durable document quietly regaining a pointer into a
# frozen directory, which no other check would notice. These files are allowed to name them: the
# standard that owns the rule, and the navigation surfaces that say the directories exist.
FROZEN_REFERENCE_ALLOWLIST = frozenset(
    {
        "dev/standards/frozen_reference_directories.md",
        "dev/docs/README.md",
        "dev/README.md",
        "dev/agent_rules/agent_startup.md",
        "dev/agent_rules/test_operations.md",
        "README.md",
        "CHANGELOG.md",
    }
)

FROZEN_REFERENCE_PATHS = ("dev/docs/design/", "dev/docs/reports/")

# Plans are the one legitimate consumer: each records the document it was derived from.
FROZEN_REFERENCE_SCAN_DIRS = ("dev/agent_rules", "dev/standards", "dev/tools")


def read(relative_path: str) -> str | None:
    target = ROOT / relative_path
    if not target.is_file():
        errors.append(f"missing required governance file: {relative_path}")
        return None
    return target.read_text(encoding="utf-8")


for relative_path, fragments in CONTRACTS.items():
    contents = read(relative_path)
    if contents is None:
        continue
    for fragment in fragments:
        if fragment not in contents:
            errors.append(f"{relative_path}: missing load-bearing pointer {fragment!r}")

for scan_dir in FROZEN_REFERENCE_SCAN_DIRS:
    for candidate in sorted((ROOT / scan_dir).rglob("*.md")):
        relative = candidate.relative_to(ROOT).as_posix()
        if relative in FROZEN_REFERENCE_ALLOWLIST:
            continue
        contents = candidate.read_text(encoding="utf-8")
        for frozen_path in FROZEN_REFERENCE_PATHS:
            if frozen_path in contents:
                errors.append(
                    f"{relative}: references the frozen {frozen_path} tree; see dev/standards/frozen_reference_directories.md"
                )

if not (ROOT / "dev/foundation/consumer_manifest.json").is_file():
    errors.append("dev/foundation is missing or uninitialized; run git submodule update --init --recursive")

try:
    config = json.loads((ROOT / "dev/foundation.config.json").read_text(encoding="utf-8"))
    if config.get("schema_version") != 2:
        errors.append("dev/foundation.config.json: schema_version must be 2")
    if config.get("platform") != "web-react":
        errors.append("dev/foundation.config.json: platform must be web-react")
except (OSError, json.JSONDecodeError) as error:
    errors.append(f"dev/foundation.config.json: invalid JSON ({error})")

if errors:
    for error in errors:
        print(f"governance: ERROR: {error}")
    raise SystemExit(1)

print("governance: OK (Pantry Depths local contracts)")
