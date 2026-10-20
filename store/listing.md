# Chrome Web Store listing: Feed Coach

Everything to paste into the Chrome Web Store developer dashboard, on the **Store listing** tab. For the **Privacy practices** tab and the rest of the submission, see [`STORE_SUBMISSION.md`](../STORE_SUBMISSION.md).

---

## Name

```
Feed Coach
```

(The store shows the `name` from `static/manifest.json`, which is already "Feed Coach".)

---

## Summary

The store takes the summary from the `description` field in `static/manifest.json` (maximum 132 characters). The current manifest description is a good summary, so no change is needed:

```
Steer your YouTube homepage toward what you want, and see which YouTube buttons actually work. Your data stays on your computer.
```

**Character count: 128** (limit 132).

If the dashboard ever shows a separate editable summary field, paste the same text there so the two match.

---

## Detailed description

Plain text: the store doesn't render Markdown, so there are no asterisks or `#` headings below. Paste everything between the lines exactly as it is.

```
Feed Coach helps you steer your YouTube homepage toward what you actually want to watch, and shows you whether YouTube's own buttons really work for you.

It doesn't replace YouTube or hide anything. It helps you use the controls YouTube already gives you, then measures the result. Everything it records stays on your computer.

WHY

YouTube has buttons like "Not interested" and "Don't recommend channel", but it's hard to tell whether they do anything. Mozilla's 2022 study "Does This Button Work?" found they only partly work on average. Averages don't tell you what happens on your own feed. Feed Coach does.

WHAT IT DOES

- Shows your feed at a glance: a small panel on the YouTube homepage shows the topic mix of what you're being recommended, and every video gets a topic label.
- 18 everyday topics, plus your own: music, gaming, sports and football, comedy, celebrity and gossip, news and politics, learning, science and tech, cooking, fitness, money, faith, travel and more. Add your own topics with your own keywords.
- Goals: tap a topic once for more, twice for less.
- Suggestions: videos that work against your goals get a red label with a tip such as "Don't recommend channel". You decide, and you click YouTube's button yourself.
- Progress: after a few days of normal use, see "before and now" for each goal: improving, no real change yet, or going the wrong way.
- What worked for you: when you use "Not interested" or "Don't recommend channel" on a homepage video, Feed Coach notices and checks over the next two weeks whether that video or channel actually went away. Once a button has enough results, the tips use your own numbers.
- Corrections that stick: click any label to fix its topic, for one video or a whole channel. Your corrections become tested rules, so a later rule can never quietly undo an earlier one.
- It asks instead of guessing: the popup lists the channels it couldn't sort that show up most, so one answer sorts many videos.
- Optional AI sorting with your own free API key (Google Gemini, Groq or OpenRouter). Off by default.

PRIVACY

- Everything is stored locally in your browser. There is no Feed Coach server, no account, no analytics and no tracking.
- It runs only on youtube.com and only reads the page. It never clicks, likes, subscribes or changes anything on YouTube for you.
- Export or delete all your data at any time from the settings page. Uninstalling removes it too.
- Only if you turn on optional AI sorting: the titles of videos Feed Coach couldn't sort are sent directly from your browser to the AI provider you chose, using your own key. No channel names, times or account details are sent.

Privacy policy: https://olaoluwa99.github.io/feed-coach/privacy

GOOD TO KNOW

- Works on desktop Chrome.
- Needs YouTube watch history turned on. With history off, YouTube shows no recommendations on the homepage.
- Measures the YouTube homepage only.
- Results are a guide, not proof: a channel can disappear for other reasons, and changing a feed takes time.
- When YouTube changes its page layout, parts of Feed Coach may stop working until it's updated.

OPEN SOURCE

Feed Coach is free and open source under the MIT license. Read the code, report problems or suggest ideas at https://github.com/Olaoluwa99/feed-coach

Feed Coach is an independent project and isn't affiliated with or endorsed by YouTube or Google.
```

---

## Category

**Suggested: Lifestyle → Well-being.**

Reason: Feed Coach is about taking control of what a recommendation feed shows you and spending time on what you choose, which is what the Well-being category is for. It isn't a social network client, a productivity tool or a privacy blocker.

Second choice: **Lifestyle → Social Networking**, if Well-being isn't available or the review asks for something closer to "YouTube". Category names change from time to time, so pick whichever current category is closest to "digital well-being".

---

## Language

**English** (the extension's interface and this listing are in English only).

---

## Additional fields

| Field | Value |
|---|---|
| Homepage URL | `https://github.com/Olaoluwa99/feed-coach` |
| Support URL | `https://github.com/Olaoluwa99/feed-coach/issues` |
| Privacy policy URL (Privacy practices tab) | `https://olaoluwa99.github.io/feed-coach/privacy` |
| Mature content | No |

---

## Images

Upload these from the `store/` folder. Screenshots must be 1280×800 or 640×400 pixels (PNG or JPEG); up to 5 are allowed. The dashboard marks which image slots are required.

| Dashboard slot | File | Shows |
|---|---|---|
| Store icon (128×128) | `store/icon-128.png` | The Feed Coach icon |
| Screenshot 1 | `store/screenshot-1-homepage.png` | The YouTube homepage with topic labels and the "Your feed right now" panel |
| Screenshot 2 | `store/screenshot-2-goals.png` | The popup: choosing goals (more / less) and seeing progress |
| Screenshot 3 | `store/screenshot-3-what-worked.png` | "What worked for you": results for YouTube's buttons |
| Screenshot 4 (if made) | `store/screenshot-4-private.png` | Privacy: data stays on your computer, export and delete |
| Small promo tile (440×280) | `store/promo-small-440x280.png` | Promotional tile shown in store listings and search |
| Marquee promo tile (1400×560, optional; if made) | `store/promo-marquee-1400x560.png` | Large banner, used only if the store features the extension |

Before uploading, open each image and check that it matches the current version (labels, wording, version number) and contains no personal account details, such as a profile picture or a real account name.
