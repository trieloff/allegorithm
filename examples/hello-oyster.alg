; Hello, Oyster — the true hello world of Allegorithm
; One greeting, three lawful readings

(deffable oyster (C shell 1) (I pearl 1) (R irritant 0.1))
(defreading mollusk :spine bond-graph :map '((C "mantle") (I "nacre") (R "grain-of-sand")))
(defreading shakespearean :spine bond-graph :map '((C "opportunity") (I "achievement") (R "effort")))
(defreading vanitas :spine bond-graph :map '((C "mortality") (I "beauty") (R "time")))

; The oyster IS the world IS gloria mundi — not metaphorically, but allegorically.
; Same structure (C/I/R), different names. polyread confirms coherence:
(utter! "Structural coherence: " (polyread (list mollusk shakespearean vanitas) oyster))

; Now give the oyster its human-readable names
(alledge oyster
  :as mollusk "a mollusk"
  :as shakespearean "the world"
  :as vanitas "gloria mundi")

; The greeting fans across all readings
(utter! "Hello, " (read-all oyster))
; → Hello, a mollusk
; → Hello, the world
; → Hello, gloria mundi

; Guard: only greet if the oyster resolves to certainty
(utter? "Certainly hello, " (read-all oyster))
; → (nothing — the oyster is polysemous, not certain)

; Pick: greet the first reading only
(utter... "Just hello, " (read-all oyster))
; → Just hello, a mollusk

; Pure functions propagate polysemy automatically
(alledge x :as small 1 :as medium 5 :as large 10)
(utter! "x + 1 = " (+ (read-all x) 1))
; → x + 1 = 2
; → x + 1 = 6
; → x + 1 = 11
