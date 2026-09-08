---
name: Firebase access model
description: The security boundary used by the shared Shop Bridge Firebase lane.
---

Anonymous Firebase sessions are intentionally used as a lightweight gate for the two-shop lane, not as role authorization. Realtime Database rules should require `auth != null`, validate the known order/inventory/restock shapes, and keep the order lifecycle one-way. Anyone who knows the shared URL can still obtain an anonymous session, so role-specific permissions require a later move to a stronger identity model.

**Why:** The frontend is a static app with no shop account flow, while unauthenticated Realtime Database access would expose the entire shared record to public traffic.

**How to apply:** Keep setup instructions explicit that Anonymous sign-in must be enabled and that the URL is only for the two shop teams. Add custom claims or another role-aware identity mechanism before treating Shop 1/Shop 2 write separation as a security boundary.