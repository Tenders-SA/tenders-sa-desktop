

# Agentic Coding Specification: Tenders-SA Desktop Procurement Workspace


NOTE: this must be built as a separate git module 
attached to 
https://github.com/Tenders-SA/tenders-sa-desktop.git


## 1. Project overview

Build a production-ready desktop application for the Tenders-SA procurement intelligence platform.

The application must function as a focused procurement operations environment for companies discovering, evaluating, preparing and managing tender applications.

This must not be a simple desktop wrapper around the existing Tenders-SA website.

The desktop application must combine:

* Tender Radar
* AI Tender Application Workspaces
* Company Profiles
* Supplier Intelligence
* Award Data
* Buyer Intelligence
* JV Partner Discovery
* Supplier and Partner Vetting
* Proposal Management
* Compliance Management
* Document Management
* Bid Collaboration
* Submission Validation
* Post-submission Tracking

The product must guide a company through the complete tender lifecycle.

The primary workflow is:

1. Discover a relevant tender.
2. Analyse the tender requirements.
3. Review the buyer and historical award data.
4. Compare the tender requirements against the company profile.
5. Identify compliance, experience, capacity and resource gaps.
6. Determine whether the company can bid independently.
7. Search for and evaluate potential suppliers, subcontractors or JV partners.
8. Build a bid team and assign responsibilities.
9. Prepare the technical and commercial proposal.
10. Complete all required returnables.
11. Validate the final submission.
12. Track the tender after submission.
13. Record award or unsuccessful outcome data.
14. Use the outcome to improve future recommendations.

---

# 2. Product objectives

The desktop application must help suppliers and tender teams answer the following questions:

* Which tenders are worth pursuing?
* Does the company meet the requirements?
* What requirements are currently missing?
* Has the buyer awarded similar work before?
* Which companies have previously won similar tenders?
* Which suppliers or partners could strengthen the application?
* Is a proposed JV partner credible and relevant?
* What documents and tasks remain incomplete?
* Is the proposal ready for submission?
* What can be learned from the final outcome?

The application should become the operational layer of Tenders-SA, while the public website remains focused on discovery, SEO, public procurement information and initial user acquisition.

---

# 3. Recommended technology stack

## Desktop

Use:

* Tauri 2
* React
* TypeScript
* Rust
* Vite
* Tailwind CSS
* shadcn/ui or an equivalent accessible component system
* TanStack Query
* Zustand or Redux Toolkit
* React Hook Form
* Zod
* SQLite for local storage and cache
* OS-native secure credential storage

Do not use Electron unless there is a documented technical limitation preventing the use of Tauri.

## Backend integration

The desktop application must consume the existing Tenders-SA backend and APIs.

Do not duplicate existing tender, company, award or user records inside an independent backend.

Use the existing backend as the source of truth for:

* Users
* Organisations
* Company profiles
* Tenders
* Tender documents
* Award records
* Buyers
* Suppliers
* Subscription access
* AI analyses
* Workspaces
* Notifications

Use local SQLite only for:

* Cached data
* Offline workspace state
* Local document references
* Pending synchronisation operations
* User interface preferences
* Recently accessed records

---

# 4. Core architecture principles

## 4.1 One integrated procurement workflow

Do not build Tender Radar, JV Partner, Company Intelligence and Proposal Management as unrelated sections.

Each module must feed data into the tender application workspace.

Example:

* Tender Radar finds an opportunity.
* AI analysis extracts the requirements.
* Company Profile evaluates internal capability.
* Award Data reveals previous suppliers and award behaviour.
* JV Partner Search finds companies capable of filling gaps.
* Supplier Vetting evaluates the selected companies.
* Proposal Management assigns proposal sections and responsibilities.
* Document Management tracks evidence and returnables.
* Submission Validation confirms readiness.

## 4.2 Data provenance

Any intelligence generated from tender documents, supplier profiles or award records must retain its source.

AI-extracted information must include:

* Source document
* Page number where available
* Original text
* Structured interpretation
* Confidence score
* Extraction timestamp
* User verification state

Do not present AI-derived information as verified fact without showing its source.

## 4.3 Human approval

AI should assist with analysis and drafting, but must not automatically submit tenders, approve pricing or commit the company to a JV arrangement.

Require human approval for:

* Bid decisions
* Partner selection
* Pricing
* Proposal completion
* Final submission packs
* Company profile changes
* Compliance status overrides

## 4.4 Existing Tenders-SA data

The application must use existing Tenders-SA data from the beginning, including:

* Tender records
* Tender documents
* Organisation records
* Supplier records
* Company profiles
* Award records
* Previous winner information
* Procurement categories
* Geographic data
* Buyer activity
* User and account data

Do not treat award intelligence and company information as optional later-stage enhancements.

