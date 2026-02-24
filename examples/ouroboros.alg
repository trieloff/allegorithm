; ouroboros.alg — The Snake That Eats Itself
;
; A cyclic state container with segments, each carrying mass.
; An "eat" rule transfers mass from prey to predator.
; An invariant ensures total mass is conserved.
; The snake eats its own tail — mass moves but never disappears.
;
; Conservation is not a hope. It is an invariant.

; ── 1. Define the snake as a cyclic state ───────────────────────────

(def snake (state (cycle (list
  (make-segment :name "head" :mass 10)
  (make-segment :name "body" :mass 8)
  (make-segment :name "tail" :mass 6)))))

(utter! "=== The Ouroboros ===")
(utter! "Segments: " (state-count snake))
(utter! "Total mass: " (sum-field snake :mass))

; ── 2. Declare the conservation invariant ───────────────────────────
; Total mass = 24, always. This is checked after every emit.

(invariant (= (sum-field snake :mass) 24))
(utter! "Invariant set: total mass = 24")

; ── 3. Define the eat rule ──────────────────────────────────────────
; The predator takes a fraction of the prey's mass.
; Transfer is conservative: what leaves prey arrives at predator.

(rule eat (predator prey :fraction 0.5)
  (transfer prey :mass -> predator :mass :fraction fraction))

; ── 4. The snake eats its tail ──────────────────────────────────────

(utter! "")
(utter! "=== Round 1: Head eats Tail ===")
(utter! "Before: head=" (get-field (state-nth snake 0) :mass)
  " body=" (get-field (state-nth snake 1) :mass)
  " tail=" (get-field (state-nth snake 2) :mass))

(emit (eat (state-nth snake 0) (state-nth snake 2)))

(utter! "After:  head=" (get-field (state-nth snake 0) :mass)
  " body=" (get-field (state-nth snake 1) :mass)
  " tail=" (get-field (state-nth snake 2) :mass))
(utter! "Total mass: " (sum-field snake :mass))
(utter! "Invariant holds? " (check-invariants))

; ── 5. Another round ────────────────────────────────────────────────

(utter! "")
(utter! "=== Round 2: Body eats Tail ===")
(emit (eat (state-nth snake 1) (state-nth snake 2)))

(utter! "After:  head=" (get-field (state-nth snake 0) :mass)
  " body=" (get-field (state-nth snake 1) :mass)
  " tail=" (get-field (state-nth snake 2) :mass))
(utter! "Total mass: " (sum-field snake :mass))
(utter! "Invariant holds? " (check-invariants))

; ── 6. The cycle continues ──────────────────────────────────────────

(utter! "")
(utter! "=== Round 3: Tail eats Head (the ouroboros completes) ===")
(emit (eat (state-nth snake 2) (state-nth snake 0)))

(utter! "After:  head=" (get-field (state-nth snake 0) :mass)
  " body=" (get-field (state-nth snake 1) :mass)
  " tail=" (get-field (state-nth snake 2) :mass))
(utter! "Total mass: " (sum-field snake :mass))
(utter! "Invariant holds? " (check-invariants))

(utter! "")
(utter! "Mass moves. Mass never disappears.")
(utter! "The snake eats itself, and is never diminished.")
