# C2 cycle and M4 plan review

C2 phase order, the D51 start condition, the disjoint T1 and T2 write sets and M4.1–M4.6 coverage pass review.
Two §11 requirements need explicit wording before dispatch.

- T1 must trim latency samples only for overdub and preserve every captured sample on an ordinary input-only take, including when the UI retains a previous calibration value.
- T2 must notify the user after a take with input overflow or output underflow and retain its timed warning entries in lane Properties, since the current T2 wording assigns those warnings only to Properties.

Both corrections fit the existing write sets, stop response and planned acceptance cases.
No additional cases or review round are needed to verify these wording corrections.
