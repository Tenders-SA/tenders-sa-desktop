# Integration evaluation — desktop tender analysis workbench

The existing `GET /api/tenders/[id]` route already returns document metadata and
the seven stored legacy analysis fields for every tender document. The desktop
previously discarded those nested analysis records at its Zod boundary.

The correct integration is entirely desktop-side: retain the existing response,
derive presentation state locally, and connect the result to existing downloads
and application preparation. Main-application server components have additional
database-only fields; those are reference material, not permission to alter the
parent or invent a desktop contract.
