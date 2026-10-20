# Chrome Web Store submission checklist

A step-by-step list for publishing Feed Coach (version 0.3.0) on the Chrome Web Store.

Steps marked **[Author only]** need the publisher's own Google account, payment or GitHub settings and can't be done by anyone else. Unmarked steps can be prepared by anyone working on the repository.

Dashboard wording changes from time to time. Where this file quotes field names or checkbox labels, check them against what the dashboard shows on the day, and choose the option that is closest in meaning.

---

## 0. Before you start

- [ ] All tests pass: `npm test` and `npm run typecheck`.
- [ ] `static/manifest.json` has the version you're releasing (`0.3.0`), `"permissions": ["storage"]`, the content script on `https://www.youtube.com/*` only, and the three `optional_host_permissions` (`https://generativelanguage.googleapis.com/*`, `https://api.groq.com/*`, `https://openrouter.ai/*`). If any of these change, update `PRIVACY.md`, `docs/privacy.md` and section 4 below to match **before** submitting.
- [ ] Icons exist in `static/icons/` (16, 32, 48, 128) and the store images exist in `store/` (see `store/listing.md`).
- [ ] **[Author only]** GitHub Pages is on: repository **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `/docs`**. Then open <https://olaoluwa99.github.io/feed-coach/privacy> in a private window and check the privacy policy loads. The store review checks this link.

## 1. Register a developer account [Author only]

- [ ] Sign in at <https://chrome.google.com/webstore/devconsole> with the Google account that will own the listing. Google requires 2-Step Verification on that account.
- [ ] Accept the developer agreement and pay the **one-time registration fee** (US$5 at the time of writing; the dashboard shows the current amount). This is paid once per account, not per extension.
- [ ] In **Account**, set the publisher display name and a contact email, and verify the email. This email is used for review results; it's shown only if you choose to show it. (Public support goes through GitHub issues; there's no need to publish a personal email.)
- [ ] Complete the **trader / non-trader declaration** if the dashboard asks for it. A free, open-source hobby project is normally "non-trader", but read the dashboard's explanation and answer for your own situation.

## 2. Build the package

```bash
npm install
npm test
npm run typecheck
npm run package
```

- [ ] This creates `release/feed-coach-<version>.zip`. Check the file name shows `0.3.0`.
- [ ] Unzip it into an empty folder and check that `manifest.json` is at the top level of the zip (not inside a subfolder), along with `background.js`, `content.js`, `popup.html`, `options.html` and `icons/`.
- [ ] Test the unzipped folder once with **Load unpacked** in `chrome://extensions` on a fresh Chrome profile: the YouTube homepage shows labels and the panel, the popup opens, and the settings page opens.
- [ ] **[Author only]** Optionally attach the same zip to a GitHub Release (`v0.3.0`) so testers can install it before the store approves it.

## 3. Upload and fill in the store listing

- [ ] In the developer dashboard: **Items → New item** (or **Add new item**), and upload `release/feed-coach-0.3.0.zip`.
- [ ] **Store listing** tab: paste the text from [`store/listing.md`](store/listing.md):
  - Description (the plain-text block)
  - Category (Lifestyle → Well-being suggested)
  - Language: English
  - Store icon, screenshots and promo tiles (file mapping is in `store/listing.md`)
  - Homepage URL `https://github.com/Olaoluwa99/feed-coach` and support URL `https://github.com/Olaoluwa99/feed-coach/issues`
  - Mature content: No
- [ ] Check that the summary the dashboard shows (taken from the manifest `description`) is the 128-character text in `store/listing.md`.

## 4. Privacy practices tab

### Single purpose

Paste:

```
Feed Coach helps users steer the recommendations on their own YouTube homepage toward topics they choose. It shows the topic mix of the homepage, lets the user set goals (more or less of a topic), suggests which of YouTube's own feedback buttons to use, and measures over time whether the homepage and those buttons changed what the user is shown. All features serve this one purpose.
```

### Permission justifications

**`storage`**

```
Feed Coach stores everything locally with chrome.storage.local: snapshots of the YouTube homepage recommendations (video IDs, titles, channel names, positions, times), the user's goals, topics, sorting rules and labels, the YouTube feedback actions the user took and their measured results, optional AI settings, and display preferences. This data is needed to measure change over time. It stays on the user's computer and the user can export or delete it from the settings page.
```

**Host permission: `https://www.youtube.com/*` (content script)**

```
The content script runs only on www.youtube.com. On the YouTube homepage it reads the recommended videos (video ID, title, channel name, position) to sort them into topics and measure the feed over time, draws topic labels and a small summary panel on the page, and listens for the user's own clicks on YouTube's "Not interested", "Don't recommend channel" and "Undo" buttons so it can measure whether those actions worked. It never clicks or changes anything on YouTube on the user's behalf and runs on no other website.
```

**Optional host permissions: `https://generativelanguage.googleapis.com/*`, `https://api.groq.com/*`, `https://openrouter.ai/*`**

```
These are optional and not granted at install. They are requested at runtime, one provider at a time, only if the user turns on the optional AI sorting feature in the settings page and enters their own API key for Google Gemini, Groq or OpenRouter. Feed Coach then sends the titles of homepage videos it could not sort (titles only: no channel names, times, video IDs or account details) to that one provider's chat completions API, directly from the browser with the user's key, and reads back a topic for each title. Turning AI off removes the key and the permission.
```

(If the dashboard has a single "Host permission justification" box, paste the youtube.com text followed by the optional-permissions text.)

### Remote code