They are foundational to opportunity evaluation and partner selection.

---

# 5. Primary navigation

Use a desktop sidebar with the following structure:

```text
Tenders-SA Desktop

Command Centre
Tender Radar
Opportunities
Application Workspaces
Proposals
Calendar
Tasks

Company Profile
Company Document Vault
JV and Partner Network
Supplier Intelligence
Buyer Intelligence
Award Intelligence

Notifications
Reports
Settings
```

The default screen after login should be the Command Centre or Tender Radar.

---

# 6. Core modules

## 6.1 Command Centre

Create a dashboard showing the user’s current procurement activity.

Include:

* New tender matches
* High-priority opportunities
* Opportunities awaiting bid decisions
* Active applications
* Applications closing within seven days
* Mandatory requirements still missing
* Pending approvals
* JV or supplier vetting requests
* Proposal sections awaiting completion
* Submitted tenders awaiting results
* Total potential tender value
* Recent award activity
* Expiring company documents

Example summary cards:

```text
New matches: 24
High-match opportunities: 7
Active applications: 5
Closing this week: 3
Missing mandatory items: 11
Potential bid value: R18.4 million
```

Add an activity feed for:

* Tender updates
* Workspace changes
* Document uploads
* Proposal approvals
* Partner invitations
* Addenda
* Deadline changes
* Award announcements

---

## 6.2 Tender Radar

Tender Radar must match available tenders against the user’s company profile.

Matching factors should include:

* Industry
* Procurement category
* Keywords
* Province
* Municipality
* Operating regions
* CIDB grading
* B-BBEE profile
* Required certifications
* Company experience
* Previous projects
* Available personnel
* Available equipment
* Financial capacity
* Tender value
* Tender closing date
* Buyer history
* Historical award patterns
* Existing partner network

Each radar result must show:

* Tender title
* Reference number
* Buyer
* Province
* Closing date
* Countdown
* Match score
* Company readiness score
* Opportunity risk score
* Estimated complexity
* Mandatory requirements detected
* Missing internal requirements
* Potential need for a JV or supplier
* Historical award data availability
* Assigned owner
* Current pipeline status

Actions:

* Open tender
* Run or refresh AI analysis
* Move to review
* Record bid/no-bid decision
* Create application workspace
* Add reminder
* Assign team member
* Find potential partner
* Ignore opportunity
* Add internal note

---

## 6.3 Opportunity Assessment

Before creating a full application workspace, provide an opportunity-assessment screen.

Sections:

### Tender summary

* Scope
* Buyer
* Closing date
* Submission method
* Briefing session
* Estimated contract duration
* Estimated value where available
* Tender category
* Geographic area

### AI requirement summary

* Mandatory requirements
* Evaluation criteria
* Functionality requirements
* Pricing requirements
* Personnel requirements
* Experience requirements
* Equipment requirements
* Certifications
* Returnables
* Submission conditions
* Disqualification risks

### Internal readiness

Compare the tender with the company profile.

Show:

* Requirements met
* Requirements partially met
* Requirements missing
* Requirements requiring verification
* Documents expiring before submission
* Experience gaps
* Personnel gaps
* Equipment gaps
* Geographic capacity gaps
* Financial-capacity gaps

### Buyer intelligence

Show:

* Buyer’s active tenders
* Previous awards
* Average award values
* Common procurement categories
* Frequently awarded suppliers
* Tender cancellation history
* Re-advertisement history
* Typical procurement timelines
* Geographic spending patterns

### Award intelligence

Show historical awards related to:

* The same buyer
* Similar tender categories
* Similar descriptions
* Similar geographic areas
* Similar contract values
* The same incumbent supplier where known

### Recommendation

Generate a bid/no-bid recommendation using explainable factors.

Possible outcomes:

* Strong bid
* Bid with minor gaps
* Bid with partner support
* High-risk bid
* Do not bid
* Insufficient information

The recommendation must explain the reasons and allow user override.

---

## 6.4 AI Tender Application Workspace

A workspace must be created for each tender the company decides to pursue.

Workspace tabs:

1. Overview
2. AI Analysis
3. Requirements
4. Compliance
5. Team
6. JV and Suppliers
7. Documents
8. Proposal
9. Pricing
10. Returnables
11. Approvals
12. Submission
13. Activity
14. Outcome

---

# 7. Workspace tab requirements

## 7.1 Overview

Show:

* Tender title
* Tender reference
* Buyer
* Closing date
* Internal deadline
* Briefing session
* Submission method
* Bid owner
* Current stage
* Completion percentage
* Readiness score
* Risk score
* Partner status
* Proposal status
* Pricing status
* Submission status

Include a visible deadline timeline.

---

## 7.2 AI Analysis

Extract and structure:

