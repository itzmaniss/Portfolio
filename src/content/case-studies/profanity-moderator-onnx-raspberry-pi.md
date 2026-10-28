---
title: "My 1.1 GB toxicity model couldn't fit on the Pi it was built for"
description: "It flagged 'i call polis ah' as toxic and weighed 1,112 MB on a 2 GB Raspberry Pi. Shrinking it to 124 MB was the easy part. The audit was the point."
project: profanity-moderator
role: Solo developer
stack: [Python, PyTorch, Hugging Face Transformers, XLM-RoBERTa, ONNX, ONNX Runtime, SentencePiece, polars, scikit-learn, Raspberry Pi]
publishedAt: 2026-10-28
repo: https://github.com/itzmaniss/profanity-moderator
draft: false
---

## "i call polis ah" is not an insult

In Singapore chat, "i call polis ah" is a punchline you drop on someone overreacting. My toxicity model scored it as toxic. It also scored "shiok sia that was good", which is praise, probably for food. Both are marked non-toxic in the project's own rules file. The model never saw the rules, only the data, and the data taught it to read sentence scaffolds instead of meaning.

Then there was the other problem. The exported model was 1,112 MB of fp32 weights, and the machine it was built for is a Raspberry Pi 4 with 2 GB of RAM. The weights alone want more than half the box's memory before the operating system takes its share.

## Why moderation belongs on the device

The use case is moderation for small community chats, where a volunteer admin, at best, keeps an eye on things. That shape argues for running the model on the box. Moderation is per-message by definition, so a hosted API means a network round trip and a per-call bill on every message, forever, while on the device one more message costs nothing. Chat is also where people type things they would never post publicly, and forwarding all of it to a third party just to ask if it is abusive adds another party to every conversation. Inference on the box keeps the text where it was typed.

The last reason is language. The text I care about switches mid-sentence between English, Malay, romanised Hokkien, Mandarin pinyin and Indonesian. Generic filters misread the local rules of offence, where "i call polis" is a joke and Bich Ngoc is just a name. Getting this right needs a model trained on this text, on hardware I control.

## How the model got built

### The rules file came first

Before any text exists, the repo records the labelling policy in dataset_rules.md, and its decisions are all about local context. "I call polis" is always non-toxic, because in Singapore it is humour. Names that naive filters tend to flag, like Kok Wei, Shi Ting and Bich Ngoc, are oversampled in both toxic and clean rows. Strong slurs and their leetspeak spellings stay in; low-signal insults like "jerk" and "loser" are dropped. The particle "sia" is an insult in one phrase and a friendly intensifier in another, so it appears on both sides of the ledger. The file also targets roughly 60 to 65 percent non-toxic; the data landed at 70 percent, one of several gaps the audit later made impossible to ignore.

### The dataset is templates, on purpose

The dataset is 50,226 rows, 70 percent clean and 30 percent toxic, generated mostly from templates rather than scraped. Templates make the balance controllable and the rules enforceable: a name can be oversampled into both classes, "sia" can sit in a hostile phrase and a friendly one, and nobody's real abuse ends up in a public repo. They also make every toxic row look structurally alike, which is the seed of this project's near-failure. I will get to that after the model is built.

### Fine-tuning and a first export

The classifier is XLM-RoBERTa base with a binary head: 278 million parameters, fine-tuned for three epochs at batch size 8 on Apple Silicon MPS. The first export passed no dynamic axes, which hard-locked the input to [1, 128]. ONNX Runtime rejected a batch of two with INVALID_ARGUMENT, and every message paid for 128 tokens of attention even though the longest row in the dataset is 14 words.

That first artifact measured 1,112 MB and 83 ms per message on my laptop CPU. A Pi would be several times slower. Every number here comes from the audit in docs/improvement_plan.md, next to the code that produced them.

### Pruning the vocabulary that serves 100 languages

XLM-R base spends 192 million of its 278 million parameters, 69 percent, on the word-embedding table: 250,002 rows of 768 floats, 768 MB in fp32, covering 100 languages. My dataset is 100 percent Latin script because every multilingual toxic term in it is romanised. CJK and Tamil embeddings buy nothing until training data exists in those scripts.

