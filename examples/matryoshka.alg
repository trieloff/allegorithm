; matryoshka.alg — Layers and the Left Inverse
;
; A network stack as matryoshka dolls: L2 (Ethernet), L3 (IP), L4 (TCP).
; Each layer wraps the payload with headers.
; wrap produces nested dolls; unwrap strips them.
; Left-inverse: unwrap(wrap(x)) = x — information is preserved.
;
; Then alledge: the same layered structure is both
; a network stack and a compiler pipeline.

; ── 1. Define the layers ────────────────────────────────────────────

(deflayer L2
  (wrap (fn (p) (doll :Ethernet '((:mtu 1500) (:crc 42)) p)))
  (unwrap (fn (d) (payload d))))

(deflayer L3
  (wrap (fn (p) (doll :IP '((:src "10.0.0.1") (:dst "10.0.0.2") (:ttl 64)) p)))
  (unwrap (fn (d) (payload d))))

(deflayer L4
  (wrap (fn (p) (doll :TCP '((:sport 443) (:dport 51732) (:seq 1)) p)))
  (unwrap (fn (d) (payload d))))

; ── 2. Compose into a stack ─────────────────────────────────────────

(defstack net (list L2 L3 L4))

; ── 3. Wrap a message ───────────────────────────────────────────────

(def message "hello")
(def packet (wrap net message))

(utter! "=== Wrapping ===")
(utter! "Original:  " message)
(utter! "Wrapped:   " packet)

; ── 4. Inspect headers at each layer ────────────────────────────────

(utter! "")
(utter! "=== Header Inspection ===")
(utter! "TCP source port: " (hdr packet :sport))
(utter! "IP source addr:  " (hdr (payload packet) :src))
(utter! "Ethernet MTU:    " (hdr (payload (payload packet)) :mtu))

; ── 5. Unwrap — the left inverse ────────────────────────────────────

(def recovered (unwrap net packet))

(utter! "")
(utter! "=== Left Inverse: unwrap(wrap(x)) = x ===")
(utter! "Recovered: " recovered)
(utter! "Equal?     " (= message recovered))

; ── 6. Alledge: two readings of the same structure ──────────────────
; A network stack and a compiler pipeline share the same shape:
; layers that wrap and unwrap, each adding/removing structure.

(alledge net
  :as network "a network stack (Ethernet → IP → TCP)"
  :as compiler "a compiler pipeline (Lexer → Parser → Codegen)")

(utter! "")
(utter! "=== Allegory ===")
(utter! "This structure is: " (read-all net))
