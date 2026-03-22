<div align="center">

<img src="./assets/cover.jpg" alt="OpenClaw Tips cover" width="100%" />

<br />
<br />

# Awesome OpenClaw Tips

<strong>The practical playbook for turning OpenClaw from a fun chatbot into a reliable operating system for recurring work.</strong>

<br />

![Tips](https://img.shields.io/badge/tips-18-8b5cf6?style=flat-square)
![Status](https://img.shields.io/badge/status-tested%20and%20curated-16a34a?style=flat-square)

</div>

OpenClaw gets valuable when it stops acting like a chat window and starts acting like infrastructure.

Most setups break for predictable reasons: cost drift, context bloat, weak memory, unsafe defaults, too many agents, too much trust in chat history, and not enough visibility into what the system is actually doing.

This repo collects the best practical patterns, prompts, and guardrails for fixing those problems.

## Table of Contents

- [🧠 Memory](#memory)
  - [MEM-01: Make your agent learn from its mistakes](#mem-01-make-your-agent-learn-from-its-mistakes)
  - [MEM-02: Flush important state before compaction eats it](#mem-02-flush-important-state-before-compaction-eats-it)
  - [MEM-03: Use SQLite memory search before you pay for embeddings](#mem-03-use-sqlite-memory-search-before-you-pay-for-embeddings)
  - [MEM-04: Treat chat history as cache, not the source of truth](#mem-04-treat-chat-history-as-cache-not-the-source-of-truth)
  - [MEM-05: Split conversations into threads so context stops bleeding across topics](#mem-05-split-conversations-into-threads-so-context-stops-bleeding-across-topics)
  - [MEM-06: Make the workspace folder the source of truth and put it under git](#mem-06-make-the-workspace-folder-the-source-of-truth-and-put-it-under-git)
  - [MEM-07: Back up your workspace continuously, not just once](#mem-07-back-up-your-workspace-continuously-not-just-once)
  - [MEM-08: Periodically self-clean memory instead of letting it rot forever](#mem-08-periodically-self-clean-memory-instead-of-letting-it-rot-forever)
- [🛡️ Reliability](#reliability)
  - [REL-01: Don't put all your fallbacks on the same provider](#rel-01-dont-put-all-your-fallbacks-on-the-same-provider)
  - [REL-02: Your agent says "done" when it isn't](#rel-02-your-agent-says-done-when-it-isnt)
  - [REL-03: Use heartbeat to rotate recurring checks, not just repeat one generic check](#rel-03-use-heartbeat-to-rotate-recurring-checks-not-just-repeat-one-generic-check)
  - [REL-04: Turn on tool-loop detection before a bad run burns hours](#rel-04-turn-on-tool-loop-detection-before-a-bad-run-burns-hours)
- [💸 Cost](#cost)
  - [COST-01: Your heartbeat model is costing you more than you think](#cost-01-your-heartbeat-model-is-costing-you-more-than-you-think)
  - [COST-02: Use cache-ttl pruning or idle sessions will re-cache junk history](#cost-02-use-cache-ttl-pruning-or-idle-sessions-will-re-cache-junk-history)
  - [COST-03: Local models are often a false economy](#cost-03-local-models-are-often-a-false-economy)
  - [COST-04: Use local models only for repetitive mechanical work](#cost-04-use-local-models-only-for-repetitive-mechanical-work)
- [⚙️ Operations](#operations)
  - [OPS-01: Set explicit concurrency limits for agents and subagents](#ops-01-set-explicit-concurrency-limits-for-agents-and-subagents)
- [⏱️ Automation](#automation)
  - [AUTO-01: Standing orders define what, cron defines when](#auto-01-standing-orders-define-what-cron-defines-when)
- [🏗️ Architecture](#architecture)
  - [ARCH-01: Stop using one generic agent for everything](#arch-01-stop-using-one-generic-agent-for-everything)
  - [ARCH-02: Keep your orchestrator as a manager, not the doer](#arch-02-keep-your-orchestrator-as-a-manager-not-the-doer)
  - [ARCH-03: Give different models different prompt files](#arch-03-give-different-models-different-prompt-files)

<a id="memory"></a>

## 🧠 Memory

### MEM-01: Make your agent learn from its mistakes

By default, every session starts clean. Your agent has no memory of the last time it tried something and failed, or the last time you corrected it. Two weeks later, it is still repeating day-three mistakes.

The minimum fix is a `.learnings/` folder in your workspace with two files:

- `.learnings/ERRORS.md` - command failures, breakages, exceptions
- `.learnings/LEARNINGS.md` - corrections, knowledge gaps, workflow discoveries

Add this to `SOUL.md`:

```md
Before starting any task, check .learnings/ for relevant past errors.
When you fail at something or I correct you, log it to .learnings/ immediately.
```

Over time, repeated lessons can be promoted into `SOUL.md` itself so they apply automatically in future sessions.

<details>
<summary><strong>Copy prompt - implement this tip for me</strong></summary>

```md
Implement a self-improving learnings system in my OpenClaw workspace.

Do all of the following:

1. Create a `.learnings/` folder if it does not exist.
2. Create `.learnings/ERRORS.md` for failures, breakages, command errors, and exceptions.
3. Create `.learnings/LEARNINGS.md` for corrections, workflow discoveries, preferences, and things the agent should remember.
4. Update `SOUL.md` so it includes these rules:
   - Before starting any task, check `.learnings/` for relevant past errors.
   - When you fail at something or I correct you, log it to `.learnings/` immediately.
5. If there is already an existing memory or lessons system, merge carefully instead of duplicating it.
6. Add a short section explaining how future entries should be written so the files stay useful.

Then show me:
- what files you created or changed
- the exact rules you added
- one example `ERRORS.md` entry
- one example `LEARNINGS.md` entry
```

</details>

For a fuller version with automatic hooks, structured entries, and a promotion workflow, install the [self-improving-agent skill](https://clawhub.ai/pskoett/self-improving-agent).

### MEM-02: Flush important state before compaction eats it

Long OpenClaw sessions do not grow forever. Once context gets full, OpenClaw auto-compacts the session. That usually means a summary survives, plus recent turns. Anything important that only lives in chat is now at risk.

Treat compaction as a deadline. Important state should already be on disk before it happens.

Turn on the built-in pre-compaction memory flush:

```json
"agents": {
  "defaults": {
    "compaction": {
      "memoryFlush": {
        "enabled": true,
        "softThresholdTokens": 4000
      }
    }
  }
}
```

This watches context usage, triggers a silent flush before hard compaction, and writes durable state to the workspace. It runs once per compaction cycle and uses `NO_REPLY`, so it does not spam the user.

This pairs naturally with `MEM-01`. Chat is working memory. Files are memory.

<details>
<summary><strong>Copy prompt - implement this tip for me</strong></summary>

```md
Implement pre-compaction memory flushing in my OpenClaw setup so important state gets written to disk before context compaction happens.

Do all of the following:

1. Find my OpenClaw config and enable built-in pre-compaction memory flush.
2. Set this config:
   - `agents.defaults.compaction.memoryFlush.enabled = true`
   - `agents.defaults.compaction.memoryFlush.softThresholdTokens = 4000`
3. Check whether I already have a durable memory system such as `.learnings/`, `MEMORY.md`, or other workspace state files.
4. If I do, make sure the setup works with that existing system instead of creating a duplicate memory path.
5. If I do not, create a minimal durable place where important state should be flushed before compaction.
6. Add a short note in the relevant workspace instructions explaining that chat is not durable memory and important state must live in files.

Then show me:
- which config file you changed
- the exact config block you added or updated
- where important state will be flushed to
- any assumptions you made about my current memory setup
```

</details>

### MEM-03: Use SQLite memory search before you pay for embeddings

Most personal OpenClaw setups do not need a vector database just to find old notes. A local SQLite index with FTS5 is often enough.

This tip ships with supporting files in `tips/mem-03/`.

Build the database:

```bash
node tips/mem-03/rebuild-db.js
```

Search it:

```bash
node tips/mem-03/relevant-memory.js "query about previous work"
```

The scripts scan markdown files, build a SQLite database, and use full-text search to surface likely matches quickly. No API costs, no embedding pipeline, no external service.

<details>
<summary><strong>Copy prompt - implement this tip for me</strong></summary>

```md
Implement a lightweight SQLite memory search system in my OpenClaw workspace so I can search past notes without paying for embeddings.

Use these supporting files from this repo:
- `tips/mem-03/rebuild-db.js`
- `tips/mem-03/relevant-memory.js`

If needed, fetch them directly from:
- https://raw.githubusercontent.com/alvinunreal/awesome-openclaw-tips/main/tips/mem-03/rebuild-db.js
- https://raw.githubusercontent.com/alvinunreal/awesome-openclaw-tips/main/tips/mem-03/relevant-memory.js

Do all of the following:

1. Copy those files into my OpenClaw workspace in a sensible location.
2. Make sure the database output path and command examples match where you placed them.
3. Build the SQLite memory index.
4. Test one search query against my workspace.
5. Add a short note to my workspace instructions explaining when to use SQLite memory search before reading raw markdown files.
6. If I already have another memory system, integrate carefully instead of replacing it.

Then show me:
- where you placed the files
- the exact commands to rebuild and search
- one sample query and its result
- any assumptions you made about my current memory layout
```

</details>

### MEM-04: Treat chat history as cache, not the source of truth

If you want OpenClaw to remember things reliably, write them to the files OpenClaw already knows how to use. Transcript memory is fragile. Compaction, resets, and long idle gaps all make chat a bad place to keep anything important.

OpenClaw already has a real file pattern for this:

- `MEMORY.md` - durable facts, preferences, decisions
- `memory/YYYY-MM-DD.md` - daily notes and running context
- `AGENTS.md` - standing rules for how the agent should use those files

That is the practical version of "chat is cache". Important facts belong in `MEMORY.md`. Short-term working context belongs in daily memory files. `AGENTS.md` should tell the agent to read and update them instead of trusting the transcript to carry everything forward.

If task state matters too, put that in an actual task system or another durable store you already use. The rule is the same: if losing the transcript would break the workflow, the state is in the wrong place.

<details>
<summary><strong>Copy prompt - implement this tip for me</strong></summary>

```md
Set up durable memory files in my OpenClaw workspace so important context does not depend on chat history.

Do all of the following:

1. Create or update `MEMORY.md` for durable facts, preferences, and decisions.
2. Create or update `memory/YYYY-MM-DD.md` for short-term running context and daily notes.
3. Update `AGENTS.md` so the agent:
   - reads `MEMORY.md` when present
   - uses `memory/YYYY-MM-DD.md` for ongoing notes
   - writes important facts to files instead of relying on transcript memory
4. If these files already exist, merge carefully instead of duplicating them.
5. If task state belongs in another durable system I already use, keep it there and document that clearly instead of inventing a second task system.
6. Keep the setup aligned with normal OpenClaw workspace conventions.

Then show me:
- what files you created or changed
- the exact rules you added to `AGENTS.md`
- what belongs in `MEMORY.md` vs `memory/YYYY-MM-DD.md`
- any assumptions you made
```

</details>

### MEM-05: Split conversations into threads so context stops bleeding across topics

One long OpenClaw conversation turns into a junk drawer. Coding, research, admin, and random questions all get mixed together, and every new turn drags that baggage forward.

OpenClaw already has session boundaries you can use. Group chats isolate state by group. Telegram forum topics get their own `:topic:<threadId>` session keys. Slack and Discord threads are treated as thread sessions. Discord channels also get their own isolated sessions.

That means the practical fix is simple: split work by topic or channel. Keep one thread for coding, another for research, another for admin, another for personal operations. Focused threads give the agent focused context instead of one huge mixed transcript.

This is one of the easiest memory fixes because it does not require a new memory system. It just uses OpenClaw's existing session isolation properly.

For Telegram specifically, BotFather has a setting for this now. Open BotFather, choose your bot from **My bots**, go to **Bot Settings**, and turn on **Threaded Mode**.

<p align="center">
  <img src="./tips/mem-05/telegram-1.png" alt="Open BotFather and choose your bot from My bots" width="30%" />
  <img src="./tips/mem-05/telegram-2.png" alt="Enable Threaded Mode in Bot Settings" width="30%" />
  <img src="./tips/mem-05/telegram-3.png" alt="Telegram chat using separate topic tabs" width="34%" />
</p>

Once it is enabled, Telegram gives the bot separate tabs/topics in the chat UI. That is exactly what this tip needs - coding in one topic, research in another, admin in another - instead of one mixed transcript where everything contaminates everything else.

### MEM-06: Make the workspace folder the source of truth and put it under git

`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `MEMORY.md`, and `memory/` are not loose notes. They are operating state.

OpenClaw's own docs recommend treating the workspace as private memory and putting it in a private git repo. That gives you backup, diff, and a clean way to see when a prompt, memory file, or operating rule changed.

The practical setup is simple:

```bash
git init
git add AGENTS.md SOUL.md TOOLS.md IDENTITY.md USER.md HEARTBEAT.md MEMORY.md memory/
git commit -m "Add agent workspace"
```

If you use GitHub or GitLab, make the repo private and push it there. If git is installed, brand-new OpenClaw workspaces can even auto-initialize, which tells you this is not a weird custom pattern - it is a normal way to treat the workspace.

This pairs naturally with `MEM-04`. If the workspace is the source of truth, git is how you keep that source of truth recoverable.

<details>
<summary><strong>Copy prompt - implement this tip for me</strong></summary>

```md
Set up my OpenClaw workspace as a private git-backed source of truth.

Do all of the following:

1. Check whether my OpenClaw workspace is already a git repo.
2. If it is not, initialize git in the workspace.
3. Add the main OpenClaw workspace files when present, including:
   - `AGENTS.md`
   - `SOUL.md`
   - `TOOLS.md`
   - `IDENTITY.md`
   - `USER.md`
   - `HEARTBEAT.md`
   - `MEMORY.md`
   - `memory/`
4. Create an initial commit if one does not already exist.
5. If a `.gitignore` is needed for local noise, add a minimal one.
6. If a remote is already configured, show it.
7. If no remote exists and GitHub CLI (`gh`) is installed and authenticated, create a new private GitHub repo automatically, prefer a name like `openclaw-workspace-<bot-name>`, add `origin`, and push.
8. If `gh` is not available or not authenticated, do not fail vaguely - tell me the exact manual commands to create a private repo with a sensible name like `openclaw-workspace-<bot-name>`, add `origin`, and push.

Then show me:
- whether the workspace was already under git
- what files were added to version control
- the exact commit you created, if any
- whether you created and pushed a private remote automatically
- if not, the exact commands I should run next
```

</details>

### MEM-07: Back up your workspace continuously, not just once

`git init` is not the backup. The backup only becomes real once you keep pushing updates.

OpenClaw's workspace docs already show the ongoing loop:

```bash
git status
git add .
git commit -m "Update memory"
git push
```

That is the habit to build. Prompts change. `MEMORY.md` changes. `memory/` changes. If the private repo only got the first commit and never gets the later updates, it is not really your source of truth backup.

The practical version is simple: put the backup policy in `AGENTS.md`, then run it from a dedicated cron. `AGENTS.md` should define what counts as a meaningful change. The cron should do the actual check and sync. This does not belong in `HEARTBEAT.md` - heartbeat is for health checks, not workspace maintenance.

Commit and push on meaningful workspace changes, not every tiny edit. Good triggers are prompt updates, new durable memories, workflow changes, or anything in the workspace that you would hate to lose.

For example:

```bash
openclaw cron create \
  --name workspace-backup-check \
  --cron "0 21 * * *" \
  --message "Check the workspace git repo. If meaningful workspace files changed, commit and push them. Skip trivial noise. Never commit secrets or anything under ~/.openclaw/. Report what happened."
```

<p align="center">
  <img src="./tips/mem-07/workspace-backup-check.png" alt="OpenClaw cron job configured for workspace backup checks" width="100%" />
</p>

<details>
<summary><strong>Copy prompt - implement this tip for me</strong></summary>

```md
Set up a practical ongoing backup workflow for my OpenClaw workspace repo so updates keep getting pushed after the initial setup.

Do all of the following:

1. Check whether my OpenClaw workspace already has a git remote configured.
2. Show me the exact files or folders in the workspace that should be treated as backup-worthy operating state.
3. Add a short rule to `AGENTS.md` explaining that workspace changes should be committed and pushed on meaningful changes, not every tiny edit.
4. Set this up as a dedicated cron or scheduled backup check, not as a heartbeat task.
5. If there is already a good place for a scheduled backup rule, reuse it instead of inventing a second system.
6. Include the standard ongoing sync commands:
   - `git status`
   - `git add .`
   - `git commit -m "Update memory"`
   - `git push`
7. Add a short warning not to commit secrets, tokens, passwords, or anything under `~/.openclaw/`.
8. If you see a simple safe way to automate reminders without blindly auto-pushing, suggest it.

Then show me:
- whether a remote is already configured
- what counts as backup-worthy workspace state
- the exact `AGENTS.md` rule you added
- how the dedicated cron or scheduled check should run
- the exact ongoing sync commands
- the secret-safety warning you added
```

</details>

### MEM-08: Periodically self-clean memory instead of letting it rot forever

Memory quality depends on what gets removed as much as what gets added.

Over time, `MEMORY.md` collects duplicates, stale facts, old preferences, and contradictions. OpenClaw's own template guidance already suggests a maintenance pass every few days: read recent `memory/YYYY-MM-DD.md` files, keep the significant lessons, update `MEMORY.md`, and remove outdated information that is no longer true.

That is the right mental model. Daily memory files are raw notes. `MEMORY.md` is curated wisdom. If everything stays forever, retrieval gets noisier and the model starts pulling stale context back into live work.

The fix is simple: review memory periodically, merge duplicates, resolve contradictions, remove outdated facts, and keep `MEMORY.md` focused on what is still worth knowing.

For example, this is the maintenance loop the docs recommend:

```md
1. Read through recent `memory/YYYY-MM-DD.md` files
2. Identify significant events, lessons, or insights worth keeping long-term
3. Update `MEMORY.md` with distilled learnings
4. Remove outdated info from `MEMORY.md` that's no longer relevant
```

For this one, heartbeat is usually the best fit. OpenClaw's own template puts memory maintenance under heartbeats, which makes sense: it is periodic background awareness, not a precise standalone job.

That can be as simple as adding a maintenance rule like this to `HEARTBEAT.md`:

```md
Every few days:
- Read recent `memory/YYYY-MM-DD.md` files
- Promote durable lessons to `MEMORY.md`
- Remove outdated entries from `MEMORY.md`
- Reply `NO_REPLY` if nothing needs updating
```

<p align="center">
  <img src="./tips/mem-08/heartbeat-memory-maintenance.png" alt="HEARTBEAT.md with a memory maintenance section added" width="100%" />
</p>

If you want exact timing or a fully isolated cleanup run, a cron job is still fine. But heartbeat is the more natural default for this tip.

Good memory is not just persistent. It is maintained.

<details>
<summary><strong>Copy prompt - implement this tip for me</strong></summary>

```md
Set up a practical memory-maintenance workflow for my OpenClaw workspace so `MEMORY.md` stays useful instead of slowly filling with stale facts.

Do all of the following:

1. Review my recent `memory/YYYY-MM-DD.md` files and my current `MEMORY.md`.
2. Identify duplicates, stale facts, contradictions, outdated preferences, and notes that should be promoted from daily memory into long-term memory.
3. Update `MEMORY.md` so it keeps the durable facts, decisions, preferences, and lessons that still matter.
4. Remove or rewrite outdated entries in `MEMORY.md` instead of letting conflicting versions pile up.
5. Add a short memory-maintenance rule to `HEARTBEAT.md` so this gets reviewed periodically in the normal heartbeat flow.
6. If heartbeat is not the right fit for my setup, explain why and suggest a dedicated cron instead.
7. Keep the process aligned with normal OpenClaw memory conventions: daily files are raw notes, `MEMORY.md` is curated memory.

Then show me:
- what you reviewed
- what you added to `MEMORY.md`
- what you removed or rewrote
- any contradictions or stale entries you found
- the exact `HEARTBEAT.md` rule you added
- whether you used heartbeat or recommended cron instead
```

</details>

<a id="reliability"></a>

## 🛡️ Reliability

### REL-01: Don't put all your fallbacks on the same provider

When one provider rate-limits or goes down, every model behind that provider can fail together. If your entire fallback chain lives inside one vendor, that is not redundancy.

Bad:

```json
"primary": "openai/gpt-5",
"fallbacks": [
  "openai/gpt-5-mini",
  "openai/gpt-5-nano"
]
```

Better:

```json
"primary": "openai/gpt-5",
"fallbacks": [
  "kimi-coding/k2p5",
  "synthetic/hf:zai-org/GLM-4.7",
  "openrouter/google/gemini-3-flash-preview"
]
```

The point is not those exact providers. The point is failure independence. A limit or outage in one stack should not take your whole agent down with it.

The default shared path is `agents.defaults.model.fallbacks`. If one agent needs its own fallback chain, OpenClaw also supports a per-agent override in `agents.list[].model = { primary, fallbacks }`.

<details>
<summary><strong>Copy prompt - implement this tip for me</strong></summary>

```md
Review my OpenClaw model fallback setup and help me choose a provider-diverse fallback chain before changing anything.

Do all of the following:

1. Find my current OpenClaw model configuration.
2. Determine whether my setup currently uses shared fallbacks in `agents.defaults.model.fallbacks`, per-agent fallbacks in `agents.list[].model.fallbacks`, or both.
3. Check which providers are currently available in my setup.
4. Research or inspect the currently available models from those providers and identify good fallback candidates.
5. Check whether my current primary model and fallbacks are too concentrated in one provider.
6. Propose a few provider-diverse fallback chains and recommend one, keeping the setup simple.
7. Keep my current primary model if it still makes sense, unless there is a clear reason to change it.
8. Explain the tradeoffs of the suggested options - reliability, cost, speed, and model quality.
9. Ask me to choose one of the suggested fallback chains before changing the config.
10. After I choose, update the config carefully in the correct place - shared defaults for global fallbacks, or `agents.list[].model.fallbacks` for a specific agent override.

Then show me:
- which config path is currently being used for fallbacks
- the config file you changed
- the exact primary and fallback models before
- the provider and model options you discovered
- the fallback chains you suggest
- which option you recommend and why
- after I choose, the exact config path and primary/fallback models after
```

</details>

### REL-02: Your agent says "done" when it isn't

One of the most common OpenClaw failures is fake completion. The agent acknowledges the task, says it is done, and never verifies whether anything actually happened.

Add this to `AGENTS.md`:

```md
Every task follows Execute-Verify-Report. No exceptions.

- Execute: do the actual work, not just acknowledge the instruction
- Verify: confirm the result happened (file exists, message delivered, data saved)
- Report: say what was done and what was verified

"I'll do that" is not execution.
"Done" without verification is not acceptable.
If execution fails, retry once with an adjusted approach.
If it fails again, report the failure with a diagnosis. Never fail silently.
3 attempts max, then escalate to the user.
```

This does not change what your agent can do. It changes what counts as finished.

<details>
<summary><strong>Copy prompt - implement this tip for me</strong></summary>

```md
Update my OpenClaw instructions so the agent does not report fake completion.

Do all of the following:

1. Find the right workspace instruction file, preferably `AGENTS.md`.
2. Add an explicit Execute-Verify-Report rule for every task.
3. Include these exact behavioral requirements:
   - execute the task, do not just acknowledge it
   - verify the result actually happened
   - report what was done and what was verified
   - retry once with an adjusted approach if execution fails
   - if it fails again, report the failure with a diagnosis
   - never fail silently
   - after 3 total attempts, escalate to the user
4. Merge with any existing task-execution rules instead of creating conflicting instructions.
5. Keep the final instruction block short, clear, and enforceable.

Then show me:
- which file you changed
- the exact rule block you added
- any existing rules you had to merge with
- any edge cases or ambiguities you noticed
```

</details>

### REL-03: Use heartbeat to rotate recurring checks, not just repeat one generic check

A generic heartbeat check can keep returning `HEARTBEAT_OK` while email sync is broken, calendar access expired, git is dirty, or a task queue has been stalled for hours.

OpenClaw already has a real `HEARTBEAT.md` pattern for periodic awareness. A practical way to get more value from it is to rotate through a few small recurring checks instead of repeating the same generic check every time.

The pattern is simple:

```md
Read `heartbeat-state.json`. Run whichever check is most overdue.

- Email: every 30 min (9 AM - 9 PM)
- Calendar: every 2 hours (8 AM - 10 PM)
- Tasks: every 30 min
- Git: every 24 hours
- System: every 24 hours (3 AM)

Process:
1. Load timestamps from `heartbeat-state.json`
2. Calculate which check is most overdue
3. Run only that check
4. Update timestamp
5. Report only if something is actionable
6. Otherwise return `HEARTBEAT_OK`
```

This works well when you want lightweight recurring coverage without creating a separate cron job for every single check.

<details>
<summary><strong>Copy prompt - implement this tip for me</strong></summary>

```md
Upgrade my OpenClaw heartbeat so it rotates through a few recurring checks instead of repeating one generic check.

Do all of the following:

1. Find my current `HEARTBEAT.md` setup.
2. Replace or merge it with a rotating checklist that runs the single most overdue recurring check on each heartbeat.
3. Create or update a `heartbeat-state.json` file to track the last successful run time for each check.
4. Keep the checks practical and low-noise. Only report when something needs attention. Otherwise return `HEARTBEAT_OK`.
5. Reuse my existing heartbeat structure if it already has useful checks.
6. Keep this as a heartbeat workflow unless I already have a better reason to use separate cron jobs for exact timing.
7. Explain briefly which parts are standard OpenClaw heartbeat behavior and which parts are the rotating-check pattern being added.

Then show me:
- what you changed in `HEARTBEAT.md`
- whether you created or updated `heartbeat-state.json`
- which checks will rotate
- what counts as an actionable report vs `HEARTBEAT_OK`
- whether you kept it as heartbeat or recommended cron for any specific check
```

</details>

### REL-04: Turn on tool-loop detection before a bad run burns hours

Repeated tool-call loops are one of the fastest ways to waste time and tokens in OpenClaw. An agent can keep cycling through the same tool pattern, make no progress, and keep spending until you stop it.

OpenClaw already has built-in loop detection for this, but the guard is disabled by default. It can detect repeated same-tool patterns, no-progress polling loops, and ping-pong behavior between repeated tool calls.

Start with the default thresholds and turn it on like this:

```json5
{
  tools: {
    loopDetection: {
      enabled: true,
      historySize: 30,
      warningThreshold: 10,
      criticalThreshold: 20,
      globalCircuitBreakerThreshold: 30,
      detectors: {
        genericRepeat: true,
        knownPollNoProgress: true,
        pingPong: true
      }
    }
  }
}
```

The docs recommend starting with `enabled: true` and leaving the defaults alone until you see a real reason to tune them. If you get false positives, raise thresholds or disable the specific detector causing trouble instead of turning the whole guard off.

<details>
<summary><strong>Copy prompt - implement this tip for me</strong></summary>

```md
Review my OpenClaw config and turn on tool-loop detection so bad tool-call loops do not burn time and tokens unchecked.

Do all of the following:

1. Find my OpenClaw config file.
2. Check whether `tools.loopDetection` is already configured.
3. If it is missing, add `tools.loopDetection` with OpenClaw's recommended starting setup:
   - `enabled = true`
   - `historySize = 30`
   - `warningThreshold = 10`
   - `criticalThreshold = 20`
   - `globalCircuitBreakerThreshold = 30`
   - `detectors.genericRepeat = true`
   - `detectors.knownPollNoProgress = true`
   - `detectors.pingPong = true`
4. If it already exists, merge carefully instead of overwriting unrelated settings.
5. Check whether any agent-specific `agents.list[].tools.loopDetection` overrides already exist.
6. Explain briefly what each threshold does and whether the current setup looks conservative or aggressive.
7. Keep the initial setup close to defaults unless there is a clear reason to tune it.

Then show me:
- which config file you changed
- the exact `tools.loopDetection` block before and after
- whether any agent-specific overrides exist
- what the thresholds mean in practice
- any assumptions you made
```

</details>

<a id="cost"></a>

## 💸 Cost

### COST-01: Your heartbeat model is costing you more than you think

Heartbeat runs are small, but they repeat all day. If they use the same expensive model as your main agent, that background traffic adds cost faster than most people expect.

OpenClaw lets you set a separate heartbeat model at `agents.defaults.heartbeat.model`.

Use a cheaper model for heartbeats:

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        model: "openai/gpt-5-nano"
      }
    }
  }
}
```

For most setups, heartbeat work is lightweight: check whether something needs attention, return `HEARTBEAT_OK`, or surface a short actionable update. That usually does not need your main high-cost model.

<details>
<summary><strong>Copy prompt - implement this tip for me</strong></summary>

```md
Review my OpenClaw heartbeat configuration and set a cheaper heartbeat-specific model if I am currently using an unnecessarily expensive one.

Do all of the following:

1. Find my OpenClaw config file.
2. Check whether `agents.defaults.heartbeat.model` is already set.
3. Check what my default main model is.
4. If heartbeat is using the same high-cost model as my main agent, suggest a cheaper heartbeat model and recommend one.
5. Keep the setup simple. Prefer changing only `agents.defaults.heartbeat.model` unless there is a clear reason to do more.
6. Explain briefly what heartbeat runs currently do in my setup and why a cheaper model is or is not appropriate.
7. After choosing the model, update the config carefully without overwriting unrelated heartbeat settings.

Then show me:
- which config file you changed
- the exact `agents.defaults.heartbeat` block before and after
- what model my main agent uses
- what model heartbeat used before
- what model heartbeat uses after
- why that change makes sense for cost and workload
```

</details>

### COST-02: Use cache-ttl pruning or idle sessions will re-cache junk history

After a session sits idle past the prompt-cache TTL, the next request can end up caching old tool-result history all over again. If those old tool results are large and no longer useful, that first post-idle request costs more than it needs to.

OpenClaw has a built-in config for this at `agents.defaults.contextPruning`. In `cache-ttl` mode, OpenClaw prunes old tool results from the in-memory prompt after the cache TTL window passes. It does not rewrite the session transcript on disk.

Turn it on like this:

```json5
{
  agents: {
    defaults: {
      contextPruning: {
        mode: "cache-ttl",
        ttl: "1h"
      }
    }
  }
}
```

This is mainly useful for Anthropic prompt caching behavior, including OpenRouter Anthropic models. It reduces the cache write on the first post-idle request by trimming old tool-result context before that request is sent.

If you use Anthropic `cacheRetention`, match the pruning TTL to that cache window when possible:

- `ttl: "5m"` pairs with `cacheRetention: "short"`
- `ttl: "1h"` pairs with `cacheRetention: "long"`

<details>
<summary><strong>Copy prompt - implement this tip for me</strong></summary>

```md
Review my OpenClaw config and enable cache-ttl context pruning so idle sessions do not re-cache oversized tool-result history.

Do all of the following:

1. Find my OpenClaw config file.
2. Check whether `agents.defaults.contextPruning` is already configured.
3. If it is missing, add `agents.defaults.contextPruning` with:
   - `mode = "cache-ttl"`
   - `ttl = "1h"`
4. If it already exists, merge carefully instead of overwriting unrelated pruning settings.
5. Check whether I use Anthropic models directly or through OpenRouter Anthropic model refs.
6. If I already use `cacheRetention`, tell me whether the pruning TTL matches it well.
7. Explain briefly that this prunes old tool results from the in-memory prompt only, not from the on-disk session transcript.
8. Keep the final config minimal unless there is a clear reason to tune additional pruning settings.

Then show me:
- which config file you changed
- the exact `agents.defaults.contextPruning` block before and after
- whether this setup is relevant to my current providers/models
- whether the TTL matches my current cache behavior well
- any assumptions you made
```

</details>

### COST-03: Local models are often a false economy

Local models can look cheaper because the per-request API cost is zero. In practice, many OpenClaw setups pay for that elsewhere: expensive hardware, higher latency, weaker output, smaller context windows, or more operational work to keep the local stack reliable.

OpenClaw's local-model docs are clear that strong local setups are possible, but they are not lightweight. OpenClaw expects large context and strong resistance to prompt injection. The docs recommend high-end hardware and the largest model variant you can run. Small or heavily quantized local models increase the tradeoff.

That means local is usually not the default cost fix for OpenClaw. It makes more sense when you already have the hardware, have a strong privacy requirement, or are intentionally using a hybrid setup with hosted models still available as fallbacks.

If you do run local, keep the setup realistic:

- use the largest model you can run well
- keep hosted models available as fallbacks with `models.mode: "merge"`
- treat local as an infrastructure decision, not just a pricing trick

<details>
<summary><strong>Copy prompt - implement this tip for me</strong></summary>

```md
Review my OpenClaw model setup and tell me whether moving more of it to local models would actually reduce total cost for my workload.

Do all of the following:

1. Find my current OpenClaw model configuration.
2. Check whether I already use any local providers such as Ollama, LM Studio, or another local OpenAI-compatible endpoint.
3. Check whether my current setup is hosted-only, local-only, or hybrid.
4. Explain the likely tradeoffs for my setup: API cost, hardware cost, latency, context window, output quality, and operational complexity.
5. If local looks like a poor fit, say so clearly.
6. If local could make sense, recommend a realistic shape such as hybrid hosted-primary with local fallback, or local-only for narrow workloads.
7. Do not change my config yet unless I ask you to after reviewing the recommendation.

Then show me:
- what model setup I use now
- whether I already have local-model support configured
- the main reasons local would or would not make sense for me
- the safest setup shape you recommend
- any assumptions you made
```

</details>

### COST-04: Use local models only for repetitive mechanical work

Local models make more economic sense when the work is repetitive, narrow, and tolerant of weaker output. That usually means chores like classification, tagging, sorting, extraction, and other mechanical steps that do not need your best reasoning model.

This fits OpenClaw's local-model guidance better than using local as a blanket replacement for your main agent. The docs emphasize large context, strong prompt-injection resistance, and full-size models for serious general-purpose use. That makes local more compelling for bounded low-risk workloads than for your primary high-quality assistant path.

In practice, the safe pattern is usually:

- keep your main agent on a stronger hosted model
- use local for repetitive background work or narrow helper tasks
- keep fallbacks available with `models.mode: "merge"` when local reliability matters

That way local handles cheap mechanical work, while your main assistant keeps the quality level needed for planning, synthesis, and higher-trust decisions.

<details>
<summary><strong>Copy prompt - implement this tip for me</strong></summary>

```md
Review my OpenClaw setup and tell me whether I should use local models for any repetitive mechanical work instead of trying to move my main agent fully local.

Do all of the following:

1. Find my current OpenClaw model configuration.
2. Identify which parts of my workflow are repetitive and mechanical versus which parts need stronger reasoning or higher output quality.
3. Check whether I already have any local-model provider configured.
4. If local models are available, recommend which narrow tasks they could handle safely.
5. If local models are not available, explain whether adding them would likely be worth it for my workload.
6. Prefer a hybrid recommendation when that is safer than moving the main agent fully local.
7. Do not change the config yet unless I ask you to after reviewing the recommendation.

Then show me:
- what model setup I use now
- which tasks look suitable for local models
- which tasks should stay on stronger hosted models
- whether a hybrid setup makes sense
- any assumptions you made
```

</details>

<a id="operations"></a>

## ⚙️ Operations

### OPS-01: Set explicit concurrency limits for agents and subagents

If you run multi-agent workflows, concurrency is one of the easiest ways to lose control of cost and runtime behavior. A stuck retry loop or aggressive subagent fan-out can keep multiple runs active at once unless you set deliberate limits.

OpenClaw gives you two separate caps:

- `agents.defaults.maxConcurrent` - max parallel main agent runs across sessions
- `agents.defaults.subagents.maxConcurrent` - max parallel subagent runs in the dedicated subagent lane

Set them explicitly:

```json5
{
  agents: {
    defaults: {
      maxConcurrent: 3,
      subagents: {
        maxConcurrent: 8
      }
    }
  }
}
```

The main agent limit defaults to `1`. The subagent lane defaults to `8`. Even if those defaults are acceptable, setting them explicitly makes the intended safety limits clear and keeps later config changes from drifting.

<details>
<summary><strong>Copy prompt - implement this tip for me</strong></summary>

```md
Review my OpenClaw concurrency settings and set explicit safe limits for both main agent runs and subagent runs.

Do all of the following:

1. Find my OpenClaw config file.
2. Check whether `agents.defaults.maxConcurrent` is already set.
3. Check whether `agents.defaults.subagents.maxConcurrent` is already set.
4. If either value is missing, add explicit concurrency limits with sensible defaults.
5. If values already exist, explain whether they look conservative, aggressive, or mismatched for normal use.
6. Keep the config simple. Prefer changing only these concurrency keys unless there is a clear reason to do more.
7. Explain briefly that main-agent concurrency and subagent concurrency are separate limits.
8. Merge carefully without overwriting unrelated config.

Then show me:
- which config file you changed
- the exact concurrency block before and after
- what the main agent concurrency limit is
- what the subagent concurrency limit is
- why those limits make sense for safety and cost control
- any assumptions you made
```

</details>

<a id="automation"></a>

## ⏱️ Automation

### AUTO-01: Standing orders define what, cron defines when

Standing orders and cron jobs solve different problems. Standing orders define what the agent is authorized and expected to do. Cron defines when that work should run.

OpenClaw's standing-orders docs recommend keeping the standing instructions in `AGENTS.md` so they are loaded every session. Cron jobs should then trigger that program on a schedule instead of repeating the whole workflow inside every scheduled prompt.

Keep the cron prompt short and point it at the standing order:

```bash
openclaw cron add \
  --name "Daily inbox triage" \
  --cron "0 8 * * 1-5" \
  --tz "America/New_York" \
  --session isolated \
  --message "Execute daily inbox triage per standing orders. Check mail for new alerts. Parse, categorize, and persist each item. Report summary to owner. Escalate unknowns." \
  --announce
```

This gives you one place to update the logic later. Change the standing order once in `AGENTS.md`, and the scheduled job keeps using the new behavior without rewriting every cron prompt.

<details>
<summary><strong>Copy prompt - implement this tip for me</strong></summary>

```md
Review my OpenClaw automation setup and separate standing instructions from scheduling so the logic lives in standing orders and cron only controls timing.

Do all of the following:

1. Find where my standing instructions currently live, preferably in `AGENTS.md`.
2. Check whether I already have cron jobs or scheduled prompts that duplicate long workflow instructions.
3. If the workflow logic is embedded directly in cron prompts, move the durable logic into a standing-order section.
4. Keep the standing-order instructions in `AGENTS.md` unless there is a clear reason to use another file and reference it carefully.
5. Rewrite the scheduled prompt so it is short and points to the standing order instead of repeating the full workflow.
6. Keep approval gates, escalation rules, and execution expectations clear in the standing order.
7. Preserve any existing schedule, timezone, delivery target, and safety behavior unless there is a clear problem.

Then show me:
- which file you changed for the standing order
- the exact standing-order block you added or updated
- which cron job or scheduled prompt you changed
- the exact scheduled prompt before and after
- what logic now lives in the standing order vs the cron job
- any assumptions you made
```

</details>

<a id="architecture"></a>

## 🏗️ Architecture

### ARCH-01: Stop using one generic agent for everything

Once OpenClaw is doing more than one kind of work, one generic agent usually becomes a quality bottleneck. Monitoring, research, and communication do not need the same prompt, the same tools, or the same model behavior.

OpenClaw already has a real multi-agent pattern through `agents.list`, separate workspaces, and isolated sessions. That makes it practical to split distinct jobs into distinct agents instead of forcing one agent to do everything.

Start with a small split:

```json5
{
  agents: {
    list: [
      {
        id: "monitor",
        workspace: "~/.openclaw/workspace-monitor",
        model: { primary: "openai/gpt-5-nano" }
      },
      {
        id: "researcher",
        workspace: "~/.openclaw/workspace-researcher",
        model: { primary: "kimi-coding/k2p5" }
      },
      {
        id: "communicator",
        workspace: "~/.openclaw/workspace-communicator",
        model: { primary: "anthropic/claude-opus-4-6" }
      }
    ]
  }
}
```

The point is not those exact models. The point is role separation. Keep the monitor cheap and narrow, the researcher good at reading and comparing, and the communicator optimized for human-facing output.

Start with three roles, not twelve.

<details>
<summary><strong>Copy prompt - implement this tip for me</strong></summary>

```md
Review my OpenClaw setup and tell me whether I should split my current single-agent setup into a small multi-agent architecture with distinct roles.

Do all of the following:

1. Find my current OpenClaw agent configuration.
2. Check whether I already use `agents.list` or if I am still effectively single-agent.
3. Look at the kinds of work I expect this setup to do and identify whether there are clearly different roles such as monitoring, research, and communication.
4. If a split makes sense, propose a small role-based architecture with distinct agent ids, workspace names, and model suggestions.
5. Keep the recommendation conservative. Prefer 2-3 agents, not a large agent tree.
6. Explain what each proposed agent would own and why that separation would improve quality, cost, or reliability.
7. Do not change my config yet unless I ask you to after reviewing the recommendation.

Then show me:
- what agent setup I use now
- whether I already have multi-agent support configured
- the small architecture you recommend
- what each proposed agent would do
- what tradeoffs come with splitting the setup
- any assumptions you made
```

</details>

### ARCH-02: Keep your orchestrator as a manager, not the doer

In a multi-agent setup, the main orchestrator works best as a manager. Its job is to plan, route work, keep context straight, and report back. Once it starts trying to do every research task, coding task, and background chore itself, the system gets slower and less reliable.

This matches OpenClaw's multi-agent and delegate patterns. Separate agents can own different workspaces, sessions, and roles. That only helps if the top-level agent actually orchestrates instead of absorbing all the work itself.

The practical split looks like this:

- the orchestrator decides what needs to happen
- specialist agents do the bounded work
- the orchestrator collects results and reports the outcome

If the main agent is busy doing the work itself, it is not really orchestrating.

<details>
<summary><strong>Copy prompt - implement this tip for me</strong></summary>

```md
Review my OpenClaw setup and tell me whether my main agent should act more like an orchestrator that plans and delegates instead of trying to do all work itself.

Do all of the following:

1. Find my current OpenClaw agent setup.
2. Check whether I already have multiple agents or roles configured.
3. Look at the kinds of work my main agent is expected to handle and identify whether it is mixing orchestration with too much direct execution.
4. If a manager-style orchestrator makes sense, recommend what the main agent should keep doing directly and what should move to specialist agents.
5. Keep the recommendation practical. Prefer a small separation of responsibilities, not a complex hierarchy.
6. Explain how this would improve clarity, reliability, or cost control.
7. Do not change my config yet unless I ask you to after reviewing the recommendation.

Then show me:
- what my main agent is doing now
- whether it is acting more like a manager or a doer
- what work should stay with the main agent
- what work should move to specialist agents
- what tradeoffs come with this split
- any assumptions you made
```

</details>

### ARCH-03: Give different models different prompt files

Model switching is not just about cost or speed. Different models follow instructions differently, handle tone differently, and fail in different ways. If you rely on multiple important model paths, one shared prompt setup can leave quality on the table.

OpenClaw already gives you the main pieces needed for this: per-agent workspaces, per-agent model configuration, and separate workspace files injected into each agent's context. That makes it practical to keep different prompt variants for different agent/model paths instead of forcing one prompt style across everything.

The practical version is simple:

- keep one prompt/workspace setup for your main high-quality model path
- keep a separate prompt/workspace setup for cheaper, narrower, or more operational models
- tune each one for how that model actually behaves in practice

This does not mean creating a huge prompt matrix. It means separating the prompt setups that clearly need different instructions.

<details>
<summary><strong>Copy prompt - implement this tip for me</strong></summary>

```md
Review my OpenClaw setup and tell me whether I should keep different prompt/workspace files for different important model paths instead of using one shared prompt setup for everything.

Do all of the following:

1. Find my current agent and model configuration.
2. Check whether I already use multiple important model paths, such as a stronger main model and one or more cheaper or narrower models.
3. Look at the kinds of work those models handle and identify whether they likely need different instructions, tone, or operating rules.
4. If a split makes sense, recommend a small prompt/workspace separation strategy.
5. Keep the recommendation practical. Prefer a few clear prompt variants, not a large prompt matrix.
6. Explain what should stay shared across all prompt files and what should be tuned per model path.
7. Do not change my files yet unless I ask you to after reviewing the recommendation.

Then show me:
- what agent/model setup I use now
- which model paths look different enough to justify separate prompt setups
- what should stay shared vs what should be tuned per model path
- what tradeoffs come with keeping separate prompt files
- any assumptions you made
```

</details>

<!-- TIP_APPEND_EOF: add new tip sections above this line only -->