The prune runs in two stages: keep only tokens whose characters are Latin, plus symbols, then keep the 48,000 most frequent of those and union in every id my corpora touch, however rare, plus the specials. The ordering matters. XLM-R's ids follow global frequency, so the top 32k is full of Cyrillic and Arabic while the Malay and romanised-Hokkien tokens this project needs sit above id 200,000. A naive "keep the head" prune would have deleted exactly the vocabulary I care about. What remains is 48,150 ids, and the fp32 model drops from 1,112 MB to 492 MB before any quantisation.

The dangerous part is invisible. The pruned checkpoint renumbers ids densely, but the sentencepiece tokenizer still emits original ids, so training and inference must both sit behind a remapping wrapper: without it the model silently reads the wrong embeddings, and nothing raises because every id stays in range.

```python
def remap(ids):
    return [self.old_to_new.get(i, self.unk_id) for i in ids]
```

Anything pruned away becomes an unk token, and vocab_remap.py has an unk_rate() check: above a percent or so on held-out text, the kept vocabulary is too small for real traffic.

### Quantising to int8, and exporting properly

Dynamic quantization needs no calibration data: onnxruntime's quantize_dynamic converts weights to QInt8 ahead of time and leaves activations at runtime precision. On the full-size graph it cut 4.0x on its own, 1,112 MB down to 279 MB. Combined with pruning, the final int8 model is 124 MB.

The re-export also fixes the shape lock, marking both batch and sequence dynamic at opset 14:

```python
torch.onnx.export(
    model, (dummy_ids, dummy_mask), f"{output_path}/model.onnx",
    opset_version=14, do_constant_folding=True,
    input_names=["input_ids", "attention_mask"], output_names=["logits"],
    dynamic_axes={
        "input_ids": {0: "batch", 1: "sequence"},
        "attention_mask": {0: "batch", 1: "sequence"},
        "logits": {0: "batch"},
    },
)
```

Sequence length is capped at 64. The corpus median is 10 tokens and the p95 is 16, so 64 is headroom rather than padding. A smoke test pushes shapes (1, 8), (1, 64) and (4, 16) through the graph before anything ships. The whole pipeline, split through quantisation, runs end to end from main.py, and the .onnx files are tracked in git LFS.

### What it added up to

Measured on the laptop CPU and recorded in the audit:

| Variant | Size | Latency |
|---|---|---|
| fp32, fixed [1,128] input | 1,112 MB | 83.0 ms/msg |
| vocab-pruned, int8, dynamic length | 124 MB | 5.2 ms/msg |

9.0x smaller, 16x faster. The speedup compounds three changes: int8 weights, at about 1.7x, the smaller embedding lookup, and dynamic sequence length, since attention cost scales with length and the old export padded every message to 128 tokens.

One caveat stays with these numbers: size and latency were measured on the pruned architecture before retraining it on repaired data, so the accuracy column is deliberately empty. The shrinking is proven. The quality waits for the data fix, and finding that out honestly is the part of this project I value most.

## The audit: the part I value most

Shrinking a model is easy. Knowing whether it deserved the space is harder, so I wrote a 96-row probe set, balanced and categorised, with 93 of its rows absent from training data, and ran the exported model on it.

On a 300-row sample from the training distribution, the model scored ROC-AUC 0.9987. On the held-out probes it scored 0.7288. At the default threshold of 0.5 it caught one toxic message out of thirty, and the misses included spaced-out and leetspeak variants of the most severe slurs. The best available threshold, 0.38, buys recall at the cost of flagging 33 of the 66 clean messages.

The root cause is in the data, and I can point at the tokens. Words like "such", "typical" and "stop being" appear more than a thousand times each in toxic rows and effectively never in clean ones, because the toxic templates look like "stop being a [slur]" while the clean rows use unrelated scaffolds. The model learned the scaffold. 15,068 toxic rows come from only 6,698 distinct skeletons, and single templates account for more than 2,500 rows each.

The clearest sign was a baseline. A TF-IDF bag-of-words model with logistic regression, trained in two seconds at under 5 MB, scores F1 0.9987 on the same validation split as the 278-million-parameter transformer. When a linear model ties a transformer, the benchmark is measuring memorisation. The old challenge set made this worse: every row was labelled clean, so it could only ever catch false positives, and 54 percent of it appeared verbatim in the training data.

