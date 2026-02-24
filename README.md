# Allegorithm

**A language where programs are interpreted, not just executed.**

*The computer executes; the court interprets; the contradiction teaches.*

---

Programs used to be written by humans and interpreted by computers. That world is ending. AI now writes code faster than any human ever could — so the old question ("how do I tell the machine what to do?") has become trivial. The new question is: **who decides what a program means?**

Every programming language you know answers that question the same way: the compiler does. One source, one semantics, one truth. Allegorithm says: that answer was always a lie, and now it's an expensive one.

Allegorithm is a Lisp-based language built on a different foundation — **allegoresis**, the ancient practice of reading one text through multiple lawful interpretations. One program compiles to a domain-neutral *meaning graph*. Then you apply *readings* that re-embody that graph in different scientific semantics. A mechanical oscillator becomes an electrical circuit. A network protocol becomes a nesting of Russian dolls. The math doesn't change. The physics does.

One sentence of moral judgment, because it's deserved: anyone who demands a single "true" representation of a system is ethically committed to confusion and will call it sophistication.

## Core Concepts

### 1. Allegoresis — One Program, Many Lawful Readings

From Greek *allēgoría* ("speaking otherwise"). You write a fable — a program expressed in one physical or conceptual domain. The compiler produces a **meaning graph**: a neutral intermediate representation whose edges are lawful constraints. Then you apply a *reading* that re-embodies that graph in a different domain.

