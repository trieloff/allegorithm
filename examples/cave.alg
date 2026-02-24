; cave.alg — The Allegory of the Cave
;
; The capstone example: every feature of Allegorithm in one program
; that tells the story of Plato's Cave.
;
; A bond-graph fable defines the cave. Two readings name its parts:
; the prisoners see shadows; the philosopher sees forms.
; A court adjudicates but cannot resolve. Layers model perception.
; State and events model the turning. A Lagrangian extracts the moral.
; And at the end, the program asks whether it is itself an allegory.
;
; The answer is a contradiction. The contradiction is the meaning.

; ── Act I: The Cave ──────────────────────────────────────────────────
; A bond graph: light (I — energy source), wall (C — capacity to hold
; an image), and the medium between them (R — attenuation/resistance).
; Same structure, different names. That's allegory.

(deffable cave
  (I light 1)         ; inertia / energy source
  (C wall 1)          ; compliance / capacity
  (R medium 0.1))     ; resistance / attenuation

(defreading prisoner
  :spine bond-graph
  :map '((I "fire") (C "wall") (R "shadow")))

(defreading philosopher
  :spine bond-graph
  :map '((I "the-sun") (C "the-mind") (R "perception")))

(utter! "=== Act I: The Cave ===")
(utter! "")
(utter! "The prisoners and the philosopher look at the same cave.")
(utter! "Structural coherence: " (polyread (list prisoner philosopher) cave))
(utter! "Same structure. Different names. That is allegory.")

; ── Act II: What Is Real? ────────────────────────────────────────────
; The prisoners affirm that shadows are reality.
; The philosopher denies it.
; claim returns BOTH — contradiction.

(utter! "")
(utter! "=== Act II: What Is Real? ===")
(utter! "")

(affirm shadows-are-real :because "we see them on the wall every day")
(deny shadows-are-real :because "they are projections of forms, not forms themselves")

(utter! "The prisoners say: shadows are real.")
(utter! "The philosopher says: shadows are not real.")
(utter! "The evidence says: " (claim shadows-are-real))

; ── Act III: The Court ───────────────────────────────────────────────
; The prisoners have authority of consensus (many voices, high rank).
; The philosopher has authority of witness (has seen the sun).
; Neither dominates. Canon produces contradiction with dissent preserved.

(utter! "")
(utter! "=== Act III: The Court ===")
(utter! "")

(defcourt cave-court
  :scope epistemology
  :order ((consensus-cred 3.0) (witness-cred 3.0))
  :policy max-authority
  :threshold 0.7)

(defauthority prisoners
  :kind human
  :cred (consensus-cred)
  :rank 80)

(defauthority the-philosopher
  :kind human
  :cred (witness-cred)
  :rank 80)

(attest cave-court prisoners (affirm shadows-are-real :because "we see them every day"))
(attest cave-court the-philosopher (deny shadows-are-real :because "I have seen the sun itself"))

(with-court cave-court
  (def ruling (canon shadows-are-real))
  (utter! "The court rules: " ruling)
  (utter! "Neither authority dominates. The contradiction is preserved.")
  (utter! "A system that hides its contradictions is lying."))

; ── Act IV: The Wall Has Two Names ───────────────────────────────────
; The wall is alledged with two readings. utter! fans across both.

(utter! "")
(utter! "=== Act IV: The Wall Has Two Names ===")
(utter! "")

(alledge cave
  :as prisoner "the world itself — the only reality we know"
  :as philosopher "a projection surface — a screen for forms")

(utter! "The cave is: " (read-all cave))

; ── Act V: Perception as Layers ──────────────────────────────────────
; Perception is a stack of layers. Light passes through:
; medium → surface → eye. Each adds structure (headers).
; wrap produces a nested doll; unwrap strips it.
; The left-inverse holds: the form survives projection.

(utter! "")
(utter! "=== Act V: Perception as Layers ===")
(utter! "")

(deflayer medium-layer
  (wrap (fn (p) (doll :medium '((:type "light") (:intensity 1)) p)))
  (unwrap (fn (d) (payload d))))

(deflayer surface-layer
  (wrap (fn (p) (doll :surface '((:material "stone") (:curvature 0)) p)))
  (unwrap (fn (d) (payload d))))

(deflayer eye-layer
  (wrap (fn (p) (doll :eye '((:aperture "wide") (:focus "near")) p)))
  (unwrap (fn (d) (payload d))))

(defstack perception (list medium-layer surface-layer eye-layer))

(def the-form "truth")
(def projected (wrap perception the-form))
(def recovered (unwrap perception projected))

(utter! "The form:      " the-form)
(utter! "Projected:     " projected)
(utter! "Recovered:     " recovered)
(utter! "Left-inverse:  " (= the-form recovered))
(utter! "The form survives projection. Structure is preserved.")

; ── Act VI: The Turning ──────────────────────────────────────────────
; The philosopher turns around. Attention moves from shadow to form.
; Modeled as state with energy transfer: what was invested in shadows
; flows into seeing forms. Total attention is conserved.

(utter! "")
(utter! "=== Act VI: The Turning ===")
(utter! "")

(def attention (state (cycle (list
  (make-segment :name "shadow" :energy 10)
  (make-segment :name "form" :energy 0)))))

(utter! "Before the turning:")
(utter! "  attention on shadows: " (get-field (state-nth attention 0) :energy))
(utter! "  attention on forms:   " (get-field (state-nth attention 1) :energy))
(utter! "  total attention:      " (sum-field attention :energy))

(invariant (= (sum-field attention :energy) 10))

(rule turn-toward (source target :fraction 0.5)
  (transfer source :energy -> target :energy :fraction fraction))

; The philosopher turns — attention flows from shadow to form
(emit (turn-toward (state-nth attention 0) (state-nth attention 1)))

(utter! "")
(utter! "The philosopher turns around.")
(utter! "After the turning:")
(utter! "  attention on shadows: " (get-field (state-nth attention 0) :energy))
(utter! "  attention on forms:   " (get-field (state-nth attention 1) :energy))
(utter! "  total attention:      " (sum-field attention :energy))
(utter! "  conserved?            " (check-invariants))

; A second turn — more attention flows
(emit (turn-toward (state-nth attention 0) (state-nth attention 1)))

(utter! "")
(utter! "The philosopher turns further.")
(utter! "  attention on shadows: " (get-field (state-nth attention 0) :energy))
(utter! "  attention on forms:   " (get-field (state-nth attention 1) :energy))
(utter! "  conserved?            " (check-invariants))

; New evidence: the philosopher now affirms forms-are-real
(affirm forms-are-real :because "I have turned and seen the sun")
(deny forms-are-real :because "you are blinded — the shadows are what is real")

(utter! "")
(utter! "The philosopher affirms: forms are real.")
(utter! "The prisoners deny it: " (claim forms-are-real))

; ── Act VII: The Moral ───────────────────────────────────────────────
; Define projection as an energy system. A free particle:
; L = ½mv². Noether's theorem extracts conservation laws.
; The moral: structure is preserved through projection.

(utter! "")
(utter! "=== Act VII: The Moral ===")
(utter! "")

(deflagrangian projection
  (param m :units kg)
  (field x :units m)
  (L (* 0.5 (* m (square (∂t x))))))

(def laws (moral projection))

(utter! "The Lagrangian of projection:")
(utter! "  L = ½mv² — the kinetic energy of a form in motion.")
(utter! "  Conservation laws: " laws)

(def trace (simulate-lagrangian projection
  :ic (list (list 'x 0) (list 'v 1))
  :t 1 :dt 0.1 :m 1))

(def energy-check (check-conservation (first laws) trace))
(def momentum-check (check-conservation (first (rest laws)) trace))

(utter! "")
(utter! "  Energy conserved?    " energy-check)
(utter! "  Momentum conserved?  " momentum-check)
(utter! "")
(utter! "Structure is preserved through projection.")
(utter! "Allegory is the identity that survives dimensional reduction.")

; ── Coda: The Final Contradiction ────────────────────────────────────
; The program cannot be the thing it describes — it is code, not a cave.
; Yet it IS the thing it describes — it is an allegory of allegory.
; Affirm and deny this. The tension IS the meaning.

(utter! "")
(utter! "=== Coda: The Final Contradiction ===")
(utter! "")

(affirm this-is-allegory :because "the program describes the cave through structural correspondence")
(deny this-is-allegory :because "the program is code, not a cave — it is a shadow of the idea")

(utter! "Is this program an allegory? " (claim this-is-allegory))
(utter! "The tension is " (meaning (claim this-is-allegory)))
(utter! "")
(utter! "And there is meaning in the contradictions.")