* Scope of work
* Deliverables
* Mandatory requirements
* Evaluation criteria
* Functionality scoring
* Technical requirements
* Pricing requirements
* Personnel requirements
* Experience requirements
* Equipment requirements
* Certifications
* Briefing requirements
* Submission instructions
* Important dates
* Forms and returnables
* Contract conditions
* Disqualification risks
* Ambiguous clauses

Classify each finding as:

* Mandatory
* Scored
* Recommended
* Informational
* Unclear
* Potential risk

Allow users to verify, edit or reject AI findings.

---

## 7.3 Requirements

Convert the AI analysis into a structured requirements register.

Each requirement must contain:

* Requirement title
* Description
* Category
* Mandatory status
* Source document
* Source page
* Evidence required
* Internal owner
* Current status
* Due date
* Linked company evidence
* Linked supplier or partner evidence
* Notes
* Verification status

Statuses:

* Not assessed
* Met
* Partially met
* Missing
* Partner required
* Pending evidence
* Requires clarification
* Not applicable

---

## 7.4 Compliance

Track compliance items such as:

* CSD registration
* SARS tax compliance
* B-BBEE documentation
* CIDB registration
* COIDA
* UIF
* Company registration
* Municipal account
* Banking confirmation
* Insurance
* Professional registrations
* Industry certifications
* Safety documentation
* Quality certifications
* Signed declarations
* Conflict-of-interest forms
* Compulsory briefing attendance

The system must compare tender requirements with the Company Document Vault.

Warn when:

* Documents are missing
* Documents are expired
* Documents will expire before the closing date
* Company names differ across documents
* Registration numbers appear inconsistent
* Uploaded evidence does not satisfy the requirement
* A partner must supply the missing evidence

---

## 7.5 Team

Support internal collaboration.

Features:

* Workspace members
* Roles
* Task assignment
* Due dates
* Mentions
* Comments
* Approval requests
* Workload visibility
* Activity history
* External consultant access
* Limited partner access

Suggested roles:

* Workspace owner
* Bid manager
* Technical contributor
* Compliance officer
* Pricing contributor
* Reviewer
* Approver
* External consultant
* JV partner representative

Use role-based permissions.

---

# 8. JV and Supplier Integration

## 8.1 Purpose

JV and supplier selection must be part of the active tender workflow.

The system must identify gaps that could be filled by:

* Joint venture partners
* Subcontractors
* Product suppliers
* Service providers
* Specialist consultants
* Equipment providers
* Local delivery partners

## 8.2 Gap-driven partner search

Users should not only search companies manually.

The application should generate partner-search criteria from identified tender gaps.

Examples:

* Required CIDB grade is higher than the applicant’s grade.
* The tender requires local presence in another province.
* Specialist experience is missing.
* Required equipment is unavailable.
* The company lacks a particular professional registration.
* Minimum turnover or financial capacity is not met.
* The tender requires a stronger B-BBEE profile.
* Previous comparable project experience is insufficient.

Create an action:

**Find partners for identified gaps**

The partner search should use:

* Existing Tenders-SA company profiles
* Supplier data
* Award data
* Previous tender participation
* Procurement categories
* Location
* CIDB information
* B-BBEE information
* Experience records
* Award history
* Existing user profiles
* Saved partner relationships

---

## 8.3 Partner search results

Each result should show:

* Company name
* Company profile summary
* Location
* Operating regions
* Categories
* CIDB grading
* B-BBEE level where available
* Previous awards
* Relevant completed work
* Buyers previously served
* Similar tender experience
* Match score
* Gap coverage
* Risk indicators
* Data completeness
* Contact status
* Existing relationship status

Explain why the company is recommended.

Example:

```text
Recommended because:
- Holds the required CIDB grading
- Previously won two similar municipal contracts
- Operates in the required province
- Provides the missing electrical engineering capability
```

---

## 8.4 Partner vetting

Allow the applicant to vet a potential partner using existing Tenders-SA supplier and award information.

The vetting screen should include:

* Company profile
* Registration details
* Contact details
* Operating areas
* Tender categories
* Award history
* Known buyers
* Contract values
* Frequency of awards
* Relevant experience
* Possible duplicate or linked-company indicators
* Restricted supplier status where available
* Compliance data where available
* Existing public-sector relationships
* Current active tenders
* Data confidence
* User-supplied private notes

The system should generate:

* Capability score
* Relevance score
* Award-history score
* Data-confidence score
* Potential risk score
* Overall partner-fit score

Do not make legal claims or automatically declare a company legitimate or illegitimate.

Use language such as:

* Strong evidence available
* Limited public data
* Potential inconsistency detected
* Requires manual verification
* Relevant award history found
* No related award history found

---

## 8.5 Partner shortlist

Allow users to:

