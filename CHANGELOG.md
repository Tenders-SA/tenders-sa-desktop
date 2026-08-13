# Changelog

All notable changes to the Tenders-SA desktop application are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

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
