; oscillator.alg — The Allegorical Proof
;
; A spring-mass-damper oscillator defined as a bond-graph fable.
; The same structure is read mechanically and electrically.
; Polyread proves structural coherence: same spine, different names.
; Then deflagrangian extracts conservation laws via Noether's theorem.
;
; This is the flagship demo: physics as allegory, morals as conservation laws.

; ── 1. Define the oscillator as a bond-graph fable ──────────────────

(deffable oscillator
  (C spring 1)       ; compliance / capacitance
  (I mass 1)         ; inertia / inductance
  (R damper 0.1))    ; resistance / damping

; ── 2. Two readings: mechanical and electrical ──────────────────────

(defreading mechanical
  :spine bond-graph
  :map '((C "spring") (I "inertia") (R "friction")))

(defreading electrical
  :spine bond-graph
  :map '((C "capacitor") (I "inductor") (R "resistor")))

; ── 3. Polyread: prove structural coherence ─────────────────────────
; Same spine, same roles, different surface names → coherent (residual 0)

(utter! "=== Polyread: Structural Coherence ===")
(utter! "Result: " (polyread (list mechanical electrical) oscillator))

; ── 4. Alledge: the oscillator has two names ────────────────────────

(alledge oscillator
  :as mechanical "a spring-mass-damper"
  :as electrical "an RLC circuit")

(utter! "")
(utter! "=== The Oscillator Is... ===")
(utter! "  " (read-all oscillator))

; ── 5. Deflagrangian: extract the moral ─────────────────────────────
; A free particle: L = ½mv². No explicit x or t in L.
; Noether's theorem gives us two conservation laws:
;   - No t in L → energy conserved (time-translation symmetry)
;   - No x in L → momentum conserved (space-translation symmetry)

(deflagrangian free-particle
  (param m :units kg)
  (field x :units m)
  (L (* 0.5 (* m (square (∂t x))))))

(def laws (moral free-particle))

(utter! "")
(utter! "=== The Moral (Conservation Laws) ===")
(utter! "Laws: " laws)

; ── 6. Simulate and verify conservation ─────────────────────────────

(def trace (simulate-lagrangian free-particle
  :ic (list (list 'x 0) (list 'v 3))
  :t 1 :dt 0.1 :m 1))

(def energy-check (check-conservation (first laws) trace))
(def momentum-check (check-conservation (first (rest laws)) trace))

(utter! "")
(utter! "=== Verification Against Simulation ===")
(utter! "Energy conserved?   " energy-check)
(utter! "Momentum conserved? " momentum-check)