* Save partner candidates
* Compare companies side by side
* Request internal review
* Record contact attempts
* Invite a company
* Upload partner documents
* Assign requirements to a partner
* Record partner acceptance
* Record partner rejection
* Mark preferred partner
* Add negotiation notes

Comparison criteria:

* Gap coverage
* Relevant experience
* Award history
* Geography
* Certifications
* Capacity
* B-BBEE contribution
* CIDB contribution
* Risk
* Data completeness
* Commercial terms
* Availability

---

## 8.6 JV structure workspace

After selecting a JV partner, create a JV structure area.

Include:

* JV parties
* Lead partner
* Participation percentages
* Responsibility matrix
* Work allocation
* Personnel allocation
* Equipment allocation
* Pricing allocation
* Compliance responsibility
* Document responsibility
* Proposal responsibility
* Approval authority
* Profit-share notes
* Agreement status
* Signed-document status

The system should highlight possible concerns such as:

* Partner contributes no meaningful operational capability
* Work allocation does not match participation
* Required grading contribution is unclear
* Mandatory documents are still missing
* Roles and responsibilities are incomplete
* Partner evidence has not been verified

The application must support fronting-risk awareness without making a final legal determination.

---

# 9. Company Profiles

Company Profiles must be available from the first release.

A company profile should contain:

* Legal name
* Trading name
* Registration number
* VAT number
* CSD information
* Tax status
* B-BBEE information
* CIDB grades
* Professional registrations
* Directors
* Contact information
* Address
* Operating regions
* Procurement categories
* Products and services
* Personnel
* Qualifications
* Equipment
* Certifications
* Previous projects
* References
* Award history
* Existing suppliers
* Existing partners
* Company documents
* Internal notes

Support profile completeness scoring.

Company profiles may represent:

* The user’s own company
* A supplier
* A subcontractor
* A JV partner
* A historical tender winner
* A potential competitor

Clearly differentiate between:

* User-verified data
* Public-source data
* Award-derived data
* AI-inferred data
* Unverified user-added data

---

# 10. Award Intelligence

Award data must be integrated throughout the application.

## Uses

Award data should support:

* Opportunity evaluation
* Buyer analysis
* Supplier vetting
* Partner discovery
* Competitor analysis
* Pricing context
* Market intelligence
* Post-bid learning

## Award record fields

Use existing Tenders-SA award fields where available.

Conceptually, award records may include:

* Tender reference
* Tender title
* Buyer
* Awarded company
* Award date
* Contract value
* Procurement category
* Location
* Contract duration
* Source
* Related tender
* Related supplier profile

## Workspace integration

Inside an application workspace, show:

* Similar historical awards
* Previous winners
* Incumbent suppliers
* Award values
* Buyer award trends
* Companies repeatedly awarded similar work
* Potential partner candidates derived from award history

Do not use award data to imply corruption or wrongdoing without reliable evidence.

---

# 11. Buyer Intelligence

Create buyer profiles containing:

* Organisation name
* Organisation type
* Geographic jurisdiction
* Active tenders
* Closed tenders
* Awarded tenders
* Common categories
* Average contract values
* Frequent suppliers
* Tender frequency
* Cancellation frequency
* Re-advertisement frequency
* Award timing
* Historical procurement activity

From a tender workspace, users must be able to open the buyer profile without leaving the application flow.

---

# 12. Proposal Management

Proposal Management must be directly connected to the tender workspace.

## 12.1 Proposal structure

Allow users to create or import sections such as:

* Cover letter
* Executive summary
* Company overview
* Tender understanding
* Technical approach
* Methodology
* Work plan
* Project schedule
* Team structure
* Personnel
* Experience
* Equipment
* Quality management
* Risk management
* Health and safety
* Environmental approach
* Local economic development
* Skills transfer
* Transformation
* JV methodology
* Supplier plan
* Pricing narrative
* Appendices

The AI may suggest a proposal structure based on tender documents.

## 12.2 Proposal sections

Each section should have:

* Title
* Instructions
* Source requirement
* Assigned contributor
* Due date
* Draft status
* Review status
* Approval status
* Version history
* Comments
* Evidence links
* AI assistance
* Final content

Statuses:

* Not started
* Drafting
* Ready for review
* Changes requested
* Approved
* Locked

## 12.3 AI proposal assistance

AI functions may include:

* Draft a section from verified company data
* Rewrite for clarity
* Compare draft against evaluation criteria
* Identify unsupported claims
* Suggest missing evidence
* Check consistency
* Identify repeated content
* Summarise technical information
* Convert requirements into response headings

AI must not invent:

* Experience
* Certifications
* Personnel
* Equipment
* Award history
* Financial figures
* Client references

Only use verified workspace and company-profile data.

---

# 13. Document Management

Create a structured document system for:

