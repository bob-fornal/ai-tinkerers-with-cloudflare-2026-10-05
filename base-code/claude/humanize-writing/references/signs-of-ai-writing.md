# Signs of AI Writing — Full Reference

Source material: a multi-source research pass across Wikipedia's "Signs of AI writing" guideline, NLP/stylometric papers (e.g. arXiv:2507.00838, arXiv:2509.10179), journalism (Rolling Stone, Reuters Institute, NPR, Washington Post), and detection-tool writeups (Pangram, Originality.ai-adjacent blogs, plagiarismtoday.com). Full citations at the bottom.

Use this as a lookup table, not a script to follow line by line — read the "How to use this" note in SKILL.md first.

## 1. Vocabulary hit list

These words are individually harmless — the tell is *density*. One or two in a long piece is invisible; three or four in a short email reads as a template.

`delve`, `tapestry`, `pivotal`, `underscore(s)`, `foster(ing)`, `testament`, `enhance`, `crucial`, `intricate/intricacies`, `landscape`, `boast(s)`, `bolstered`, `garner`, `showcase`, `meticulous(ly)`, `robust`, `vibrant`, `realm`, `beacon`, `multifaceted`, `noteworthy`, `kaleidoscope`, `nuanced`, `comprehend`, `commendable`, `resonate`, `navigate`, `illuminate`, `profound`, `compelling`, `seamless`, `transformative`, `ever-evolving`, `dynamic`, `invaluable`, `synergistic`, `thought-provoking`, `exemplary`, `adept`, `aspect`, `complexity`, `leverage` (as a verb), `synergy`, `paradigm shift`, `elevate`, `unlock`, `unleash`, `game-changing`, `groundbreaking`, `revolutionize/revolutionary`

**Latinate-over-plain substitutions** — a pattern, not just a word list: `utilize`→use, `commence`→start, `facilitate`→help, `endeavor`→try, `ascertain`→find out. If you notice you've reached for the fancier Latin-root word by default, check whether the plain one reads better.

**Travel-brochure / puff phrasing**: `nestled`, `in the heart of`, `rich cultural heritage`, `vibrant`, `diverse array`, `natural beauty`.

## 2. Boilerplate phrases (near-automatic flags — avoid these specifically)

- "It's important to note/consider that..."
- "It's worth noting that..."
- "A testament to..."
- "In today's fast-paced/digital world..."
- "Imagine a world where..." / "Picture this..."
- "Let's dive deeper into..." / "Let's delve into..."
- "In conclusion," / "In summary," / "Overall," as a conclusion opener
- "I hope this email finds you well"
- "This is not an exhaustive list, but..."
- "Not just X, but also Y" / "It's not just X, it's Y"
- "Despite its [positives], [subject] faces challenges..." (the canned "challenges and future outlook" template)
- Literal leftover disclaimers: "As an AI language model..."

## 3. Sentence & paragraph structure

- **Low burstiness**: every sentence lands in the same 15–25 word band. Real human writing swings between short punches and long, winding sentences in the same paragraph.
- **Rule of Three on autopilot**: reflexively grouping examples, adjectives, or clauses into triads ("No hardware. No fees. Just growth."). Occasional triads are fine; every list defaulting to exactly three items is the tell.
- **Negative parallelism**: "not just X, but Y," "X rather than Y" — powerful once, formulaic when it's the go-to move for every contrast.
- **Uniform paragraph blocks**: everything is 3–5 lines, nothing is ever a single punchy sentence.
- **Echoed openers**: starting consecutive paragraphs or sections with the same structural move ("An analysis of...", "The findings suggest...", "Research shows...").
- **Suspiciously clean grammar**: no fragments, no comma splices, no sentence starting with "And" or "But," Oxford comma applied with 100% consistency, contractions almost never used. Real human prose is grammatically messier than this on purpose sometimes, for rhythm.

## 4. Tone & voice

- Hedging everything ("might," "could," "arguably," "potentially," "it is important to consider") rather than committing to a claim.
- No first-person specificity, no anecdote, no opinion that could be wrong — writing that could have been said by anyone about anything.
- Vague pronouns without a clear antecedent ("their," "this") and nominalizations that hide who's doing what ("implementation was undertaken" instead of "we built it").
- Uniformly warm/positive tone that never pushes back or takes a side.
- Broad, sweeping claims ("X isn't just a tool, it's a revolution") standing in for a specific, falsifiable one.

## 5. Punctuation & formatting

