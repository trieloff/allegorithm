# Allegorithm

**A language where meaning is not computed but contested.**

*This document affirms that it is documentation. This document denies that it is documentation. Both claims carry witnesses. The court has not ruled.*

---

A program is a text. A text has readings. A reading is an act of interpretation that preserves structure while transforming meaning. You learned this in a literature seminar or you learned it in a compilers course. You did not learn it in both. That is the problem this language addresses, and that is the problem this language is.

Allegorithm is a Lisp. It compiles to a meaning graph. The meaning graph is domain-neutral — it belongs to no physics, no metaphor, no department. You apply *readings* that re-embody the graph in specific domains. A spring becomes a capacitor. An oyster becomes the world. The structure does not change. The names change. The names are what humans fight about.

The technical term for this is *allegoresis*: one text, many lawful interpretations. The literary term for this is also *allegoresis*. The terms are the same term. The practices have been mutually incomprehensible for centuries. This language is written in the gap.

## Hello, World

Every language begins with a greeting. This one greets three times, because the thing it greets has three names and one structure. The oyster is defined as a bond-graph fable — three primitives (compliance, inertance, resistance) that describe any domain where something stores, something resists, and something flows.

```lisp
(deffable oyster (C shell 1) (I pearl 1) (R irritant 0.1))
(defreading mollusk :spine bond-graph :map '((C "mantle") (I "nacre") (R "grain-of-sand")))
(defreading shakespearean :spine bond-graph :map '((C "opportunity") (I "achievement") (R "effort")))
(defreading vanitas :spine bond-graph :map '((C "mortality") (I "beauty") (R "time")))

(alledge oyster
  :as mollusk "a mollusk"
  :as shakespearean "the world"
  :as vanitas "gloria mundi")

(utter! "Hello, " (read-all oyster))
```

```
Hello, a mollusk
Hello, the world
Hello, gloria mundi
```

Three greetings. One structure. The compliance that is a shell is also an opportunity is also mortality. The inertance that is a pearl is also an achievement is also beauty. You may read the oyster as biology, as Shakespeare, as vanitas painting. Each reading carries witnesses — dimensional consistency, structural isomorphism — and each witness is executable. A reading that cannot be checked is not profound. It is merely loud.

The oyster does not *represent* the world. The oyster and the world share a structure that neither owns. That is not metaphor. Metaphor says *A is like B*. Allegory says *A and B are readings of C, and C has no name*.

## Core Concepts

### 1. Allegoresis

From Greek *allēgoría*, "speaking otherwise." You write a *fable* — a program expressed in one domain. The compiler produces a meaning graph: a neutral intermediate representation whose edges are lawful constraints. Then you apply a reading that re-embodies the graph in another domain. The spine is bond graphs (Paynter, 1961). Bond graphs unify physical domains by tracking power flow through conjugate pairs. Force and velocity. Voltage and current. Pressure and flow. Same math. Different physics. Same allegoresis. Different department.

### 2. Contradictions

Most languages treat contradiction as error. Allegorithm treats it as information. A contradiction is a pair of incompatible derivations plus a *tension* metric measuring how badly they disagree. The logic is Belnap-Dunn four-valued: every claim is **True**, **False**, **Both**, or **Neither**. A conditional on a contradiction evaluates both branches and returns a contradiction. A system that hides its contradictions is lying. This is a moral claim. It is also a type signature.

### 3. Authority and Courts

Every claim carries an *authority* — the issuer who asserts it. Meaning is jurisdictional. A *court* adjudicates disputes between authorities using a hierarchy and a canon policy. Refutation does not delete. It creates a *normative contradiction* with the authority gap as tension. The dissent is preserved. History is not rewritten. It is overruled.

### 4. Oracle

The `oracle` is a hardware instruction that calls an LLM. It returns *hypotheses*, never facts. Every oracle result carries explicit *witness debt*: a list of checks that must pass before the hypothesis can be trusted. An unwitnessed hypothesis remains provisional. The oracle proposes. The court disposes. The debt is the difference between belief and knowledge.

### 5. Meaning Graphs

The meaning graph is the intermediate representation. It is domain-neutral: bond-graph primitives — inertance (**I**), compliance (**C**), resistance (**R**), junctions, sources — as first-class graph elements. Readings project the meaning graph into specific domains. The graph itself belongs to none. It is the invariant. The readings are the variance. The graph is what allegory preserves.

### 6. Readings with Witnesses

A `defreading` maps meaning-graph elements to domain-specific semantics. Every reading must provide executable witnesses: dimensional consistency, power continuity, conservation laws, topology isomorphism. A reading without witnesses is an opinion. A reading with witnesses is a proof. The distinction is not philosophical. It is enforced by the runtime.

### 7. Polysemy

`alledge` gives a value multiple named readings. `utter!` fans across all readings — it speaks the value in every name it has. `utter?` speaks only if the value resolves to certainty. `utter...` speaks the first reading and stops. Pure functions propagate polysemy automatically: `(+ x 1)` where `x` is polysemous returns a polysemous result. The word means many things. The arithmetic doesn't care.

