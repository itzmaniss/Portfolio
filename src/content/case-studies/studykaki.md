---
title: "Turn the wifi off: StudyKaki answers from your textbooks on OpenVINO"
description: "A student asks their Tamil textbook a question and gets an answer that cites the exact page, on a laptop with the wifi off. Every model runs on OpenVINO."
project: StudyKaki
role: Lead developer and architect, team of two
stack: [Python, OpenVINO, OpenVINO GenAI, OpenVINO Tokenizers, NNCF, Optimum Intel, PaddleOCR (PP-OCRv5), BGE-M3, bge-reranker-v2-m3, Gemma 4 E2B, Qwen3-4B, polars, PyMuPDF, pytest, uv]
publishedAt: 2026-10-28
repo: https://github.com/itzmaniss/StudyKaki
draft: false
---

## The demo starts by turning the wifi off

Turn the wifi off first; the runbook asks for it on camera. Then the question goes in, in Tamil: which logic values should be grouped on this Karnaugh map? The answer comes back in Tamil, one clean sentence, citing pages 163 to 165 of the digital electronics textbook it came from, with no network anywhere in the loop.

StudyKaki exists because of how students here actually study. Singapore students work in English, Tamil and Chinese, and the book you are examined on is the syllabus: a stack of PDFs, often not in English, often scanned. Help should come from those books, not a chatbot's memory of the open internet; it should work with no network; and the questions a student asks should stay on their own laptop. StudyKaki answers only from the documents you point it at, in English, Tamil or Chinese, every claim carrying a citation marker that resolves to a real page, and when retrieval finds nothing above threshold it says "I couldn't find this in your documents" instead of guessing.

I am in Singapore, and the corpus reflects what students around me actually study in: Class 12 computer science textbooks in Tamil and English (the English one is a page-parallel twin of the Tamil, which turned out to matter a lot), a Tamil digital electronics text, a Chinese internet report, two ITU reports. Eight documents, 2,595 chunks, every chunk carrying a document ID, page number and bounding box. The name is Singlish: a kaki is the buddy who sits next to you and points at the page.

## How it was built

This was an Intel hackathon entry: about six days and 83 commits, from the first commit on 22 August (the data schema and an eval harness running on a random retriever) to the last on 28 August (an ingest profiling write-up). In between: models converted, a corpus that fought back, and 24 numbered blockers, each logged with what was tried and where it landed.

The order was deliberate. The architecture contract came first, before any real component: the target machine, the data schema, and rules like no feature ships without an eval number and abstain beats hallucinate. The eval harness existed before the models did and printed deliberately meaningless numbers on day one. The golden set grew to 54 real questions with answers read off the pages they cite, and after that the harness gated every decision: the hybrid retriever shipped on +0.041 recall@5 for about a millisecond, the cross-encoder reranker was cut at 6.6 to 19.5 seconds per query, query rewrite measured nothing at all.

The components were built by coding agents working in parallel against that contract. The repo ships them an operating manual: work unattended, commit at every green checkpoint, never touch the contract, stop and write it down rather than guess. The first wave was four agents writing models, ingest, answer and telemetry at once; from there my job was verifying, integrating and debugging what landed. I wrote the contract, the schema and the eval harness, and made the calls the numbers could not make.

### The team

It was a team of two, and the commit history is the record. My teammate KKYH246 on GitHub did the Gemma 4 conversion on the Intel laptop, wired it in through the VLM pipeline when it turned out to export as multi-part IR, added the per-language eval columns and the config key that fixed cross-lingual language matching, ran the two-generator comparison that set the default, and branded the UI and wrote the demo runbook. 62 commits from me, 21 from KKYH246.

## The constraint is the point

The constraint is what makes this interesting: a student's laptop is the whole datacentre. The architecture contract targets an Intel Core i5 11th gen with Iris Xe graphics, 8 to 16 GB of RAM, no discrete GPU, and no network at runtime. Models download once, in a setup script; runtime code that touches the network is a bug by definition. The demo binds to 127.0.0.1 and loads no CDN font or script, so it genuinely works with the wifi off.

Every model in the pipeline is compiled to OpenVINO IR: no raw PyTorch in the runtime path, no second inference engine. Even OCR runs there: PaddleOCR's models are converted PIR to ONNX to IR at setup time.