- Em dash as a crutch for every explanatory aside — see the caveat below, this one is genuinely contested.
- Reflexive bolding of key phrases and heavy bullet use in something that should just be prose.
- Curly "smart quote" artifacts and a "**Bold Header:** description" pattern repeated down a list.

## 6. Content patterns

- Formulaic "challenges and future outlook" section that praises, then pivots to vague concerns, in every piece regardless of topic.
- Generic content with no proper nouns, no concrete numbers, nothing that could only have been written by someone who was actually there.
- An unwarranted concluding paragraph that restates the intro almost verbatim.

## Important caveat: em dashes specifically

The "AI uses em dashes" claim is the most viral of these signs and also the most overstated. Testing across six AI systems found wildly different rates — ChatGPT/Copilot/DeepSeek used 8–9 per article, Claude used 2, Gemini and Meta.ai used **zero**. Washington Post, NPR, and McGill University reporting all found "precious little evidence" that ChatGPT overuses em dashes relative to professional human writers, and writers like Emily Dickinson and Nietzsche used them heavily long before any of this existed. Treat em-dash density as one weak signal among many, not a tell on its own — don't strip every legitimate em dash out of a piece just to be safe; that itself can read as stilted.

## Why none of this is a rulebook

Every serious source on this converges on the same warning: no single word or habit proves anything. A "VERMILLION"-style framework or a detector only becomes meaningful from the *co-occurrence* of many of these markers at once. AI-text detectors themselves are unreliable enough that OpenAI retired its own classifier (26% catch rate, 9% false-positive rate on human writing), and they're measurably biased against non-native English speakers. So the goal here isn't "never use the word 'delve'" — it's noticing when a piece is leaning on the *whole cluster* of these defaults at once, because that's what actually reads as generic and machine-produced.

## Sources

- [Wikipedia: Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)
- [makeuseof.com — Wikipedia's AI writing detection guide](https://www.makeuseof.com/wikipedia-best-ai-writing-detection-guide/)
- [medium.com/the-generator — spotting AI writing via Wikipedia's list](https://medium.com/the-generator/want-to-get-better-at-spotting-ai-writing-start-with-wikipedias-new-list-c5bb19761475)
- [reutersinstitute.politics.ox.ac.uk — how AI prose diverges from human writing](https://reutersinstitute.politics.ox.ac.uk/news/how-ai-generated-prose-diverges-human-writing-and-why-it-matters)
- [the-decoder.com — Reddit users compile AI word list](https://the-decoder.com/reddit-users-compile-list-of-words-and-phrases-that-unmask-chatgpts-writing-style/)
- [medium.com/learning-data — words/phrases that reveal ChatGPT](https://medium.com/learning-data/words-and-phrases-that-make-it-obvious-you-used-chatgpt-2ba374033ac6)
- [medium.com/everyday-ai — 15 phrases that prove you used ChatGPT](https://medium.com/everyday-ai/these-15-phrases-prove-you-used-chatgpt-and-everyone-can-tell-53accf90a742)
- [oliviacal.com — AI writing tells](https://www.oliviacal.com/post/ai-writing-tells)
- [arXiv:2507.00838 — stylometric detection of LLM text](https://arxiv.org/abs/2507.00838)
- [arXiv:2509.10179 — Biber multidimensional analysis of LLM vs human register](https://arxiv.org/abs/2509.10179)
- [researchleap.com — the VERMILLION framework](https://researchleap.com/the-disappearing-author-linguistic-and-cognitive-markers-of-ai-generated-communication/)
- [plagiarismtoday.com — em dashes, hyphens, and spotting AI writing](https://www.plagiarismtoday.com/2025/06/26/em-dashes-hyphens-and-spotting-ai-writing/)
- [atomwriter.com — AI transition-word overuse](https://www.atomwriter.com/blog/ai-transition-words-overuse/)
- [vrid.ai — signs of AI writing](https://vrid.ai/blog/signs-of-ai-writing)
- [pangram.com — guide to spotting AI writing patterns](https://www.pangram.com/blog/comprehensive-guide-to-spotting-ai-writing-patterns)
- [humtech.ucla.edu — imperfection of AI detection tools](https://humtech.ucla.edu/technology/the-imperfection-of-ai-detection-tools/)
- [rollingstone.com — the ChatGPT em dash debate](https://www.rollingstone.com/culture/culture-features/chatgpt-hypen-em-dash-ai-writing-1235314945/)