* Tender documents
* Addenda
* Company documents
* Partner documents
* Supplier quotations
* Technical evidence
* Proposal drafts
* Pricing schedules
* Returnables
* Signed forms
* Final submission documents

Features:

* Drag-and-drop upload
* Folder import
* ZIP import
* AI classification
* Version history
* Expiry tracking
* Duplicate detection
* Document preview
* Source linking
* Requirement linking
* Approval state
* Partner ownership
* Local file mapping
* Cloud synchronisation

Suggested workspace structure:

```text
Tender-Reference/
├── 01-Tender-Documents/
├── 02-Addenda/
├── 03-Requirements/
├── 04-Company-Documents/
├── 05-JV-Partner-Documents/
├── 06-Supplier-Quotations/
├── 07-Technical-Proposal/
├── 08-Pricing/
├── 09-Returnables/
├── 10-Approvals/
└── 11-Final-Submission/
```

---

# 14. Pricing Workspace

Include:

* Line items
* Quantities
* Unit costs
* Supplier costs
* Labour
* Equipment
* Overheads
* Markup
* Contingency
* VAT
* Total price
* JV allocations
* Supplier allocations
* Multiple scenarios
* Internal notes
* Assumptions
* Approval status

Pricing must use stricter permissions than general proposal content.

Support:

* Import from Excel
* Export to Excel
* Prescribed schedule mapping
* Scenario comparison
* Final pricing approval

Do not send pricing to AI services unless explicitly permitted and securely configured.

---

# 15. Returnables Tracker

Automatically identify tender forms and schedules.

Track:

* Form name
* Mandatory status
* Responsible party
* Required signature
* Required witness
* Required stamp
* Completion status
* Linked document
* Validation status
* Included in final pack

Examples:

* SBD forms
* MBD forms
* Pricing schedules
* Preference-point forms
* Declarations
* Bidder information
* Authority-to-sign forms
* JV declarations
* Experience schedules
* Personnel schedules
* Equipment schedules

---

# 16. Approvals

Support approval workflows for:

* Bid/no-bid decision
* Partner selection
* JV structure
* Technical proposal
* Compliance status
* Pricing
* Final submission pack

Each approval must contain:

* Requester
* Approver
* Item
* Date requested
* Due date
* Decision
* Comments
* Timestamp
* Version approved

Maintain an immutable audit history for approval actions.

---

# 17. Submission Validation

Before marking a bid as ready, run a validation process.

Check:

* Mandatory documents
* Required signatures
* Required initials
* Required stamps
* Expired documents
* Document naming
* File-format requirements
* File-size restrictions
* Pricing completeness
* Mathematical inconsistencies
* Returnables completeness
* Partner documents
* JV agreement
* Required declarations
* Technical proposal sections
* Required evidence
* Addenda acknowledged
* Submission method
* Submission deadline

Output:

* Blocking issues
* High-risk issues
* Warnings
* Recommendations
* Passed checks

Only users with permission may override a blocking item.

Record the override reason.

---

# 18. Submission Pack Generator

Generate a final tender submission package.

Support:

* Configurable folder structure
* File naming rules
* Ordered document bundle
* ZIP generation
* Submission manifest
* Validation report
* Workspace archive
* PDF merge where appropriate
* Export to selected local directory

Do not automatically submit bids to external portals unless an authorised integration is deliberately implemented in a later phase.

---

# 19. Post-submission Tracking

After submission, allow the workspace status to move through:

* Submitted
* Clarification requested
* Evaluation
* Shortlisted
* Presentation required
* Negotiation
* Awarded
* Unsuccessful
* Cancelled
* Re-advertised

Track:

* Submission date
* Submission proof
* Clarifications
* Buyer communication
* Presentation dates
* Outcome
* Awarded supplier
* Awarded amount
* Loss reason
* Internal retrospective

Use outcomes to improve:

* Tender matching
* Bid/no-bid recommendations
* Partner recommendations
* Proposal templates
* Readiness scoring

---

# 20. Notifications and Calendar

Create notifications for:

* New tender match
* High-match tender
* Tender addendum
* Closing-date change
* Briefing session
* Clarification deadline
* Internal deadline
* Requirement overdue
* Document expiring
* Partner response
* Approval request
* Proposal section overdue
* Pricing approval overdue
* Submission deadline
* Tender result
* Related award published

Support:

* Desktop notifications
* In-app notifications
* Email preferences through backend integration
* Snooze
* Priority levels
* Notification grouping

Calendar events:

* Briefings
* Site visits
* Clarification deadlines
* Proposal deadlines
* Pricing reviews
* Internal approvals
* Submission deadlines
* Presentations
* Award follow-ups

---

# 21. Offline and Synchronisation Behaviour

The desktop application should support limited offline work.

Cache:

