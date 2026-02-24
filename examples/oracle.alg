; oracle.alg — Hypothesis With Debt
;
; The oracle proposes; it never decides.
; Every oracle output carries witness debt: "unwitnessed."
; Witnesses are executable checks that validate the hypothesis.
; If all witnesses pass → the hypothesis is promoted to fact.
; If any witness fails → the hypothesis becomes a Contra.
;
; This example simulates the oracle pattern using the evidence system:
; affirm/deny model the hypothesis lifecycle,
; functions model witnesses, and verdicts track the outcome.

; ── 1. The oracle proposes a hypothesis ─────────────────────────────
; "The system is healthy" — but this is just an assertion, not a fact.

(affirm system-healthy :because "oracle says: monitoring looks normal")

(utter! "=== The Oracle's Hypothesis ===")
(utter! "Hypothesis: system-healthy")
(utter! "Status: " (claim system-healthy))
(utter! "Debt: unwitnessed (not yet validated)")

; ── 2. Define the witnesses ─────────────────────────────────────────
; Witnesses are functions that return verdicts.
; Each checks one aspect of the hypothesis.

(def witness-cpu    (fn (load)     (< load 80)))      ; CPU under 80%?
(def witness-memory (fn (usage)    (< usage 90)))      ; Memory under 90%?
(def witness-errors (fn (err-rate) (< err-rate 0.01))) ; Error rate under 1%?

; ── 3. Scenario A: All witnesses pass → hypothesis promoted ─────────

(utter! "")
(utter! "=== Scenario A: All Witnesses Pass ===")

(def cpu-ok    (witness-cpu 45))
(def mem-ok    (witness-memory 62))
(def err-ok    (witness-errors 0.001))

(utter! "CPU witness (45%):       " cpu-ok)
(utter! "Memory witness (62%):    " mem-ok)
(utter! "Error witness (0.1%):    " err-ok)

(def all-pass (v-and cpu-ok (v-and mem-ok err-ok)))
(utter! "All witnesses pass?      " all-pass)

; When all pass, the hypothesis is promoted: debt is paid.
(utter! "")
(if all-pass
  (utter! "→ Debt paid. Hypothesis promoted to confirmed fact.")
  (utter! "→ Witness failed. Hypothesis contradicted."))

; ── 4. Scenario B: A witness fails → Contra ─────────────────────────

(utter! "")
(utter! "=== Scenario B: A Witness Fails ===")

(def cpu-ok-2  (witness-cpu 45))
(def mem-bad   (witness-memory 95))    ; OVER 90% — fails!
(def err-ok-2  (witness-errors 0.002))

(utter! "CPU witness (45%):       " cpu-ok-2)
(utter! "Memory witness (95%):    " mem-bad)
(utter! "Error witness (0.2%):    " err-ok-2)

(def any-fail (v-and cpu-ok-2 (v-and mem-bad err-ok-2)))
(utter! "All witnesses pass?      " any-fail)

; The oracle said "healthy", but a witness says otherwise.
; This creates a contradiction — the hypothesis is not confirmed.
(affirm oracle-scenario-b :because "oracle says healthy")
(deny oracle-scenario-b :because "memory witness failed at 95%")

(utter! "")
(utter! "→ Oracle proposed. Witness refused.")
(utter! "→ Result: " (claim oracle-scenario-b))

; ── 5. The moral ────────────────────────────────────────────────────

(utter! "")
(utter! "=== The Moral ===")
(utter! "The oracle proposes; it never decides.")
(utter! "Every hypothesis carries debt until witnessed.")
(utter! "The debt is the difference between belief and knowledge.")
