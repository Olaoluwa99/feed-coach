# Feed Coach privacy policy

**Effective date:** 2026-10-20

Feed Coach is a Chrome extension that helps you steer your YouTube homepage toward topics you choose, and measures whether YouTube's own feedback buttons worked for you. This policy explains what the extension stores, where, and what (if anything) leaves your computer.

**The short version:** everything Feed Coach records stays on your computer. There is no Feed Coach server, no account, no analytics and no advertising. Nothing is sent anywhere unless you turn on the optional AI sorting feature with your own API key, and then only video titles are sent, directly to the AI provider you chose.

## 1. Who we are

Feed Coach is an open-source project published at <https://github.com/Olaoluwa99/feed-coach>. The source code is public, so anyone can check that the extension does what this policy says.

## 2. What Feed Coach stores

Feed Coach stores the following in Chrome's local extension storage (`chrome.storage.local`) on your computer:

- **Homepage snapshots.** When you open the YouTube homepage, Feed Coach saves a snapshot of the recommendations showing: for up to 40 videos, the video ID, title, channel name, channel link, whether it's a regular video or a Short, and its position on the page, plus the time of the snapshot and how many ads were skipped (ads themselves are not saved). At most one snapshot is taken every 5 minutes, and only the latest 500 are kept; older ones are deleted automatically.
- **Homepage status.** Whether the homepage was last showing recommendations or YouTube's "history is off" message, and when.
- **Your goals.** The topics you want more or less of, and when you set each goal.
- **Your topics, rules and labels.** Topics and keywords you added; sorting rules you created ("this video / this channel / titles containing this word are about X"); and the labels you gave by hand (video ID, title, channel name, topic and date), which are used to test your rules.
- **Tracked feedback actions.** When you use YouTube's "Not interested" or "Don't recommend channel" on a homepage video, or report that you did: which button, the video ID, title and channel name, the time, whether it was noticed automatically or reported by you, whether you clicked "Undo", and the measured result. At most 500 are kept.
- **Optional AI settings and results**, only if you turn AI sorting on: the provider address, the model name and **your API key**, plus the topic the AI gave each video (by video ID), so the same title isn't sent again.
- **Display preferences**, such as whether the on-page panel is minimised or the labels are hidden.

## 3. What Feed Coach does not collect

Feed Coach does not collect, read or store:

- your name, email address, Google or YouTube account details, passwords or cookies;
- the videos you watch, your searches, your comments or your subscriptions;
- pages you visit on other websites (it runs only on `www.youtube.com`, and only reads the homepage);
- your location, IP address or device identifiers;
- any analytics, usage statistics, crash reports or advertising identifiers.

Feed Coach never clicks, likes, subscribes, comments or changes anything on YouTube for you. It only reads the homepage and notices your own clicks on YouTube's "Not interested", "Don't recommend channel" and "Undo" buttons.

## 4. Where your data goes

**By default, nowhere.** Your data stays in your browser's local storage on your computer. It is not uploaded to any Feed Coach server (there isn't one), and it is not synced to your other devices.

Feed Coach does not sell, rent or share your data, and does not use it for advertising, profiling, credit or lending decisions, or anything other than the features described here.

### Optional AI sorting

AI sorting is **off by default**. If you turn it on in the settings page:

- You choose one provider: Google Gemini, Groq or OpenRouter, and enter **your own** API key. Chrome asks you to allow Feed Coach to contact that one provider's website.
- Feed Coach then sends the **titles** of homepage videos it couldn't sort into a topic, together with the list of topic names, directly from your browser to that provider, using your key. At most 100 titles are sent per run, in batches of 25.
- **Only titles are sent.** No channel names, times, video IDs, account details or other data are included. Your API key is sent to that provider only, as the provider requires, to authorise the request.
- Once the provider has answered for a video, Feed Coach remembers the answer and does not send that title again. A title is sent again only if an earlier request failed or the reply couldn't be read.
- What the provider does with the titles is covered by **that provider's own terms and privacy policy**, not this one. Some free tiers may use what you send to improve their models. Please read their terms before turning this on.

You can turn AI sorting off at any time in the settings page. Doing so deletes your API key from Feed Coach and removes its permission to contact that provider.

## 5. Permissions and why they're needed

| Permission | Why |
|---|---|
| `storage` | To save the data listed in section 2 on your computer. |
| Access to `https://www.youtube.com/*` (content script) | To read the recommendations on the YouTube homepage, show topic labels and the Feed Coach panel, and notice your clicks on YouTube's feedback buttons. Feed Coach runs on no other website. |
| Optional access to `https://generativelanguage.googleapis.com/*`, `https://api.groq.com/*`, `https://openrouter.ai/*` | Requested only if you turn on AI sorting, and only for the one provider you choose, so Feed Coach can send video titles to it. Not granted unless you approve Chrome's prompt. |

Feed Coach does not load or run any code from the internet. All of its code is included in the extension package.

## 6. Keeping and deleting your data

- **Automatic limits:** only the latest 500 homepage snapshots and 500 tracked actions are kept.
- **Export:** the settings page (popup → *Settings & your data*) can export everything Feed Coach has stored as a JSON file. Your API key is removed from the export.
- **Delete:** *Delete everything* on the settings page permanently erases all Feed Coach data on your computer, including your API key. (If you had allowed an AI provider, you can also remove that site access in `chrome://extensions` → Feed Coach → Details.)
- **Uninstall:** removing the extension from Chrome deletes all of its stored data.
- You can also remove individual rules, topics and tracked actions in the settings page.

Because the data never reaches us, we cannot see, recover or delete it for you; you're always in control of it.

## 7. Children

Feed Coach is not directed at children under 13 and does not knowingly collect personal information from anyone. It stores nothing that identifies you, and everything it stores stays on the device where it's installed.

## 8. Changes to this policy

If this policy changes, the new version will be published at <https://olaoluwa99.github.io/feed-coach/privacy> and in the project repository with a new effective date. The full history of changes is visible in the repository. If a future version would send any new kind of data off your computer, it will be described here first and will be off until you turn it on.

## 9. Contact

Questions or concerns about privacy: please open an issue at <https://github.com/Olaoluwa99/feed-coach/issues>. Please don't include your exported data or API key in an issue.
