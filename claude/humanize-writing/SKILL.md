---
name: humanize-writing
description: Use this whenever you draft, revise, or polish any substantive prose that will be read as if a human wrote it -- emails, blog posts, LinkedIn/social posts, marketing copy, README or doc content, PR descriptions, cover letters, essays, articles, or chat replies of more than a couple sentences. Apply it by default even when the user never says "sound more human" or "avoid AI writing" -- generic AI phrasing (delve, "it's important to note," uniform sentence rhythm, formulaic transitions) is the default failure mode for LLM-written prose and should be actively avoided on every writing task, not just ones that call it out explicitly. Also trigger explicitly on requests like "humanize this," "make this not sound like ChatGPT," "remove AI writing tells," or "make this sound more natural."
---

# Humanize Writing

LLM output has a recognizable "accent": specific overused words, boilerplate
phrases, suspiciously uniform sentence rhythm, and a small set of formulaic
structural moves (rule-of-three lists, "not just X, but Y," a canned
challenges-and-future-outlook section). None of these individually proves a
piece is AI-written -- research on this is unanimous that no single word or
habit is a reliable tell, and reflexively stripping things like em dashes can
itself read as stilted. What actually reads as generic and machine-made is
*leaning on the whole cluster of defaults at once* instead of making real
choices. Full detail and sourcing: `references/signs-of-ai-writing.md`.

## How to use this

1. **Write the piece normally first.** Don't try to dodge every flagged word
   while composing -- that produces stilted, self-conscious prose, which is
   its own tell. Get the content and argument right first.

2. **Before delivering anything longer than a few sentences, do a pass
   against this checklist:**
   - **Vocabulary**: Did I reach for `delve`, `tapestry`, `underscore`,
     `robust`, `leverage`, `showcase`, `meticulous`, or similar by default?
     Would a plainer word actually communicate this better? (Latinate words
     like `utilize`/`facilitate` where `use`/`help` would do are the same
     pattern.)
   - **Boilerplate phrases**: Did I open with "In today's fast-paced world"
     or a "Picture this..." hook? Close with "In conclusion" or a summary
     that just restates the intro? Hedge with "It's important to note that"
     instead of just stating the thing?
   - **Sentence rhythm**: Are all my sentences roughly the same length? Real
     writing varies -- short sentences land punches, long ones carry
     complexity. If every sentence is 15-25 words, break that up.
   - **Structure**: Did every list default to exactly three items? Did I use
     "not just X, but Y" more than once? Is there a formulaic "despite its
     strengths, it faces challenges" section that I bolted on because that's
     the shape these things usually take, not because it's actually the best
     structure for this content?
   - **Specificity and voice**: Is there a real opinion, a concrete detail, a
     number, a proper noun -- something that could only have been written by
     someone who actually knows this situation? Or could this paragraph be
     dropped into any similar piece unchanged?
   - **Em dashes**: this one is genuinely overhyped (see the caveat in the
     reference file) -- don't panic and remove every legitimate em dash. Just
     notice if it's become your only tool for every explanatory aside.

3. **For anything long or high-stakes** (a full blog post, an important
   email, a document the user will publish or send unedited), run the
   bundled checker for an objective second opinion on vocabulary density and
   sentence-length variation:

   ```
   python scripts/check_ai_tells.py <path-to-draft>
   ```

   It flags banned-word/phrase hits, em-dash rate, and a "burstiness ratio"
   (sentence-length stdev / average -- below ~0.3 means suspiciously uniform
   rhythm). Treat the output as a prompt to look closer, not a pass/fail
   gate -- a clean report doesn't guarantee good writing, and a few hits in a
   long piece may be completely fine.

4. **Revise based on real judgment, not reflexive deletion.** If a flagged
   word is genuinely the right word here, keep it. The goal is writing that
   reads like it came from a specific person thinking about a specific
   thing, not writing that's been laundered to avoid a blocklist.

For the exhaustive vocabulary list, boilerplate phrase list, structural
patterns, and the research/citations behind all of this, see
`references/signs-of-ai-writing.md`.
