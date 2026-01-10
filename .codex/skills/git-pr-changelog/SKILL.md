---
name: git-pr-changelog
description: Create commits, push branches, open pull requests (gh or manual), and update changelogs with PR numbers. Use when a user asks for commit/push/PR creation or changelog updates tied to a PR.
---

# Git PR + Changelog Workflow

## Overview

Execute the standard flow: verify repo state, stage changes, commit, push, open a PR, and update `CHANGELOG.md` with the PR number.

## Workflow

### 1) Inspect repo state

- Confirm repo root: `git rev-parse --show-toplevel`
- Check status: `git status -sb`
- Note branch: `git rev-parse --abbrev-ref HEAD`
- Check remotes: `git remote -v`

If there are unrelated changes, keep them untouched and only stage the files requested by the user.

### 2) Stage changes

- Stage specific paths: `git add <path>...`
- If the user did not specify which files to include, ask before staging everything.

### 3) Commit

- Use a clear message: `git commit -m "<message>"`
- Do not amend or reword existing commits unless explicitly asked.

### 4) Push

- If upstream is missing, set it: `git push -u origin <branch>`
- Otherwise: `git push`

### 5) Create PR

Prefer GitHub CLI if available:

- Check: `command -v gh`
- Create: `gh pr create --fill`
- Capture PR number/URL: `gh pr view --json number,url`

If `gh` is unavailable, provide the compare URL:

- Get remote URL: `git remote get-url origin`
- Build: `https://github.com/<org>/<repo>/compare/<branch>?expand=1`

### 6) Update changelog

- Find `CHANGELOG.md` (usually repo root); search for `Unreleased` or the latest version section.
- Add a bullet under the correct section with the PR number, e.g. `- add clause loader concurrency (#1234)`.
- If the PR number is not known yet, update it after the PR is created.

### 7) Commit changelog

- Stage changelog only: `git add CHANGELOG.md`
- Commit as a follow-up: `git commit -m "Update changelog for <topic>"`
- Push: `git push`

## Output checklist

- Provide commit SHA(s) and the PR URL.
- Mention changelog location and the inserted entry.