* Active workspaces
* Tender summaries
* Requirements
* Tasks
* Proposal drafts
* Company profile summaries
* Selected documents
* Partner shortlists

Queue mutations while offline.

When connectivity returns:

* Synchronise queued actions
* Detect conflicts
* Preserve local and remote versions
* Request user resolution where required
* Never silently overwrite proposal or pricing data

Show sync status clearly.

---

# 22. Security

Implement:

* Secure token storage
* Encrypted sensitive local data
* Role-based access control
* Session expiry
* Device logout
* Audit logs
* File-access restrictions
* Signed API requests where supported
* Backend permission enforcement
* Local database migrations
* Safe update mechanism
* Sensitive-field masking
* Pricing permission boundaries

Do not rely only on frontend permission checks.

The backend must enforce access.

---

# 23. Suggested core entities

Use existing backend entities where available.

Conceptual entities:

```text
User
Account
Team
TeamMember
Organisation
CompanyProfile
CompanyDocument
CompanyCapability
CompanyExperience
CompanyPersonnel
CompanyEquipment
SupplierProfile
PartnerRelationship
Tender
TenderDocument
TenderAddendum
TenderMatch
TenderAnalysis
TenderRequirement
BuyerProfile
Award
Opportunity
BidDecision
ApplicationWorkspace
WorkspaceMember
WorkspaceTask
WorkspaceDocument
DocumentVersion
ComplianceItem
PartnerGap
PartnerCandidate
PartnerAssessment
JVStructure
JVParticipant
JVResponsibility
Proposal
ProposalSection
ProposalVersion
PricingScenario
PricingLineItem
Returnable
Approval
CalendarEvent
Reminder
Notification
SubmissionPackage
SubmissionRecord
TenderOutcome
ActivityLog
SyncOperation
```

Do not create duplicate records when a suitable existing Tenders-SA model already exists.

Map existing models before introducing new ones.

---

# 24. API requirements

The coding agent must first audit the existing Tenders-SA APIs and data models.

Create an API integration map covering:

* Existing endpoint
* Authentication requirements
* Request type
* Response type
* Desktop use case
* Missing capability
* Proposed new endpoint if required

Potential API groups:

```text
/auth
/users
/accounts
/teams
/company-profiles
/company-documents
/tenders
/tender-documents
/tender-analysis
/tender-matches
/organisations
/buyers
/suppliers
/awards
/opportunities
/workspaces
/workspace-requirements
/workspace-documents
/workspace-members
/workspace-tasks
/partners
/jv-structures
/proposals
/pricing
/returnables
/approvals
/submissions
/outcomes
/notifications
/calendar
/sync
```

Use typed API clients.

Generate TypeScript types from OpenAPI where possible.

---

# 25. User interface requirements

The interface should feel like a professional procurement operations platform.

Use:

* Dense but readable information layouts
* Clear status indicators
* Tables for comparison
* Kanban where workflow stages benefit
* Side panels for quick inspection
* Split views for tender documents and extracted requirements
* Keyboard shortcuts
* Command palette
* Global search
* Saved filters
* Persistent workspace navigation
* Autosave
* Visible sync status

Avoid:

* Excessive marketing content
* Large decorative hero sections
* Consumer-style card overload
* Hidden critical actions
* AI chat as the primary interface

AI should be embedded into relevant workflows rather than placed only in a generic chat window.

---

# 26. Development phases

## Phase 0: Repository and architecture setup

Deliver:

* Tauri 2 project
* React and TypeScript setup
* Folder architecture
* Linting
* Formatting
* Testing framework
* Environment management
* Secure configuration strategy
* Local SQLite setup
* Database migration system
* API-client foundation
* Authentication shell
* Error handling
* Logging
* CI workflow
* Developer documentation

Exit criteria:

* Application builds on Windows.
* Login shell works.
* API client can call a test endpoint.
* Local database migrations run.
* CI validates lint, type checks and tests.

---

## Phase 1: Data and API audit

Audit the existing Tenders-SA codebase and backend.

Deliver:

* Existing model inventory
* Existing endpoint inventory
* Authentication flow
* Tender-data mapping
* Company-profile mapping
* Supplier-data mapping
* Award-data mapping
* User and subscription mapping
* Missing endpoint report
* Recommended API additions
* Type definitions

Do not start building duplicate backend services before completing this audit.

Exit criteria:

* Desktop data requirements are mapped to existing backend data.
* Missing APIs are clearly documented.
* Source-of-truth ownership is defined.

---

## Phase 2: Authentication and desktop shell

Build:

* Login
* Logout
* Session persistence
* Secure token storage
* Sidebar navigation
* Command palette
* Account switcher where supported
* Team selector
* Subscription access handling
* Settings
* Error boundaries
* Sync-status indicator

Exit criteria:

