# Desktop Procurement Officer Related Tenders — Design

Enhance `ProcurementOfficersEndpoint`, `toOfficerIngest`, and the existing repository. No local schema change is necessary: migration `0005_procurement_officers.sql` already creates `officer_tender_links`. The regular runner performs a full scan after completing its cursor, so the next successful sync hydrates historic links without a second sync path.
