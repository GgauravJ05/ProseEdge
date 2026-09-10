# ProseEdge: On-Device Text Formatting with a Measured Accessibility and Engagement Model

> **Technical Specification & Research Plan**
> *Domain:* On-device inference, model compression, text ranking, accessibility engineering
> *Status:* Design phase — no results claimed until the evaluation harness in §8 produces them.

---

## 0. How to Read This Document

Every performance and quality claim in this spec is written as a **hypothesis with a measurement attached**, not as a feature. Numbers appear as `TBD` until the corresponding benchmark or eval script fills them in. This is deliberate: the credibility of the project rests on the evaluation harness, not on the feature list.

Three things make this project defensible in a technical interview:

1. **A learned model trained on real human engagement signal**, with a task design that controls for the obvious confounders.
2. **A compression pipeline with a published accuracy/latency/memory trade-off curve**, not a single dropped-in checkpoint.
3. **An empirical accessibility result** — measured screen-reader degradation, not a heuristic score.

Everything else is application scaffolding that exists to make those three things usable.

---

## 1. Problem Statement

Professional social platforms (LinkedIn, X, Threads) have no rich-text support. To emphasize text, authors substitute **Unicode Mathematical Alphanumeric Symbols** (U+1D400–U+1D7FF) for ASCII letters — `𝗕𝗼𝗹𝗱` instead of **Bold**.

This has two consequences:

* **Accessibility failure.** Screen readers announce these codepoints by their Unicode names ("Mathematical Sans-Serif Bold Capital B") or skip them entirely, depending on the reader and its punctuation/symbol verbosity setting. A styled post can become unintelligible to a screen-reader user. The scale of this degradation has not, to our knowledge, been systematically measured.
* **No feedback signal.** Authors have no way to evaluate structural choices — opening line, fold placement, whitespace density — before publishing.

**ProseEdge** is a local-first editor that addresses both: it maintains a reversible mapping between styled output and source ASCII, quantifies the accessibility cost of each styling decision against real screen-reader behavior, and scores openings with a compressed ranking model that runs entirely in the browser.

### Explicit non-goals

* Not a growth-hacking or engagement-maximization tool.
* Not a LinkedIn automation client. No scraping, no posting, no account access.
* Not a general writing assistant.

---

## 2. Research Questions

The project is organized around four questions that have measurable answers:

| # | Question | Metric | Section |
| :-- | :--- | :--- | :--- |
| RQ1 | Can short-form opening quality be learned from public engagement data once platform, timing, and author confounders are controlled? | Pairwise accuracy vs. 50% baseline | §5 |
| RQ2 | How much of that ability survives transfer to a different platform's writing register? | Accuracy drop on held-out human-labeled transfer set | §5.5 |
| RQ3 | How much accuracy is lost per unit of latency/size gained through distillation and quantization? | Pareto curve: accuracy × p95 latency × MB × peak memory | §6 |
| RQ4 | How much does Unicode styling actually degrade screen-reader output? | Word Error Rate of screen-reader transcript vs. source ASCII | §7 |

RQ4 is the most novel. RQ1–RQ3 are well-trodden individually but are rarely executed end-to-end with honest reporting.

---

## 3. System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Browser (no backend)                     │
├───────────────────────────┬──────────────────────────────────┤
│  Document Model           │  Inference Runtime (Web Worker)  │
│  ───────────────          │  ──────────────────────────────  │
│  • Typed document tree    │  • ORT Web: WebGPU → WASM fallback│
│  • Style spans (source    │  • Ranker: distilled encoder,     │
│    ASCII always retained) │    INT8, batched over candidates  │
│  • Reversible render:     │  • Rewriter: SLM, q4f16,          │
│    tree → Unicode         │    streaming, KV-cache reuse      │
│  • Transform invariants   │  • Backend probe + capability     │
│    (§4.2) enforced        │    gating on load                 │
├───────────────────────────┴──────────────────────────────────┤
│  Analysis Layer                                               │
│  • Accessibility model (§7) — empirically calibrated          │
│  • Fold estimator — measured glyph widths, not char counts    │
│  • Readability (Flesch–Kincaid) — computed on source ASCII    │
├──────────────────────────────────────────────────────────────┤
│  UI: block canvas · fold preview · inline diff · score panel  │
└──────────────────────────────────────────────────────────────┘
```

Nothing leaves the device. Model weights are fetched once from a static CDN and cached; all inference is local.

---

## 4. Document Model

### 4.1 Representation

The document is a typed tree, not a flat block list. It has a small grammar, and every editor operation is a tree rewrite that must preserve the invariants in §4.2. This is what makes the "structural editor" framing honest rather than decorative.

```
Document  := Section+
Section   := Hook | Body | CTA
Hook      := Paragraph{1,2}
Body      := (Paragraph | List)+
CTA       := Paragraph | Link
Paragraph := Span+
Span      := { text: string /* ASCII source, always */, style: StyleSet }
```

```typescript
type StyleKind = 'bold' | 'italic' | 'bold_italic' | 'monospace' | 'script' | 'sans';