* Users can authenticate securely.
* Navigation works.
* Protected routes are enforced.
* Session restoration works.

---

## Phase 3: Company Profiles and Company Vault

Build these before Tender Radar scoring.

Features:

* Own-company profile
* Profile completeness
* Capabilities
* Categories
* Locations
* CIDB
* B-BBEE
* Personnel
* Equipment
* Certifications
* Experience
* References
* Document Vault
* Expiry tracking
* Verification labels

Exit criteria:

* A company can maintain the core profile used for tender matching.
* Company documents can be uploaded and linked to profile attributes.
* Profile data can distinguish public, verified and inferred sources.

---

## Phase 4: Award, Supplier and Buyer Intelligence

Build:

* Supplier profiles
* Buyer profiles
* Award search
* Award detail
* Historical-award relationships
* Similar award retrieval
* Supplier-award history
* Buyer-award trends
* Company comparison

Exit criteria:

* Users can inspect a company’s relevant award history.
* Users can inspect buyer procurement behaviour.
* Award records are connected to tenders and company profiles where possible.

---

## Phase 5: Tender Radar

Build:

* Tender feed
* Search
* Filters
* Saved filters
* Tender cards
* Match scoring
* Readiness scoring
* Risk indicators
* Pipeline status
* Assignment
* Notifications
* Tender detail view

Exit criteria:

* Users can discover tenders matched against their profile.
* Match explanations are visible.
* Users can move opportunities into review.

---

## Phase 6: Opportunity Assessment

Build:

* Tender analysis
* Requirement summary
* Internal gap analysis
* Buyer intelligence
* Similar award intelligence
* Bid/no-bid recommendation
* Bid decision
* Create workspace

Exit criteria:

* Users can make an informed bid decision using tender, company, buyer and award information.
* A workspace can be created from an approved opportunity.

---

## Phase 7: Application Workspace Core

Build:

* Workspace overview
* Requirements register
* Compliance checklist
* Tasks
* Workspace members
* Activity history
* Deadline timeline
* Document linking

Exit criteria:

* A bid manager can manage the core tender-response workflow.
* Requirements are traceable to source documents.
* Tasks and compliance items can be assigned.

---

## Phase 8: JV Partner and Supplier Workflow

Build:

* Gap-driven partner search
* Partner recommendations
* Supplier profiles
* Award-based vetting
* Partner comparison
* Shortlists
* Invitations
* Partner document requests
* Requirement assignment
* JV structure
* Responsibility matrix
* Participation model
* Risk indicators

Exit criteria:

* Users can identify missing capabilities.
* Users can search and vet potential partners using existing supplier and award information.
* A selected partner can be integrated into the application workspace.

---

## Phase 9: Proposal Management

Build:

* Proposal structure
* Proposal sections
* Contributor assignments
* AI drafting assistance
* Source-linked drafting
* Review workflow
* Comments
* Version history
* Approval
* Export

Exit criteria:

* Teams can draft, review and approve a structured proposal.
* AI drafting only uses verified company and workspace data.
* Unsupported claims are highlighted.

---

## Phase 10: Pricing and Returnables

Build:

* Pricing scenarios
* Line items
* Excel import and export
* Approval permissions
* Returnables extraction
* Completion tracker
* Signature tracker
* Linked documents

Exit criteria:

* Pricing is permission controlled.
* Required forms and schedules are trackable.
* Final values can be approved and locked.

---

## Phase 11: Submission Validation and Packaging

Build:

* Validation engine
* Blocking issues
* Warnings
* Override workflow
* Submission manifest
* Folder generation
* ZIP generation
* Final archive
* Submission record

Exit criteria:

* The application can detect incomplete mandatory items.
* A validated submission package can be exported.
* Validation results are retained.

---

## Phase 12: Calendar, Notifications and Offline Sync

Build:

* Calendar
* Desktop notifications
* Reminder rules
* Local cache
* Offline editing
* Sync queue
* Conflict resolution
* Sync logs

Exit criteria:

* Users can work on active workspaces with intermittent connectivity.
* Changes synchronise safely.
* Conflicts are not silently overwritten.

---

## Phase 13: Post-submission and Reporting

Build:

* Submission tracking
* Clarifications
* Presentation tracking
* Outcomes
* Award linking
* Retrospectives
* Win/loss analytics
* Bid performance reports
* Partner performance
* Buyer performance
* Category performance

Exit criteria:

* Submitted tenders can be tracked to outcome.
* Results feed future matching and decision support.

---

# 27. Testing strategy

Implement:

## Unit tests

Test:

* Scoring logic
* Requirement status logic
* Validation rules
* Permission rules
* Sync-state transitions
* Document-expiry rules
* Partner-fit calculations
* Proposal status transitions

## Integration tests

Test:

