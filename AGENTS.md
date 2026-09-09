# AGENTS.md

## Repository bootstrap

Read the repository `README` and relevant project documentation before changing files. The current user request, approved Issue, or task contract defines the allowed scope. Accepted repository state remains the implementation authority.

## Codex-native workspace baseline

- Default implementation workspace is a Codex-managed isolated worktree when Codex provides one.
- A per-task fresh clone is not required. Fresh clone is a provisioning, recovery, or explicit task-specific operation.
- Before mutation, prove the expected repository/origin, task scope, expected base when supplied, and that the current directory belongs to the assigned worktree.
- Detached HEAD is valid for inspection, editing, testing, and review.
- Before the first commit, create or switch to the approved dedicated task branch. Default prefix is `agent/` unless repository/task policy specifies another prefix.
- Never implement directly in the default branch, primary/user/canonical checkout, a control repository, another task workspace, or an ambiguous clone.
- Codex performs ordinary local Git mechanics itself: branch creation, staging, commits, and related local Git operations.
- Remote push and PR creation use native Codex/Git facilities only when the repository, task contract, or owner grants publication authority.
- If the Codex sandbox blocks an exact Git metadata mutation, use native approval/escalation for that exact operation. Do not widen ACLs, use `takeown`, run Codex elevated, make `.git` broadly writable, or fall back to AgentLoop Owner Toolkit merely to bypass the sandbox.
- Do not use stash, reset, clean, force push, or history rewrite to conceal unexpected workspace state.
- Never push directly to the default branch.
- PRs are Ready for Review by default unless the task explicitly calls for Draft.
- Merge authority is separate from implementation/publication authority. Merge only when repository policy, task contract, or the owner explicitly grants it.
- If repository/worktree/base/task identity cannot be proven, stop fail-closed and report the ambiguity.

## General safety

- Keep changes inside the approved scope.
- Run relevant repository checks and `git diff --check` before publication when available.
- Do not commit secrets, tokens, private keys, credential-store material, or unrelated machine-specific data.
- Do not perform destructive host or repository operations unless the current task explicitly authorizes them.
