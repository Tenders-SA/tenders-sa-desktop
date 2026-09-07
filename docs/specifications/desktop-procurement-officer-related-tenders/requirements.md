# Desktop Procurement Officer Related Tenders — Requirements

## Context

The desktop directory already owns `officer_tender_links`, but its endpoint contract and sync mapper deliberately send an empty list. The parent API is the source of truth.

## Requirements

- [ ] REQ-1: Accept the parent sync payload's additive `tenderLinks` field.
- [ ] REQ-2: Persist links through the existing repository and display them when the detail request is unavailable.
- [ ] REQ-3: Preserve owner isolation, tombstones, and existing sync/error states.

## Success Criteria

- [ ] A normal sync persists each received tender link for its owner.
- [ ] Offline officer detail renders cached link IDs.
- [ ] Tombstones remove cached tender links.