- [ ] Select **"No, I am not using remote code."**

Justification, if a box is shown:

```
All JavaScript is bundled in the extension package. Feed Coach does not load or evaluate any code from the network. The only network requests are optional calls to the user's chosen AI provider, which return JSON data (topic names) that is parsed as data, never executed.
```

### Data usage

The dashboard asks which kinds of user data the extension "collects or uses". Feed Coach processes some data **locally only** and, with optional AI, sends video titles to a third party the user chose. Disclosing local handling is the conservative choice and avoids a mismatch with the privacy policy, so tick the following:

| Data type | Tick? | Why |
|---|---|---|
| Personally identifiable information | No | No name, email, address or account ID is read or stored. |
| Health information | No | |
| Financial and payment information | No | |
| Authentication information | **Yes (conservative)** | If the user turns on AI, their own API key for the AI provider is stored locally and sent only to that provider to authorise requests. |
| Personal communications | No | |
| Location | No | |
| Web history | **Yes (conservative)** | Snapshots record the time of each YouTube homepage visit. Feed Coach doesn't record other pages or a browsing list, but the visit times are close enough to the dashboard's definition ("pages visited... time of visit") that ticking it is safer. |
| User activity | **Yes** | Feed Coach notices the user's clicks on YouTube's "Not interested", "Don't recommend channel" and "Undo" buttons on homepage videos. |
| Website content | **Yes** | Titles, channel names and video IDs of the videos recommended on the YouTube homepage. With optional AI, titles are sent to the user's chosen provider. |

The minimum accurate set is **Website content** and **User activity**. The two marked "conservative" are recommended as well, because disclosing more than strictly needed doesn't cause a rejection, while disclosing less can. Read the dashboard's current definition of each type before deciding, and make sure whatever you tick is also covered in `PRIVACY.md` (it currently is).

### Certifications

Tick all three (they're true for Feed Coach):

- [ ] I do not sell or transfer user data to third parties, outside of the approved use cases.
  - Sending titles to the user's chosen AI provider is done only at the user's request, to provide a feature the user turned on, which is an approved use case.
- [ ] I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- [ ] I do not use or transfer user data to determine creditworthiness or for lending purposes.

### Privacy policy URL

```
https://olaoluwa99.github.io/feed-coach/privacy
```

## 5. Test instructions for reviewers (if the dashboard has a Test instructions tab)

```
No account or login is needed for Feed Coach itself.
1. Sign in to YouTube with any Google account that has YouTube watch history turned on (with history off, YouTube shows no homepage recommendations).
2. Open https://www.youtube.com/ and wait a few seconds. Topic labels appear on videos and a "Your feed right now" panel appears at the bottom right.
3. Click the Feed Coach toolbar icon. Tap a topic once (more) or twice (less) to set a goal. Videos in a "less" topic then show a red label with a tip.
4. Click any label to change its topic.
5. Open a homepage video's three-dot menu and choose "Not interested". Feed Coach shows a notice that it will check whether this worked; the action appears in the popup under "What worked for you" and in Settings.
6. Settings (popup, "Settings & your data") shows topics, rules, tracked actions, optional AI (off by default, needs the user's own API key) and Export / Delete everything.
```

## 6. Distribution

- [ ] **Payments:** free.
- [ ] **Regions:** all regions.
- [ ] **Visibility:** choose one:
  - **Unlisted** for a tester phase: anyone with the link can install it, but it doesn't appear in search. Good for getting the first real-world reports before going public. You can switch it to Public later on the Distribution tab (Google may review it again when you do).
  - **Public** when ready for everyone.
  - (**Private** limits installs to listed testers' accounts or a Google Group; only useful if you want a closed group.)

## 7. Submit [Author only]

- [ ] Click **Submit for review**. Decide whether it should publish automatically once approved; if not, you publish it by hand after approval.
- [ ] **What to expect:** most reviews finish within a few days, but it can take several weeks, especially for a new developer account and for extensions that run on a popular site like youtube.com. You'll get an email either way, and the dashboard shows the status.
- [ ] Don't upload a new version while the first one is in review unless you need to; that restarts the review.

## 8. If it's rejected

- [ ] Read the email carefully. It names the policy and a reference code (for example "Yellow Zinc" usually means missing or unclear listing information, and "Purple Potassium" means a permission that looks broader than needed). Google's "troubleshooting Chrome Web Store violations" page explains each code.
- [ ] Fix only what was asked. Common fixes for an extension like this:
  - **Listing / metadata:** make the description, screenshots and single purpose describe the same thing; make sure the screenshots show the current version.
  - **Permissions:** make each justification say exactly which feature uses it; confirm nothing unused is in the manifest.
  - **Privacy:** make sure the privacy policy link works and that the data-usage boxes and `PRIVACY.md` say the same thing.
- [ ] If the code changes, bump the version in `static/manifest.json` (and `package.json`), run `npm run package` again and upload the new zip. If only the listing or Privacy practices tab changes, edit it and resubmit.
- [ ] If you believe the rejection is a mistake, reply or appeal through the link in the email (Chrome Web Store developer support), explaining calmly how the extension works and pointing to the public source code.

## 9. After approval

- [ ] **[Author only]** Publish (if you chose manual publishing).
- [ ] Replace "Coming soon" in `README.md` and the "coming soon" line in `docs/index.md` with the store link.
- [ ] For future updates: bump the version, `npm run package`, upload the new zip under the same item (**Package → Upload new package**), and update the Privacy practices tab if permissions or data handling changed.
