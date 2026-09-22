# SUMMARY — what this talk covers (Phase 0 opening)

The agenda-setting content for the first ~30-45 seconds of Phase 0, said or
shown *before* diving into the get-started-guide walkthrough. Doubles as a
one-page description of the talk if you need an abstract for a program or
CFP — it's written to stand alone either way.

## The premise

This isn't a slide deck about Cloudflare Workers AI. It's a live rebuild, in
front of you, of the actual path from "read the getting-started guide" to
"found the parts of this platform that are still rough" — in the order it
actually happened, failures included. Every phase is a real Worker,
deployed ahead of time; nothing here is a mockup.

## What I'll walk through today

| Title | Detail |
|---|---|
| The catalog moves faster than the docs | Cloudflare's own getting-started guide once referenced a deprecated model — the live catalog page, not any guide, is the real source of truth. |
| A first working summarizer — and a bug that quietly cuts output short | It works, right up until you actually read the response. |
| Why a hard-coded model ID is a landmine, and the fallback that fixes it | Watched breaking live, on purpose. |
| Turning "which model is best" from a guess into a repeatable check | A fixed reference input, a hand-written reference summary, any candidate model measured against both. |
| A humanizer that catches AI-sounding text — and fixes only what's flagged | The first attempt (summarize it away) didn't work; the second one (a deterministic check plus a targeted small-model fix) did. |
| What Cloudflare's usage page doesn't tell you, and the API that fills the gap | Staying inside a 10,000-neuron/day free tier means actually seeing where the neurons go. |
| JS vs. TS vs. Python — the same AI call, compared | One of those three isn't like the other two, and it's not the one you'd guess from syntax alone. |
| Image generation's rough edges | Inconsistent parameters across models, a real false positive, and one moment I'm deliberately not telling you the outcome of in advance. |

## What this isn't

- Not a polished how-to, and not trying to be. The failures stay in on
  purpose — they're most of the lesson.
- Not full coverage of the Workers AI model catalog — just what actually
  got touched building this.
- Not a video-generation talk. Image generation alone has the rough edges
  you're about to see; video's a harder problem, not an easier one, and out
  of scope until image settles down.
- Not 15 minutes of typing. Everything's deployed ahead of time — you're
  watching already-written code get operated, not written.

## One line to say before diving in

*"Let's start where I did — the getting-started guide."*
