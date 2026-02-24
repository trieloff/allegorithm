; Contradictions as first-class values.
; "And there is meaning in the contradictions."

; First, establish conflicting evidence
(affirm safe :because "all tests pass")
(deny safe :because "security audit failed")

; Now query the claim — it's BOTH true and false
(def verdict (claim safe))
(println "Is it safe? " verdict)

; The critical moment: if on a contradiction evaluates BOTH branches
(def result
  (if verdict
    "proceed with deployment"
    "halt and investigate"))

(println "Decision: " result)
(println "Tension:  " (contra-tension result))

; The contradiction IS the information.
; A system that hides its contradictions is lying.