| Stage | Model | Precision | Device intent | Runtime |
|---|---|---|---|---|
| Detection | PP-OCRv5 mobile det | INT8 | GPU | OpenVINO Runtime |
| Recognition | PP-OCRv5 mobile rec (+ Tamil, Latin heads) | INT8 | GPU | OpenVINO Runtime |
| Embedding | BGE-M3 | INT8 | GPU | OpenVINO Runtime |
| Generation | gemma-4-e2b-it (default) or qwen3-4b-instruct | INT4 | CPU | OpenVINO GenAI |
| Rerank (off) | bge-reranker-v2-m3 | INT8 | GPU | OpenVINO Runtime |

NNCF does the weight compression at export time: INT4 for the generators, INT8 for everything else. The default generator's IR is 4.3 GB on disk (Qwen3-4B's is 2.5 GB), and the whole system peaks around 8.5 GB of RSS, which is what makes a 4B-parameter generator viable on a thin laptop. Generation streams through OpenVINO GenAI so the first token paints immediately, and OpenVINO Tokenizers keeps tokenisation inside the runtime with no Python tokenizer in the hot path.

Device strings in config are intent, not a promise. The registry is the only loader: it tries the configured device, falls back to CPU, and reports what it actually got; the UI footer shows what loaded, never what the config asked for.

## The text layer that lies

The architecture said: if a PDF has a text layer, extract it with PyMuPDF and skip OCR. Sounds safe. It nearly destroyed the Tamil half of the project.

The fetched corpus reported a text layer on every document, so on that rule OCR would never run at all. The English volumes extracted cleanly. The Tamil volumes were pre-Unicode publications in legacy TAB/TAM ASCII fonts: the bytes are Latin-1 and only the embedded font maps them to glyphs. The page displays perfect Tamil while `get_text()` returns strings like `²ì¢® êó¤ò£ù`. Our script detector called it Latin. Nothing raised. The pipeline would have embedded mojibake with BGE-M3 and returned confident nonsense for every Tamil query with every test passing.

The fix: a validity check, not a presence check, with two signals measured against the real corpus: a legacy-encoding ratio above 0.25 rejects wholly mis-decoded 8-bit text, and a mixed-script token ratio above 0.15 rejects partially decoded layers where Latin fall-through fuses inside words. On 50-page samples, the two Tamil textbooks measured legacy ratios of 0.724 and 0.555 and were rejected to OCR; a Tamil electronics PDF with a partially broken layer measured fused tokens at 0.304 and was caught by the second signal; every English and Chinese document measured 0.009 or below and kept its fast path.

One failure worth keeping: the first draft of the check trusted any text containing a codepoint above U+0590, a cheap "non-Latin script exists" test. Mis-decoded CP1252 emits the trademark sign, U+2122, which sits above that floor, so the mojibake read as proof of a real script. The check now enumerates real script blocks explicitly.

The result inverted ingest: 1,939 of 2,617 pages skip OCR on their text layer, and the remaining 678 are exactly the three Tamil documents, rasterised at roughly 0.5 seconds per page of recognition against 0.1 for detection. Recognition is effectively the whole ingest wall time.

## Tamil blew the token budget

With the pipeline finally reading Tamil, the first Tamil eval question failed at generation:

```
GenerationError: qwen3-4b-instruct: generation failed on CPU:
[CPU] MatMul node 'Multiply_156855' could not create a primitive
descriptor for the matmul primitive
```

Not a model context limit. An OpenVINO INT4 CPU MatMul limit on that build, somewhere between 6.5k and 10.4k prompt tokens, which I bisected with 1, 2, 3 and 5 retrieved chunks. Tamil reaches it first because Tamil tokenises about twice as densely as English: measured at 1.10 characters per token against 2.33 for English and 1.62 for Chinese. The same five chunks that cost an English question 4,704 tokens cost a Tamil question 10,367.

What hid it: retrieval-only eval reported recall@5 of 0.898, healthy, while the system could not answer a single Tamil question. Retrieval was fine; generation was the one stage the harness was not exercising.

The fix, in `answer/prompt.py`, treats the number of context blocks as a request, not a guarantee: blocks are dropped from the tail, highest-scoring first to survive, until the prompt fits a 6,000-token budget.

Two details made the fix trustworthy. Sizing uses the generator pipeline's own tokenizer, exact, because the chunker's whitespace word count undercounts Tamil subwords roughly sevenfold and would have reproduced the crash while looking correct. Block text is never truncated: that would hold the citation count up while citing a page whose text the model never saw.