* API authentication
* Tender retrieval
* Company-profile retrieval
* Award retrieval
* Workspace creation
* Document upload
* Partner selection
* Proposal save
* Submission pack generation

## End-to-end tests

Critical flows:

1. Login.
2. Complete company profile.
3. Open Tender Radar.
4. Review a tender.
5. Inspect buyer and award intelligence.
6. Create workspace.
7. Identify missing capability.
8. Find and vet a partner.
9. Add the partner to the bid.
10. Complete proposal sections.
11. Complete returnables.
12. Validate submission.
13. Export submission pack.
14. Record outcome.

---

# 28. Repository structure

Use a maintainable structure similar to:

```text
src/
├── app/
│   ├── router/
│   ├── providers/
│   └── layouts/
├── components/
│   ├── common/
│   ├── forms/
│   ├── tables/
│   └── navigation/
├── features/
│   ├── auth/
│   ├── command-centre/
│   ├── company-profile/
│   ├── company-vault/
│   ├── tender-radar/
│   ├── opportunities/
│   ├── workspaces/
│   ├── requirements/
│   ├── compliance/
│   ├── suppliers/
│   ├── partners/
│   ├── jv/
│   ├── awards/
│   ├── buyers/
│   ├── proposals/
│   ├── pricing/
│   ├── returnables/
│   ├── submissions/
│   ├── notifications/
│   ├── calendar/
│   └── reports/
├── services/
│   ├── api/
│   ├── auth/
│   ├── sync/
│   ├── storage/
│   └── documents/
├── db/
│   ├── migrations/
│   ├── repositories/
│   └── schema/
├── hooks/
├── lib/
├── types/
└── tests/

src-tauri/
├── src/
├── capabilities/
├── migrations/
└── tauri.conf.json
```

Organise by feature rather than placing all screens, hooks and services into broad generic folders.

---

# 29. Coding rules

The coding agent must:

* Use strict TypeScript.
* Avoid `any`.
* Validate API responses.
* Use Zod schemas where appropriate.
* Add error handling.
* Add loading and empty states.
* Add permission checks.
* Add tests for new business logic.
* Document architecture decisions.
* Reuse existing backend capabilities.
* Avoid speculative schema changes.
* Avoid silently changing existing Tenders-SA behaviour.
* Keep migrations reversible.
* Use feature flags for incomplete modules.
* Never commit secrets.
* Never hard-code production endpoints.
* Preserve source provenance for AI output.
* Keep pricing and sensitive data isolated.
* Keep desktop cache separate from server truth.

---

# 30. Agent execution instructions

Before writing code:

1. Inspect the repository.
2. Identify the current frontend and backend architecture.
3. Locate existing models and APIs.
4. Produce an architecture summary.
5. Produce a gap analysis.
6. Produce an implementation checklist for the current phase.
7. Only then begin implementation.

For every phase:

1. State the phase objective.
2. List files to be created or changed.
3. Identify reused existing components and APIs.
4. Implement the smallest complete vertical slice.
5. Run type checks.
6. Run linting.
7. Run tests.
8. Run a desktop build.
9. Report failures honestly.
10. Update implementation documentation.

Do not attempt all phases in one unreviewable change.

Use one focused branch or pull request per phase or major vertical slice.

---

# 31. Initial implementation task

Begin with Phase 0 and Phase 1 only.

The first deliverable must include:

* A working Tauri 2 desktop shell
* React and TypeScript frontend
* Local SQLite setup
* Secure configuration approach
* Typed API-client foundation
* Authentication interface shell
* Repository architecture
* Testing setup
* CI configuration
* Existing Tenders-SA model inventory
* Existing Tenders-SA API inventory
* Company-profile data mapping
* Tender-data mapping
* Award-data mapping
* Supplier-data mapping
* Buyer-data mapping
* Workspace capability gap report
* Proposed implementation plan for Phase 2

Do not implement mock production APIs where existing APIs can be inspected.

Where backend access is unavailable, create explicit interface contracts and mark them as awaiting backend confirmation.

---

# 32. Definition of success

The product is successful when a company can:

1. Discover a suitable tender.
2. Understand why it matches.
3. Review the buyer’s procurement activity.
4. Review similar historical awards.
5. Evaluate its own readiness.
6. Identify missing capability.
7. Find and vet a suitable supplier or JV partner.
8. Integrate that partner into the bid structure.
9. Assign requirements, documents and proposal sections.
10. Prepare and approve the technical and commercial response.
11. Validate every mandatory submission item.
12. Export a complete tender submission pack.
13. Track the submission to its outcome.
14. Use that outcome to improve future tender decisions.

The application must make tender discovery, supplier intelligence, partner vetting, proposal preparation and submission management feel like one connected process rather than a collection of unrelated tools.