interface Span {
  id: SpanId;
  /** Canonical ASCII source. Never mutated by styling. */
  text: string;
  style: ReadonlySet<StyleKind>;
}

interface RenderResult {
  /** Unicode-substituted output for the target platform. */
  output: string;
  /** Codepoint-level provenance: output index -> source span + offset. */
  provenance: ReadonlyArray<{ span: SpanId; offset: number }>;
}
```

Keeping ASCII as the source of truth — rather than storing styled text and trying to parse it back — is what makes reversibility, readability scoring, and model input all correct by construction.

### 4.2 Transform Invariants (property-tested)

These are enforced by property-based tests (`fast-check`) over generated documents, not by spot checks:

1. **Round-trip:** `normalize(render(doc)) === sourceText(doc)` for every document and every style combination.
2. **Idempotence:** applying a style twice equals applying it once.
3. **Provenance totality:** every codepoint in the output maps to exactly one source position.
4. **Grapheme safety:** rendering never splits a grapheme cluster; emoji, ZWJ sequences, and combining marks pass through unmodified.
5. **Coverage honesty:** characters with no mapping in a given style (digits in `script`, most punctuation) are left as ASCII and reported, never silently dropped or substituted with a lookalike.

Invariant 5 matters more than it looks — most existing Unicode text stylers fail it, producing mixed-style output the author never sees.

---

## 5. Engagement Ranking Model (RQ1, RQ2)

This is the ML core. It replaces the previous spec's unsourced "fine-tuned DeBERTa hook classifier."

### 5.1 Data

No LinkedIn data is used. Scraping it violates the platform's terms and there is no licensed corpus. Instead, two public sources of short text with genuine human engagement signal:

| Source | Access | Fields | Scale target |
| :--- | :--- | :--- | :--- |
| Hacker News | Official Firebase API (public, documented, rate-limited) | title, points, timestamp, author, comment count | ~2M submissions |
| Reddit | Public academic dumps (Pushshift-derived, non-commercial use) | title, score, subreddit, timestamp, author karma bucket | ~10M submissions, text-heavy subs only |

Both are collected once into a versioned, checksummed snapshot. The snapshot manifest (date range, filters, row count, SHA256) is committed; the raw data is not.

### 5.2 Task design — the part that matters

**Do not regress on raw score.** Upvote counts are dominated by confounders that have nothing to do with the text: which subreddit, what hour it was posted, how many followers the author has, and rich-get-richer dynamics from early votes. A model trained on raw scores learns to predict the subreddit, and will look excellent on a random split while being worthless.

Instead: **stratified pairwise ranking.**

* Form pairs `(a, b)` only when both posts share the same **community**, the same **6-hour time bucket**, and the same **author-karma decile**.
* Keep a pair only if the score ratio exceeds a margin `τ` (start at 4×), so the label reflects a real difference rather than noise.
* Label: which of the two received more engagement.
* Model: cross-encoder scoring each title independently, trained with a margin ranking loss.

**Metric:** pairwise accuracy against a 50% chance baseline.

**Mandatory baselines** — the model must beat all of these to be worth anything:
1. Random (50%).
2. Title length alone.
3. TF-IDF + logistic regression.
4. Frozen sentence-embedding + linear probe.

**Split discipline:** split by **time** (train on earlier, test on later) and additionally hold out entire communities to test generalization to unseen registers. A random row-level split leaks and inflates results; it will not be used.

**Negative-result policy:** if the model does not clear the TF-IDF baseline by a meaningful margin on a temporal split, that is reported in the README as a finding. A well-documented negative result with correct methodology is more impressive than an unfalsifiable claim.

### 5.3 Model

* **Teacher:** `deberta-v3-base` cross-encoder, fine-tuned on the pair set.
* **Student:** 6-layer MiniLM or `distilbert-base`, trained on teacher logits (KD) plus the hard labels.
* **Rationale for distillation:** the browser budget is the constraint. §6 quantifies exactly what the compression costs.

### 5.4 Calibration

A raw ranking score is not a user-facing number. Scores are calibrated to percentiles against a fixed reference distribution, and the UI shows a **percentile band with an uncertainty range** — never a false-precision "Hook Score: 87/100." Calibration quality is reported via expected calibration error and a reliability diagram.

### 5.5 Transfer evaluation (RQ2)

Reddit/HN register differs substantially from professional posting. To measure the gap honestly:

* Construct a held-out set of **~400 preference pairs** of LinkedIn-style openings, labeled by multiple human annotators.
* Report inter-annotator agreement (Krippendorff's α). If agreement is low, that is itself the finding — it means the target construct is poorly defined, and the README says so.
* Report accuracy on this set alongside in-domain accuracy. **The gap is a headline number, not a footnote.**

---

## 6. Compression & Runtime Performance (RQ3)

This section is the systems contribution and produces the table a hardware/infra interviewer will actually read.

### 6.1 Export pipeline

`PyTorch → ONNX (opset pinned) → graph optimization → quantization → numerical parity check`

Parity is verified by comparing logits between the PyTorch and ONNX paths on a fixed probe set, asserting max absolute deviation below a set threshold. A silently wrong export is the most common failure mode in this pipeline and the check is non-optional.

### 6.2 Ablation table (to be filled by `bench/`)

| Variant | Params | Precision | Size (MB) | Pairwise Acc | p50 (ms) | p95 (ms) | Peak mem (MB) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Teacher (DeBERTa-v3-base) | 184M | FP32 | TBD | TBD | TBD | TBD | TBD |
| Student | 22M | FP32 | TBD | TBD | TBD | TBD | TBD |
| Student | 22M | FP16 | TBD | TBD | TBD | TBD | TBD |
| Student | 22M | INT8 dynamic | TBD | TBD | TBD | TBD | TBD |
| Student | 22M | INT8 static | TBD | TBD | TBD | TBD | TBD |

Each latency cell is measured on **WebGPU and WASM (SIMD, 4 threads) separately**, across at least three device classes (discrete GPU desktop, integrated-GPU laptop, mobile), reported as median of N≥100 runs after warmup. Device specs are recorded with the results.

### 6.3 Generative rewriter

* **Model:** `Llama-3.2-1B-Instruct` at `q4f16`, or `SmolLM2-360M-Instruct` for low-end devices.
  *(Note: the earlier draft referenced "SmolLM-1.3B", which does not exist. SmolLM2 ships at 135M / 360M / 1.7B.)*
* **Measured, not asserted:** cold-load time, time-to-first-token, decode tokens/sec, peak memory — per backend and device class.
* **Honest framing:** this is **not** "zero latency." It is a multi-hundred-megabyte download and a multi-second first load, traded for privacy and zero marginal cost. The README states the trade-off in exactly those terms.
* **Optimizations to implement and measure:** KV-cache reuse across edits to a stable prefix; batching sentence-level scoring into one forward pass rather than a per-sentence loop; worker-thread isolation with the main thread held at 60fps (verified via long-task counts, not by eye).

### 6.4 Graceful degradation

Capability is probed at load. Tiers: WebGPU + SLM → WASM + ranker only → heuristics only. The UI states which tier is active and what is unavailable. The app must be fully useful for editing and accessibility checking with **no model loaded at all**.

---

## 7. Accessibility: From Heuristic to Measurement (RQ4)

The previous draft proposed an "Accessibility Compliance Index" computed as a ratio of non-ASCII characters. That is a guess dressed as a metric. Replace it with measurement.

### 7.1 Empirical screen-reader study

* Assemble a corpus of ~200 representative posts spanning styling densities from 0% to 100% substituted characters.
* Capture actual speech output from **VoiceOver (macOS/iOS)** and **NVDA (Windows)** across their default and verbose punctuation settings.
* Transcribe the audio and compute **Word Error Rate against the source ASCII**.
* Publish the resulting curve: *styling density → comprehension degradation*, per reader, per verbosity setting.

This is the project's most original artifact. It is a real, citable measurement that does not currently exist in public, and it converts an opinion ("this is bad for accessibility") into evidence.

### 7.2 Calibrated in-app scoring

The in-app accessibility score is a **regression fitted to the §7.1 WER data**, not an invented formula. The UI reports predicted degradation with a confidence interval and names the specific spans responsible.

### 7.3 Standards grounding

Map findings to WCAG 2.2 (1.3.1 Info and Relationships, 4.1.2 Name/Role/Value) and Unicode UAX #15 normalization, noting explicitly that NFKC folds math alphanumerics back to ASCII — which is why platform-side normalization would solve this outright, and is worth stating as the real fix.

### 7.4 Remediation

One-click "restore accessible text" using the §4.1 provenance map, plus an export mode that preserves emphasis through structure (line breaks, capitalization, ordering) rather than codepoint substitution.

---

## 8. Evaluation Harness

Everything above is only credible if it is reproducible. `eval/` is a first-class part of the repo, not an afterthought.

### 8.1 Rewriter quality — measured, not asserted

| Dimension | Method |
| :--- | :--- |
| Constraint satisfaction | Rate at which rewrites respect length limits, preserve named entities/numbers/URLs, and introduce no unrequested styling |
| Meaning preservation | Bidirectional NLI entailment between source and rewrite; flag any non-entailed pair |
| Preference | LLM-judge win rate vs. the original text and vs. a strong prompted baseline, with **position-swapped duplicate judging** to correct order bias |
| Judge validity | ~100 items independently human-labeled; report Cohen's κ between judge and human. **If κ is low, judge results are reported as unreliable rather than quietly used.** |

### 8.2 Correctness

* Property-based tests for all five §4.2 invariants.
* Fuzzing of the renderer against a Unicode corpus including emoji, ZWJ sequences, combining marks, RTL text, and CJK.
* ONNX/PyTorch numerical parity assertions in CI.

### 8.3 Reproducibility

Pinned seeds and dependency versions; a dataset manifest with checksums; one command to regenerate every table in this document; model cards documenting training data, intended use, and known failure modes; CI running tests, benchmarks, and parity checks on every push.

---

## 9. Stack

| Layer | Choice | Rationale |
| :--- | :--- | :--- |
| App | Next.js (static export) + TypeScript, strict | No server needed; strict types for the document tree |
| Editor state | Custom tree + immutable updates (Zustand) | The grammar in §4.1 is the point; a generic rich-text framework would obscure it |
| Inference | `onnxruntime-web` (WebGPU, WASM fallback) | Direct control over backends and quantization |
| Training | PyTorch + HF Transformers | Standard; teacher/student both available |
| Testing | Vitest + `fast-check`, Playwright | Property tests are load-bearing here |
| Bench | Custom harness, Playwright-driven, multi-device | Numbers in §6.2 must be reproducible |

---

## 10. Repository Layout

```
prose-edge/
├── app/                  # Next.js UI
├── src/
│   ├── document/         # Grammar, tree ops, invariants
│   │   ├── grammar.ts
│   │   ├── render.ts     # tree -> Unicode + provenance
│   │   ├── normalize.ts  # Unicode -> ASCII (round-trip)
│   │   └── invariants.test.ts
│   ├── runtime/          # ORT Web workers, backend probing, KV-cache
│   ├── analysis/         # Calibrated accessibility model, fold estimator
│   └── ui/
├── training/             # RQ1/RQ2 — the ML core
│   ├── data/             # Collection, stratified pairing, splits
│   ├── train_teacher.py
│   ├── distill.py
│   ├── export_onnx.py    # + numerical parity check
│   └── calibrate.py
├── eval/                 # RQ1-RQ4 evaluation; regenerates every table
│   ├── ranking/
│   ├── rewriter/
│   └── accessibility/    # Screen-reader WER study
├── bench/                # §6.2 latency/memory harness
├── docs/
│   ├── RESULTS.md        # All measured numbers live here
│   ├── MODEL_CARD.md
│   └── accessibility-study.md
└── README.md
```

---

## 11. Build Order

Each phase ends with a committed, reproducible result. Do not proceed to the next phase before the current one produces a number.

| Phase | Deliverable | Exit criterion |
| :--- | :--- | :--- |
| 1 | Document grammar, renderer, normalizer | All five §4.2 invariants pass under property testing |
| 2 | Accessibility study (§7.1) | Published WER curve + calibrated in-app model |
| 3 | Data pipeline + stratified pairs (§5.1–5.2) | Baselines reproduced; splits verified leak-free |
| 4 | Teacher training + evaluation | Beats TF-IDF baseline on a temporal split, or documented as a negative result |
| 5 | Distillation, ONNX export, quantization | §6.2 table filled with parity checks passing |
| 6 | Browser runtime integration | Ranker running under WebGPU with WASM fallback; benchmarks recorded |
| 7 | Rewriter + eval harness (§8.1) | Win-rate and constraint numbers with judge κ reported |
| 8 | UI polish, transfer eval (§5.5), docs | `RESULTS.md` complete; live demo deployed |

**If time runs short, cut phases 7–8, not 2–5.** A project with a rigorous accessibility study and a clean compression curve beats a feature-complete editor with unmeasured claims. Scope down by removing features, never by removing evaluation.

---

## 12. Why This Is Interview-Defensible

The value is in what each part demonstrates, and in the questions it lets you answer well:

| Component | Demonstrates | Expect to be asked |
| :--- | :--- | :--- |
| §5.2 stratified pairing | Causal/confounder reasoning in a modeling task | "Why not just regress on upvotes?" |
| §5.2 temporal + community splits | Understanding of leakage | "How do you know it generalizes?" |
| §6.2 ablation table | Compression trade-offs, quantitative systems work | "What did INT8 cost you in accuracy?" |
| §6.1 parity check | Awareness that exports fail silently | "How do you know the ONNX model matches?" |
| §7.1 WER study | Ability to design an original measurement | "How do you know styling actually hurts?" |
| §8.1 judge κ | Skepticism toward your own eval | "Why should I trust an LLM judge?" |
| §5.2 negative-result policy | Intellectual honesty | "What if it hadn't worked?" |

The last row matters most. A candidate who reports a measured gap or a failed hypothesis is more trusted than one whose every number is favorable.

### Framing on a resume

Lead with measurement, not features. The shape to aim for once the numbers exist:

> Built an on-device text editor with a distilled ranking model running in-browser via WebGPU; quantified screen-reader degradation from Unicode styling across two readers (published WER curve) and cut model size ~8× via distillation + INT8 with X% accuracy retained at Y ms p95.

Fill in the numbers only after `eval/` and `bench/` produce them.

---

## 13. Risks and Open Questions

| Risk | Mitigation |
| :--- | :--- |
| Engagement signal is too noisy to learn | Stratification + margin filtering; report as negative result if baselines aren't beaten |
| Reddit/HN → professional-register transfer fails | Measured explicitly in §5.5; the gap is a reported finding, not a hidden failure |
| Screen-reader transcription is labor-intensive | Scope to two readers, two verbosity settings, 200 posts; automate capture where the platform permits |
| WebGPU availability is uneven | Tiered degradation (§6.4); app fully usable with no model |
| SLM rewrite quality at 1B params is weak | Evaluate honestly (§8.1); ship it disabled by default if win rate is at or below baseline |
| Scope overrun | Phase gates in §11; cut features before evaluation |

---

*Claims in this document are hypotheses until `docs/RESULTS.md` contains the corresponding measurements.*