## The metrics flattered us

The eval harness was built on day one with a random retriever, before any real component existed, and that habit paid for itself three times.

First, groundedness, the fraction of emitted citation markers that resolve to retrieved context, scored a malformed string of non-Tamil characters with a valid citation attached at a perfect 1.00. It measures whether citations resolve, never whether answers are any good, and on Tamil it was blind.

Second, pooled groundedness of 0.844 hid Tamil scoring 0.000 across all six questions: 41 good English and Chinese rows drowned six zeros, model-side abstentions were excluded from the average, and the abstained column tracked only the retrieval gate. A question where retrieval succeeded and generation refused contributed a clean recall of 1.0 and nothing else. The fixes: per-language breakdowns, model refusals counted apart from retrieval gates, and an answer-language-match column that turns "answers come back in the asking language" into a number.

That column caught a real bug. On cross-lingual questions (English question, Chinese or Tamil source), the default generator answered in the document's language 9 times out of 12, despite a system instruction forbidding exactly that. The fix was a config key, not a prompt rewrite: restate the question's language between the context and "Answer:". A/B over those 12 questions moved language matching from 3/12 to 12/12, groundedness from 0.781 to 0.796 and Tamil from 0.667 to 0.833, and made the system faster (median generate 13.7s to 12.6s), because answering in the wrong language costs tokens. Chinese output ran about five times slower per token on this build, a result I cannot fully explain and have documented rather than hand-waved.

## What the numbers say

Final measured state on an Intel Core Ultra 7 255H, 54 golden questions, identical retrieval for both generator rows (recall@5 0.898, recall@10 0.980, MRR@10 0.743, abstain precision 1.000):

| Generator | Groundedness | Tamil | Chinese | Median generate |
|---|---|---|---|---|
| gemma-4-e2b-it INT4 (default) | 0.796 | 0.833 | 0.900 | 12.6 s |
| qwen3-4b-instruct INT4 | 0.935 | 1.000 | 0.900 | 29.5 s |

The default trades quality for speed, and the trade is written into the config with both rows and their numbers, so switching is a documented two-line edit. Peak RSS differs by less than 1% between them (8.46 vs 8.52 GB).

Two findings worth repeating. The abstention threshold tau had to be recalibrated when Tamil cross-lingual questions joined the golden set: their top-1 cosine sits at 0.460 to 0.542 where monolingual Chinese sits at 0.731 to 0.783, and unanswerable questions score up to 0.692. The safe window for one global threshold collapsed to about 0.01 of width, which is the honest argument for per-script thresholds, or for letting the generator decline instead. And on the 255H's NPU, the VLM generator loads, reports no fallback, and emits token salad: CPU answers correctly in 12.6s, the NPU produces garbage in 34.2s. A fallback that fires only on load failure cannot catch a device that loads and lies, so the config never asks for the NPU, and the blocker records exactly why.

## Trade-offs, and what I would do differently

The retrieval stack is deliberately plain: a flat float32 index with exact cosine over 2,595 chunks, no ANN, because at corpus scale exact is fast and has no recall to apologise for. The V2 experiments respected the "no component ships on vibes" rule: hybrid dense plus BM25 gained 0.041 recall@5 for about a millisecond of cost, the cross-encoder reranker gained less and cost 6.6 to 19.5 seconds per query, worst on Tamil, so it was cut on cost; query rewrite measured no effect at all. All three arms sit in the config, default off, each with its before and after number.

What I would change: the dev machine was an Apple Mac, not the Intel target, and that cost me three classes of phantom bug (no GPU plugin, arm64 tokenizer precision traps, NNCF reduce ops with no arm64 executor), so models get converted on Intel hardware only. Groundedness needs a companion metric with teeth on generation quality; chrF against a reference would do, because a study tool where Tamil word salad scores perfectly is not measured yet. The abstention message is still hardcoded English even when the question is Tamil. And the biggest untapped win is structural: decoding the legacy Tamil encodings directly instead of OCR-ing 678 pages would take ingest to near zero.

Next: OCR on the iGPU, which the config already asks for and no machine here has exercised; the hybrid retriever on after a confirming eval run; Tamil citation formatting reliable enough that all six demo questions are camera-safe.

Six days of calendar time, 83 commits, 875 tests passing, every number here reproducible from the repo's eval scripts. The real product is not a demo that works once; it is a system that can prove why it behaves the way it does.