The failure even broke my own rules: the probe flagged "i call polis ah" and "shiok sia that was good" as toxic. This is the least flattering number in the repo and the most useful one, because everything that came after exists because of it. scripts/eval_model.py prints precision, recall, F1, latency percentiles, per-category accuracy and every misclassified row, so the next model gets judged by the harness that convicted this one.

### Splitting by template, not by row

The first repair was to the measurement. scripts/split_dataset.py groups rows by skeleton, the sentence with its rare tokens masked as filler slots:

```python
def skeletonize(text: str) -> str:
    parts = [t if freq.get(t, 0) >= min_freq else SLOT
             for t in TOKEN_RE.findall(text.lower())]
    return re.sub(rf"({re.escape(SLOT)} )+", f"{SLOT} ", " ".join(parts))
```

Whole skeletons go to one side of the split, largest first, per class. The result is a 70/15/15 split with zero skeleton overlap and 30.0, 30.1 and 30.1 percent toxic in train, validation and test. From now on a validation score means generalisation to unseen templates, not recall of seen ones.

## What the retrain plan fixes

Phase two is the data, and the plan states it as concretely as the failure. Decorrelate scaffolds from labels, so every toxic template also appears with benign fillers and every benign scaffold with toxic ones: "stop being a [slur]" needs "stop being so shy" as its counterpart. Cap any single skeleton at about 50 rows, against single templates that currently hold more than 2,500. Mix in public corpora for length and phrasing diversity, because every current row is under 68 characters and production chat is not; the plan names Jigsaw Toxic Comments, HateCheck and OLID, with HateCheck singled out for the functional tests this project needs. Add the hard negatives the data has none of: profanity used as an intensifier, people quoting or reporting abuse, counter-speech. The label policy for those is already decided: reclaimed profanity and quoting or reporting abuse are non-toxic.

Then retrain on the template-aware split, calibrate with temperature scaling so 0.5 becomes a meaningful cutoff, and pick the threshold from a precision-recall curve instead of inheriting a default. The current model compresses its probabilities into a 0.25 to 0.51 band on hard inputs, so there is barely any separation to threshold on. After that, rerun the same probe set on the Pi itself.

The goal for the next version is that every number attached to it, size, latency and accuracy, is measured on the hardware it runs on. The cheapest place to find out your model does not work is your own eval harness, before the model reaches the device.

## Trade-offs, serving, and credit

### What I traded away

The vocabulary is Latin-only by decision; the prune script takes a scripts flag for the day CJK or Tamil training data arrives. Dynamic int8 quantisation trades a little control for needing no calibration set, and static quantisation is not worth chasing until the accuracy problem is solved.

The base model is arguably too large for the task as posed, given that a linear model ties it on the old split. The bet is implicit toxicity: abuse that contains no profanity at all, which a bag-of-words model cannot catch and which the dataset contains none of. If a retrained transformer does not beat the linear baseline on honest held-out data, the smaller model wins.

### How it gets served

The serving shape comes from the earlier repo in this story, toxicity-mod. A FastAPI app builds the ONNX session once with the CPU execution provider, /toxic returns the toxic-class probability for a message, and /feedback appends the timestamp, text, predicted confidence and the human's verdict to a CSV that feeds the next training round. The Dockerfile is python:3.10-slim running uvicorn, deliberately boring.

That CSV holds exactly one row, from September 2025. It proved the loop worked. It did not prove anyone was waiting for the model, which is the gap the Pi target is meant to close.

### Credit

This is solo work: the rules file, the template data, the training pipeline, the audit scripts and the prune and quantise code are all mine, and so are the failures the audit found.

The parts I did not make deserve their own lines. XLM-RoBERTa is by Alexis Conneau and colleagues at Meta AI, then Facebook AI, in the paper "Unsupervised Cross-lingual Representation Learning at Scale"; this project fine-tunes their base checkpoint. The pipeline leans on Hugging Face Transformers, SentencePiece and ONNX Runtime, all open source. The phase-two plan names public datasets it may borrow from, Jigsaw Toxic Comments, HateCheck and OLID; none appear in the current training data.