The spine is [bond graphs](https://en.wikipedia.org/wiki/Bond_graph) (Paynter, 1961): they unify physical domains by tracking power flow via effort/flow conjugate pairs. Force/velocity in mechanics. Voltage/current in electronics. Pressure/flow in hydraulics. Same math, different physics.

```clojure
;; A mechanical oscillator: mass-spring-damper
(deffable osc
  (let [m  (I :inertia 1.0)      ; inertance (mass)
        k  (C :compliance 0.5)    ; compliance (spring)
        b  (R :resistance 0.1)    ; resistance (damper)
        se (Se :effort 1.0)]      ; effort source (force)
    (junction :1 se m k b)))

;; Read it as mechanics, then as electronics — same graph, two physics
(polyread [identity mech->elec] osc)
;; => [{:domain :mechanical, :effort :force,   :flow :velocity}
;;     {:domain :electrical, :effort :voltage, :flow :current}]
```

A reading must carry **executable witnesses**: dimensional consistency, power continuity, conservation laws, topology isomorphism. Readings without witnesses are rejected. An interpretation that cannot be checked is not profound; it is merely loud.

### 2. Contradictions as First-Class Values

Most languages treat contradictions as errors — theatrical fainting spells that crash the program. Allegorithm treats them as **information**.

A contradiction is a pair of incompatible derivations plus a *tension metric* measuring how badly they disagree. The logic is [Belnap-Dunn four-valued](https://en.wikipedia.org/wiki/Four-valued_logic#Belnap): every claim can be **True**, **False**, **Both** (contradiction), or **Neither** (unknown).

```clojure
;; Two agents disagree about P
(affirm P :authority :sensor-1 :evidence measured-data)
(deny P :authority :sensor-2 :evidence calibration-error)

;; P is now Both — a contradiction with measurable tension
(claim P)
;; => #Contra{:affirm {:by :sensor-1}, :deny {:by :sensor-2}, :tension 0.73}

;; Conditionals on contradictions evaluate BOTH branches
(if (claim P)
  (engage-brakes)
  (maintain-speed))
;; => #Contra{:then (engage-brakes), :else (maintain-speed), :tension 0.73}
```

A system that hides its contradictions is lying, and lies are always more expensive than truth.

### 3. Authority-Scoped Meaning

Every claim in Allegorithm carries an **issuer** — the authority who asserts it. Meaning is not objective; it is *jurisdictional*. A **court** adjudicates disputes between authorities.

```clojure
(defcourt safety-board
  :authorities [:sensor-1 :sensor-2 :engineer :regulator]
  :hierarchy   [:regulator :engineer :sensor-1 :sensor-2]
  :policy      :highest-authority-wins)

;; An engineer overrides a sensor reading
(attest :authority :engineer
  :claim "brake-pressure adequate"
  :evidence inspection-report)

;; A regulator overrides the engineer
(refute :authority :regulator
  :target (claim "brake-pressure adequate")
  :reason "inspection protocol violated")
;; => Normative contradiction: authority-gap = 2 levels
```

Refutation doesn't delete — it creates a **normative contradiction** with the authority gap as tension. The court's canon policy resolves it, but the dissent is preserved. History is not rewritten; it is overruled.

### 4. Oracle — LLM as Hypothesis, Never Sovereign

The `oracle` is a hardware instruction that calls an LLM. It returns **hypotheses** — not facts. Every oracle result carries an explicit **witness debt**: a list of checks that must pass before the hypothesis can be trusted.

```clojure
(oracle :task "propose-reading"
        :context osc
        :target-domain :thermodynamic)
;; => #Hypothesis{
;;      :reading thermo-reading
;;      :debt [:dimensional-consistency
;;             :power-continuity
;;             :conservation-check]
;;      :confidence 0.82
;;      :source :llm}

;; Debt must be discharged by executable witnesses or ratified by authority
;; An unwitnessed hypothesis remains provisional — never canon
```

The oracle is powerful. It is not sovereign. It proposes; the court disposes.

### 5. Meaning Graphs — The Neutral IR

The meaning graph is Allegorithm's intermediate representation. It is domain-neutral: bond-graph primitives (inertance **I**, compliance **C**, resistance **R**, junctions, sources) as first-class graph elements. Readings project the meaning graph into specific domains; the graph itself belongs to none.

```clojure
;; Network stack as Russian dolls — each layer wraps the one below
(deffable net-stack
  (doll :L4-transport
    (doll :L3-network
      (doll :L2-datalink
        payload))))

;; Each doll is a bond-graph subsystem with its own effort/flow semantics
;; L2: voltage/current, L3: routing-pressure/packet-flow, L4: congestion-window/throughput
```

### 6. Readings with Witnesses

A `defreading` maps meaning-graph elements to domain-specific semantics. But a reading is only as good as its witnesses. Every reading must provide executable checks:

- **Dimensional consistency** — units must balance across the mapping
- **Power continuity** — effort × flow products are preserved
- **Conservation laws** — Noether's theorem applied to the graph symmetries
- **Topology isomorphism** — the reading preserves the graph's structure

```clojure
(defreading mech->elec
  :map {(I :inertia)    -> (I :inductance)
        (C :compliance) -> (C :capacitance)
        (R :resistance) -> (R :resistance)
        (Se :effort)    -> (Se :voltage)}
  :witnesses [dimensional-consistency
              power-continuity
              topology-isomorphism])
```

## The Inversion

In the twentieth century, the hard problem was getting humans to speak machine. We built compilers, type systems, formal methods — an entire discipline called "computer science" — to bridge the gap between human intent and machine execution.

That gap is closing. LLMs write code. The hard problem is no longer *writing* programs — it is *interpreting* them. Who decides what a program means when the same formal structure can be lawfully read in multiple domains? Who adjudicates when two readings contradict? Who holds the oracle accountable?

Allegorithm is not computer science. It is **the humanities of computation**. The human is not the author of the program. The human is the reader, the judge, the interpreter. The computer executes. The court interprets. The contradiction teaches.

## Influences

- **Angus Fletcher** — storythinking, allegoresis as cognitive technology
- **Nuel Belnap & J. Michael Dunn** — four-valued logic for inconsistent information
- **Henry Paynter** — bond graphs and multi-domain physical system modeling
- **Peter Doyle & J. Laurie Snell** — random walks and electrical networks (the original cross-domain allegory)
- **Buckingham π theorem** — dimensional analysis as constraint
- **Emmy Noether** — symmetry and conservation as the deepest structure
- **Paraconsistent logic tradition** — reasoning in the presence of contradiction

## Status

**Status: Phase 1.5 Complete — Polysemy and Side-Effect Discipline**

The core runtime plus polysemy features are implemented and tested (369 tests passing):

- **Parser** — Full S-expression parser with position tracking and quote sugar
- **Type System** — 11 value types including Verdict (Belnap four-valued), Contra (first-class contradictions), Hypothesis (oracle output with witness debt), Authority (partial-order, probabilistic), Polysemous (multiple lawful readings)
- **Evaluator** — Lexical scope, closures, and the contradiction-producing `if`: when a condition is Both, both branches execute and the disagreement is returned as a first-class value. Pure functions automatically propagate polysemy.
- **Evidence System** — `claim`, `affirm`, `deny` accumulate evidence without overwriting; `meaning` inspects tension
- **Readings Engine** — Meaning graphs, `defreading`, `with-reading`, `polyread` structural coherence checking, `allegorize`
- **Polysemy** — `alledge` creates values with multiple named readings; `read-all` and `read-as` extract them
- **Side-Effect Discipline** — `utter!` (fan across all readings), `utter?` (guard: only if certain), `utter...` (pick first). Bare side-effectful calls are errors — you must declare your polysemy stance.
- **Court System** — Authority as partial order with probabilistic dominance, `canon`, `refute`, attestations, multiple court policies
- **Oracle** — LLM integration as hypothesis-generator with explicit witness debt
- **REPL & CLI** — Interactive REPL and file runner

Try it:
```bash
npm install
npx allegorithm repl
npx allegorithm run examples/hello-oyster.alg
```

**Next**: Phase 2 — domain primitives (event system, layer composition, moral/Noether extraction), standard readings canon, example programs.

## License

[Apache 2.0](./LICENSE)

---

*"The question is not whether your model is wrong. All models are wrong. The question is whether your language lets you say so."*