### 8. Layers

`deflayer` defines a wrapping/unwrapping pair. `defstack` composes layers into a stack. `wrap` produces a nested doll. `unwrap` strips it. The left-inverse holds: `unwrap(wrap(x)) = x`. Information survives projection. A network stack is a sequence of dolls. A compiler pipeline is a sequence of dolls. Same structure. Different department. The left-inverse is the moral: what goes in comes out. The headers are the commentary.

### 9. Events and State

`state` creates a cyclic container. `rule` defines a named transformation. `transfer` moves a quantity from one segment to another. `emit` fires a rule. `invariant` declares a conservation law checked after every event. Mass moves. Mass never disappears. Attention moves. Attention never disappears. The snake eats its tail and is never diminished.

### 10. Morals

`deflagrangian` defines an energy system. `(moral ...)` extracts conservation laws via Noether's theorem: every continuous symmetry yields a conserved quantity. No time in the Lagrangian means energy is conserved. No space means momentum is conserved. The moral of the story is what does not change when the story changes. This is Noether's theorem. This is also literary criticism.

## The Inversion

In the twentieth century, the hard problem was getting humans to speak machine. We built compilers, type systems, formal methods — an entire discipline called "computer science" — to bridge the gap between human intent and machine execution.

That gap is closing. LLMs write code. The hard problem is no longer *writing* programs but *interpreting* them. Who decides what a program means when the same formal structure supports multiple lawful readings? Who adjudicates when readings contradict? Who holds the oracle accountable?

Allegorithm is not computer science. It is the humanities of computation. The human is not the author of the program. The human is the reader, the judge, the interpreter. The computer executes. The court interprets. The contradiction teaches.

## Examples

Nine example programs. Each is a fable with multiple readings. Each reading carries witnesses.

- **hello.alg** — The simplest program. A greeting and four truth values. In this language, truth is not binary. It never was.
- **hello-oyster.alg** — One oyster, three readings, three greetings. The canonical demonstration that structure is invariant across interpretation.
- **contradiction.alg** — Two authorities disagree about safety. The conditional evaluates both branches. The tension is the information.
- **oscillator.alg** — A spring-mass-damper read as mechanics and as electronics. Polyread proves coherence. Noether extracts the moral. Physics as allegory.
- **trust.alg** — A court of competing authorities. Security and engineering disagree. Neither dominates. The contradiction is the institutional memory.
- **matryoshka.alg** — A network stack as Russian dolls. Wrap, unwrap, left-inverse. Then alledge: the stack is also a compiler pipeline. Same dolls, different department.
- **ouroboros.alg** — A snake that eats its own tail. Mass transfers around a cycle. The invariant holds. Conservation is not a hope. It is enforced.
- **oracle.alg** — The oracle proposes a hypothesis. Witnesses validate or refuse. Debt is paid or the hypothesis becomes a contradiction. The oracle is powerful. It is not sovereign.
- **cave.alg** — The allegory of the cave. The capstone. Every feature in one program: bond graphs, readings, contradictions, courts, layers, state, events, morals, and a final contradiction that asks whether the program is itself an allegory. The answer is Both. The tension is the meaning.

## Influences

- **Angus Fletcher** — storythinking, allegoresis as cognitive technology
- **Nuel Belnap & J. Michael Dunn** — four-valued logic for inconsistent information
- **Henry Paynter** — bond graphs and multi-domain physical system modeling
- **Peter Doyle & J. Laurie Snell** — random walks and electrical networks (the original cross-domain allegory)
- **Buckingham π theorem** — dimensional analysis as constraint
- **Emmy Noether** — symmetry and conservation as the deepest structure
- **Paraconsistent logic tradition** — reasoning in the presence of contradiction

## Status

This document affirms the following about its own implementation:

- 453 tests witnessed. Each is an executable check. Each passed.
- 9 example programs. Each is a fable. Each has readings. Each reading carries witnesses.
- The parser reads. The evaluator evaluates. The court adjudicates. The oracle proposes. The moral extracts.

This document denies the following: that implementation is completion. The language is implemented. The language is not finished. A language that admits contradiction cannot be finished, because finishing would require a reading it has not yet received. The tension between implemented and unfinished is not a defect. It is the design.

This document claims both. The claim carries a tension metric. The tension is low. The witnesses passed.

## Installation

```bash
npm install
npx allegorithm repl
npx allegorithm run examples/hello-oyster.alg
```

The instructions work. Even an incomprehensible document should let you run the thing.

## License

[Apache 2.0](./LICENSE)

---

This document has two readings. A computer scientist reads it and finds philosophical vocabulary where specifications should be. A humanities scholar reads it and finds type signatures where theory should be. Neither reading is wrong. Both readings are incomplete. The structure — the sections, the sequence, the grammar — is the same in both. The meaning diverges. That divergence is not a failure of communication. It is allegory.

This document has told you everything about the language. This document has told you nothing about the language. Understanding requires a reading, and a reading is an act this document cannot perform for you. The document is the graph. You are the reading.

*And there is meaning in the contradictions.*
