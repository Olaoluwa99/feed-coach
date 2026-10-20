---
layout: page
title: Design notes
permalink: /design
---

This page explains the main design decisions behind Feed Coach and why they were made. Comments in the source code refer to them by number ("decision 0006", "decision 0007"). The rules described here match version 0.3.0; if the code and this page ever disagree, the code (and its tests in `src/core/`) is the reference, and please [open an issue](https://github.com/Olaoluwa99/feed-coach/issues).

A note on two older references: code comments that mention "plan idea 3.12" mean *corrections become tested rules*, and "plan idea 3.13" means *the coach asks instead of guessing*. Both are described below.

## Decision 0003: A feed coach, not a new platform

**The problem.** People spend a lot of time on recommendation feeds they don't fully control. There are already tools that filter feeds, label rage-bait or check privacy settings. What was missing was something that helps an ordinary person **steer their own feed toward a goal** and **measure whether it worked**.

**What Feed Coach does.** It works as a layer on top of the platform you already use:

1. show what your feed is made of,
2. let you set a goal (more of some topics, less of others),
3. suggest actions using the platform's own controls,
4. measure the change, and learn which actions work for you.

**Why YouTube first.** YouTube's homepage shows titles and channel names, which is enough to sort videos into topics and to measure change over time. It's also where many people feel least in control of what they're shown.

**Why measuring matters.** Mozilla's 2022 study ["Does This Button Work?"](https://www.mozillafoundation.org/blog/mozilla-investigation-youtubes-dislike-button-other-user-controls-largely-fail-to-stop-unwanted-recommendations/) found YouTube's feedback buttons only partly effective on average (in that study, "Don't recommend channel" reduced similar unwanted recommendations by about 43%, "Not interested" by about 11%). That's a risk, since steering may be slower than people hope, and an opportunity: nobody shows a person what works *on their own feed*. Feed Coach suggests the strongest button first and measures the real effect for each person.

**Principles that follow from this:**

- Every claim is tied to data you can check (your own snapshots), and change is shown as numbers.
- No platform API, no special access and no server. Feed Coach reads only what YouTube already shows you.
- Feed Coach never acts for you. It suggests; you click.

## Decision 0005: A browser extension first

The test was simple: **if people have to do too much, they won't use it.** Three ways of delivering the coach were compared:

| Option | Steps before seeing anything | Keeping it going |
|---|---|---|
| Website + Google Takeout download | About 13 steps, then a wait of minutes to days for the export | Repeat most of those steps every few weeks |
| **Browser extension** | **About 3 actions, around a minute** | **Nothing: it measures automatically** |
| Mobile app | An install plus an alarming accessibility permission | Not possible on iPhone; heavily restricted on Android |

**Decision:** a desktop Chrome extension is the main product.

- It needs the fewest actions by far, and nothing has to be repeated.
- It sees the **actual homepage recommendations**, which is what the coach is trying to change. A Takeout download only contains watch history.
- Measurement is continuous, so it learns faster which actions work.
- Data stays on the user's computer.

**Accepted downsides:** desktop only (recommendations are tied to the Google account, so steering on desktop likely affects phone and TV feeds too, but that can't be measured); the install-time permission prompt may put some people off; the extension needs fixing when YouTube changes its page; and publishing needs a Chrome Web Store review.

## Decision 0006: How topics are assigned

Every homepage video needs a topic ("Sports & football", "Celebrity, gossip & drama"…). Inside a browser extension, with no server, there were three options:

| Option | Good | Bad |
|---|---|---|
| Small AI model inside the browser | Private, decent accuracy | Tens of MB to download; complex to run in an extension; slow on low-end laptops |
| The user's own API key for an AI service | Best accuracy | Setup effort; titles leave the computer |
| Keyword lists plus user corrections | Instant, private, offline, no setup | Lower accuracy at first |

### The decision: a layered sorter

Each video is checked in this order, and the first answer wins:

1. **Your rules.** "This video is X", "this channel is X", "titles containing Y are X". These always win. Within rules, a video rule beats a channel rule, which beats a keyword rule; among keyword rules, the newest wins.
2. **Optional AI**, if you turned it on with your own key. Only titles are sent. Answers are cached per video, so a title isn't sent again once it has an answer. Topics the AI makes up are ignored.
3. **Built-in keyword lists** for 18 everyday topics, plus the keywords of topics you add. Keywords match whole words or phrases; a match in the title scores 2, a match in the channel name scores 1. If two topics tie, the video is left unsorted (and the tied topics are offered first when you sort it).
4. **Otherwise "Unsorted", and Feed Coach asks.** The popup groups unsorted videos from the last 7 days by channel and asks about the most frequent ones first, so one answer sorts as many videos as possible.

Topics are **never stored with snapshots.** They're worked out fresh each time, so a new correction also fixes the past.

### Corrections become tested rules

Every label you give by hand is kept as an **example**, and the examples are the tests for your rules:

- When you add a rule, every example is re-checked against the new set of rules.
- If the new rule would change an earlier example (for instance, a channel rule that contradicts a video you labelled differently), the new rule is still saved, but the earlier label is kept as a **video-level exception**, and you're told how many. Nothing you said before changes silently.
- Relabelling a video replaces its old label and video rule; it isn't kept as an exception against itself.
- A new rule for the same target (the same video, channel or keyword) replaces the old one.
- When you remove a rule, any labels that only that rule kept correct are removed too, so the remaining examples all still pass. You're told how many.
- After each change, you're also told how many past homepage videos now sort differently.

### Why

- It works for everyone from the first minute, with no setup or downloads.
- Channels repeat a lot on a homepage, so a handful of channel corrections cover a large share quickly.
- It asks about what it can't sort, instead of guessing.
- AI stays optional, so the privacy promise holds by default.

**Accepted downsides:** keyword sorting is often wrong or "Unsorted" at first, especially for titles that aren't in English. An in-browser model may be added later if keywords plus corrections prove too weak.

## Goal progress

A goal is a topic plus a direction (*more* or *less*) and the time it was set. Progress compares two averages of the topic's share of your homepage, where each snapshot counts equally:

- **Before:** snapshots from the 7 days before the goal was set. If there are none (for example, the goal was set on install day), the first day of snapshots after the goal is used as "before" instead.
- **Now:** snapshots from the last 7 days, not counting any that were used as "before".
- **Enough data:** at least 3 snapshots after the goal, and the data itself must reach at least 2 days past the goal. Time passing without visits doesn't count. Until then, the goal shows "measuring".
- **Verdict:** a move of at least 2 percentage points in the wanted direction is "improving", 2 points or more the other way is "going the wrong way", and anything smaller is "no real change yet".

Snapshots are taken at most once every 5 minutes, so reloading the homepage doesn't flood the history, and only the latest 500 are kept.

## Decision 0007: Action tracking

Feed Coach tells you to use YouTube's own buttons. Since those buttons only partly work on average, the most useful thing it can measure is **whether they worked for you**.

### Noticing actions

- **Automatically.** Feed Coach watches your clicks; it never clicks anything itself. When you open a homepage video's ⋮ menu and choose "Not interested" or "Don't recommend channel", it records the action for that video. The menu choice only counts if the menu was opened from a homepage video card in the last minute.
- Menu items are recognised by their label in English, French, Spanish, Portuguese, German and Italian. Other languages aren't detected automatically.
- **Undo.** Only an "Undo" clicked inside the same video card within 2 minutes cancels the action. Other "Undo" buttons on YouTube (such as "Saved to Watch later · Undo") are ignored.
- **By hand.** Each Feed Coach label's menu has "Already used YouTube's ⋮ menu on this?", for when detection misses a click. A hand report of an action that's already recorded is ignored, as is the same detected action on the same video within 10 minutes.
- Wrongly recorded actions can be removed in the settings page.

### Measuring

Every action is judged against your homepage snapshots:

- **Baseline, fixed at recording.** The share of homepage visits showing the channel in the 7 days before the action, **counting the visit the action happened on**. It's calculated and saved when the action is recorded, so trimming old snapshots later can't change it. "Half as often" comparisons need at least 3 earlier visits; otherwise there isn't enough earlier data to compare.
- **After: a 2-week window.** The share of visits showing the channel in the 14 days after the action. Snapshots within 5 minutes of the action count as the same visit, not a later one.
- **Minimums.** An action is judged only after **at least 5 later visits** that reach **at least 2 days** past the action. Until then it's "measuring".
- **Frozen verdicts.** Once the 2-week window has closed, the verdict is saved and never recalculated, so old results and personal tips don't drift. If there weren't enough visits by then, it's frozen as "not enough visits to judge".

| Action | Worked | Partly | Didn't work |
|---|---|---|---|
| Don't recommend channel | The channel never appears again | It appears half as often as before, or less | Otherwise |
| Not interested | The video is gone, and the channel appears half as often as before or less (or not at all) | The video is gone, but the channel still shows up as much | The same video came back |

If YouTube didn't show a channel name (some Shorts), "Don't recommend channel" can't be checked, and "Not interested" is judged by the video alone.

### Using the results

- The popup's **What worked for you** shows, per button, how many times it worked, partly worked or didn't, plus your recent actions.
- Once a button has **at least 3 judged actions**, the tip on "less" videos recommends whichever button has scored best for you (a partial result counts as half), with your own numbers, for example "worked 4 of 5 times for you". Before that, the tip is the general advice: "Don't recommend channel", the strongest button on average in Mozilla's study.

### Why

- It turns the coach from general advice into "here's what works on your feed".
- Watching clicks is safe: Feed Coach reads what you did and never acts for you.
- Channel frequency can be measured from the snapshots already being taken, so no new data is collected.

### Accepted downsides

- Detection depends on YouTube's menu labels and languages, and layout changes can break it. The hand report covers this.
- "Not interested" is meant to reduce *similar* videos, which can only be approximated by the channel.
- A channel disappearing could be coincidence (it might have stopped posting). With few actions, results are hints, not proof.
