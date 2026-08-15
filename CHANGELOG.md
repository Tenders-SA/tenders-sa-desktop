# Changelog

All notable changes to the Tenders-SA desktop application are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Previously opened tenders, Radar matches, applications, analysis and tender
  documents now remain available in an account-isolated local workspace. Saved
  results appear immediately while updates run in the background, response
  saves resume after reconnecting, and competing local/server edits are kept
  for explicit review instead of silently overwriting either version.
- A side-by-side tender document viewer that keeps the original file, its
  document-specific extracted analysis, and the tender's file list together.
  PDF files include page and zoom controls, while unsupported formats provide
  a clear download fallback.
- Tender document Open actions now lead to the internal desktop viewer from
  tender details, application workspaces, and response-drafting references;
  Download continues to save the original file.
- Response-document drafts are now saved locally as you type and restored when
  you reopen a document, so unsaved work survives an app restart.
- When a save cannot reach the server (offline or a timeout), the response
  editor queues it locally, shows "Saved locally — pending sync", and offers a
  Sync now action that replays queued saves in order when connectivity
  returns.
- A local version history for response documents: every successful save
  snapshots the previous content, and the editor can restore any listed
  version (disabled while the editor has unsaved edits).
- A response-document list on the Draft stage: opening the draft workbench
  without picking a document shows every planned document with its status, and
  selecting one opens its editor. Deep links into a specific document still
  open directly.
- A "Generate all remaining" action on the Draft stage list, one explicit press
  per plan, that starts generation for every document that has no saved content
  yet and reports plan/precondition failures per document.
- A multiline AI instruction composer in the response editor, sent with the
  next Generate or Regenerate request and cleared once it is accepted.
- A full-screen response-document editor for tender applications, with a
  document navigator, drafting references, Markdown formatting controls and
  explicit save, revert and generation actions, plus Save, Discard or Stay
  protection when leaving with unsaved work.
- A desktop tender analysis workbench that puts AI-analyzed compliance and
  submission requirements first, retains source-document references, shows
  analysis coverage, and keeps the application workspace as the next step.
- A desktop company profile studio that loads the complete company record and
  supports deliberate, section-based editing without leaving the application.
- Industry-aware certification guidance, including issuing bodies and clear
  commonly-required versus recommended indicators while preserving custom
  company evidence.
- Company-specific matched and scored tender browsing alongside the complete
  tender catalogue.
- A command-centre workbench with a visual activity timeline and prioritised
  attention items for tender preparation.

### Changed

- The desktop application now carries its own teal app icon across the window,
  taskbar, shortcuts, installer, and operating-system search results, so it is
  distinguishable at a glance from the Tenders-SA website while keeping the same
  recognisable graph mark.
- Tender Radar now opens the full decision workspace used by the main service,
  with plan-aware match limits, score bands, filters, decision cards, saved
  state, profile guidance, and Professional/Enterprise scenario previews. The
  compact Radar view remains available inside tender discovery.
- The primary sidebar now pairs every destination with a familiar icon and uses
  the official Tenders-SA mark in both the application shell and Windows app
  packaging.
- The response editor toolbar now uses familiar document-formatting icons,
  grouped controls, a single text-style selector and a compact table menu,
  making common editing and export actions faster to recognise.
- Response drafting now uses compact document and status icons, readable
  official-file labels, a dark-theme writing canvas and a persistent AI
  instruction composer for generating or refining the selected response.
- The tender response editor is now a full-screen visual document workbench:
  headings, lists, links and tables render as normal document content, the
  document/reference rails can be collapsed, and PDF or Word response packages
  can be downloaded without leaving the editor. Unsaved edits are saved before
  export so the downloaded package cannot silently lag behind the draft.
- Draft now follows each tender's complete response blueprint, including
  AI-added and tender-specific documents, while keeping the selected document
  stable as the plan refreshes.
- Pricing schedules and other structured working drafts now point users back to
  the official tender files they must complete and verify before submission.
- Reworked tender detail headers into an opportunity snapshot and moved the
  available AI summary and key requirements above the full compliance analysis
  for faster first-pass bid assessment.
- Grouped AI-analyzed tender findings beneath their source document so business
  users can read each set of requirements continuously without repeated file
  labels interrupting every point.
- Refined the sign-in experience to present Tenders-SA as a focused business
  procurement workspace from first launch.
- Improved tender cards and navigation for faster opportunity assessment in a
  desktop environment.
- Expanded company profile visibility to include CIDB grading, project
  experience, personnel, operating regions, capabilities, and certifications.

### Fixed

- The Opportunities screen now opens and lists your shortlisted tenders
  instead of reporting that they could not be loaded. It also states plainly
  that it holds tenders awaiting a bid decision, rather than implying it shows
  tenders matched to your company — those remain in Tender Radar. Narrowing to
  tenders still open stays available as a filter.
- Tender applications can now open from their available workspace summary
  while slower full details continue loading, instead of keeping the entire
  workspace behind a loading screen.
- Saved applications and their tender analysis now open from the local
  workspace when connectivity is unavailable, while still refreshing from the
  service when it is reachable.
- Tender files now continue opening from the service when local cache metadata
  or file persistence is unavailable, instead of reporting that Tenders-SA
  could not be reached after a successful download.
- Offline response-document sync state is now isolated to the signed-in
  account while remaining compatible with edits already queued locally.
- Response documents now continue loading when older stored workspace data
  contains nullable metadata or invalid empty map entries; valid Markdown
  drafts are preserved instead of rejecting the entire response as unsupported.
- The full-screen response editor now reports generation failures inline — a
  missing paid plan, incomplete required information, or a failed generation
  each show their own clear message and a Retry action instead of silently
  doing nothing or showing raw server text.
- Generated documents now indicate when they are a saved template or still
  contain unresolved placeholders, and a generation that outlives the status
  refresh window offers a "Check again" action instead of locking the editor.
- Document references no longer disappear at narrower window sizes — they open
  in a labelled drawer — and no longer use the desktop's own keyword matching to
  guess which tender files are relevant.
- Missing or retired response-document keys now show a clear recovery screen
  instead of silently opening Cover Letter or leaving the Draft workflow.
- Every Draft response-document link now opens its intended full-screen editor,
  including document names containing spaces, slashes or other URL characters.
- Switching between Draft response documents now stays inside the full-screen
  editor and opens either the saved response or an empty document ready to
  generate and edit.
- The tender application assistance workspace now uses the available desktop
  window width, giving analysis, qualification and document work a practical
  full-size working area.
- Starting a tender application now creates or opens the company application
  workspace instead of incorrectly reporting that a company profile is missing.
- Tender detail responses that omit list-only identifiers now load correctly
  instead of showing an unsupported-format message.
