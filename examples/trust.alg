; trust.alg — The Court of Competing Authorities
;
; Two authorities disagree about deployment safety.
; Security lead says the audit failed → deny safe.
; Engineering lead says all tests pass → affirm safe.
; Their authority is incomparable: each has credentials
; the other lacks, with equal rank.
; Canon produces a binding ruling — a contradiction with dissent preserved.
;
; The contradiction IS the institutional memory.

; ── 1. Define the court ─────────────────────────────────────────────
; Both security and engineering credentials carry equal weight.
; Threshold 0.7 means dominance must exceed 70% to resolve cleanly.

(defcourt deployment
  :scope deployment
  :order ((security-cert 3.0) (engineering-cert 3.0))
  :policy max-authority
  :threshold 0.7)

; ── 2. Define the authorities ───────────────────────────────────────
; Each has credentials the other lacks. Same rank.

(defauthority security-lead
  :kind human
  :cred (security-cert)
  :rank 80)

(defauthority engineering-lead
  :kind human
  :cred (engineering-cert)
  :rank 80)

; ── 3. Establish evidence ───────────────────────────────────────────
; Security lead denies safety; engineering lead affirms it.

(deny safe :because "security audit failed")
(affirm safe :because "all tests pass")

(utter! "=== Evidence ===")
(utter! "Claim 'safe': " (claim safe))

; ── 4. Attest to the court ──────────────────────────────────────────
; Each authority presents their position.

(attest deployment security-lead (deny safe :because "security audit failed"))
(attest deployment engineering-lead (affirm safe :because "all tests pass"))

; ── 5. Canon: the binding ruling ────────────────────────────────────
; Neither authority dominates (degree = 0.5, below threshold 0.7).
; The court cannot resolve — it produces a Contra.

(with-court deployment
  (def ruling (canon safe))
  (utter! "")
  (utter! "=== Canon Ruling ===")
  (utter! ruling)
  (utter! "")
  (utter! "The contradiction is preserved.")
  (utter! "A system that hides its contradictions is lying."))
