# NagarSetu-Civic

NagarSetu-Civic is a modern, full-stack civic issue reporting and resolution platform connecting citizens, municipal authorities, and field workers. It empowers citizens to report and track municipal problems transparently while enabling local authorities to manage, assign, and verify resolutions across jurisdictional boundaries with end-to-end accountability.

---

## 🌟 Features

### 👤 For Citizens
- **Report civic issues**: Submit municipal grievances with structured details, severity, and category selection.
- **Upload issue photographs**: Attach photographic evidence uploaded directly to secure cloud storage.
- **GPS/location and address information**: Automatic GPS pin detection or manual address selection with geographic coordinates.
- **Select civic issue categories**: Choose from the canonical municipal categories supported by the platform.
- **Track issue status**: Monitor issue lifecycle progress in real time with unique tracking IDs.
- **View issue details**: Inspect complete breakdown including descriptions, timestamps, locations, and updates.
- **Upvote issues**: Database-backed community upvoting to signal urgency and prioritize resolution.
- **Comment on issues**: Participate in civic discussions on specific grievances.
- **Receive notifications**: Receive lifecycle updates on submission, assignment, progress, and resolution.
- **View resolution/proof photographs**: Inspect verified photographic proof uploaded by field workers upon task completion.
- **Submit resolution feedback**: Rate resolution satisfaction and submit feedback to municipal administrators.
- **Escalate an issue when appropriate**: Escalate grievances if resolution is unsatisfactory or delayed.

### 🏛️ For Authority / Administrators
- **Authority dashboard**: Centralized administrative control center scoped to municipal boundaries.
- **View issues within authorized municipal jurisdiction**: Strictly bounded by municipal and ward jurisdictions using Row Level Security (RLS) and geographic authorization.
- **Review issue details and images**: Inspect citizen reports, descriptions, photos, and precise map locations.
- **Assign issues to workers**: Dispatch grievances to qualified municipal workers within corresponding departments and jurisdictions.
- **Reassign workers where authorized**: Reassign tasks as operational requirements dictate while preserving full audit history.
- **Monitor issue status**: Track resolution timelines across submitted, in-progress, resolved, and escalated states.
- **Receive lifecycle notifications**: Alerts on issue submissions, worker assignments, feedback, and escalations.
- **Access municipal/department information**: Manage jurisdictional departments, wards, and personnel.
- **Monitor issue activity and analytics where implemented**: View jurisdictional analytics, issue counts, and performance metrics.

### 👷 For Workers
- **Dedicated worker dashboard**: Mobile-friendly operational interface designed for field personnel.
- **View assigned issues**: Filter and inspect only the issues specifically assigned to the authenticated worker.
- **View original issue photographs**: High-resolution citizen report images to identify problems on-site.
- **View issue location**: Address, coordinates, and direct navigation links to reach grievance locations quickly.
- **Update issue lifecycle status**: Mark issues as in-progress upon arrival and transition to resolved upon completion.
- **Upload resolution/proof photographs**: Capture and submit photo proof directly from the field.
- **Complete assigned tasks**: Submit resolution records and notes that update both authority and citizen views.
- **Worker profile and organizational information**: View role badges, employee IDs, department, and assigned municipality.

---

## 🚀 Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI & Styling**: Tailwind CSS + shadcn/ui components (Radix UI primitives, Lucide icons)
- **Backend / Application Layer**: TypeScript service layer with modular domain services
- **Database**: PostgreSQL through Supabase
- **Authentication**: Supabase Auth (JWT-based session management, secure cookie/token handling)
- **Storage**: Supabase Storage (bucket-based photo uploads for issue reports and resolution proof)
- **Realtime**: Supabase Realtime (WebSocket channels for instant issue updates and notifications)
- **Maps / Location**: Google Maps integration (interactive maps, coordinate normalization, geocoding)
- **Validation**: Zod (type-safe runtime validation schemas for API and domain boundaries)
- **Deployment**: Vercel

*Supabase provides PostgreSQL, authentication, storage, and realtime infrastructure.*

---

## 🏗️ Architecture

```
Frontend
    ↓
Backend Services
    ↓
Supabase
    ├── PostgreSQL
    ├── Auth
    ├── Storage
    └── Realtime
```

Business logic is organized in modular backend services:
```
backend/services/
├── auth/           # Authentication, role checking, & official verification
├── issues/         # Issue lifecycle, query filters, & duplicate detection
├── workers/        # Worker task assignments & status transitions
├── notifications/  # Lifecycle event notifications & dispatching
├── storage/        # Image compression, upload validation, & storage handling
├── ai/             # AI-assisted vision analysis & categorization
└── maps/           # Geolocation math, boundary verification, & navigation links
```

PostgreSQL Row Level Security (RLS) and application-level authorization enforce access boundaries across every layer. The frontend consumes these backend services rather than owning business logic directly.

---

## 🔄 Issue Lifecycle

Issue state transitions are governed by the application's authorization and status-transition rules:

```
Citizen reports issue
        ↓
Issue submitted
        ↓
Authority reviews
        ↓
Worker assigned
        ↓
In progress
        ↓
Resolved
        ↓
Citizen feedback
        ↓
Escalation/review when applicable
```

---

## 📂 Issue Categories

The platform supports 7 canonical municipal categories corresponding directly to the PostgreSQL enum `public.issue_category`:

1. **Cleanliness** (`cleanliness`): General public area cleaning and sanitation needs.
2. **Dead Animal** (`dead_animal`): Carcass removal requiring urgent sanitary disposal.
3. **Garbage Dump** (`garbage_dump`): Large illegal garbage accumulation or overflowing bins.
4. **Littering** (`littering`): Scattered litter, plastic waste, or debris on public roads.
5. **Stagnant Water** (`stagnant_water`): Water accumulation prone to vector and mosquito breeding.
6. **Street Light** (`street_light`): Non-functional, flickering, or damaged public street lamps.
7. **Water Supply** (`water_supply`): Broken municipal pipelines, leakage, or water contamination.

---

## 🔐 Authentication & Role-Based Access

Authentication is handled using Supabase Auth. Supported authentication methods include:
- **Email / Password**
- **Google OAuth**
- **Magic Link**

### User Roles

| Role | Main Access |
|---|---|
| **Citizen** | Report and track civic issues, engage with community issues, provide feedback |
| **Worker** | Manage assigned issues and submit resolution evidence |
| **Authority / Administrator** | Manage issues, assign workers, and access administrative functionality |

Database Row Level Security (RLS) policies and role/jurisdiction checks ensure that citizens, workers, and authorities only read and modify data within their authorized scope.

---

## 🔑 Demo Credentials

These controlled accounts are provided for demonstration and testing:

| Portal | Email | Password |
|---|---|---|
| 👤 Citizen | `citizen@nagarsetu.test` | `NagarTest@123` |
| 🏛️ Authority / Admin | `admin@nagarsetu.test` | `NagarTest@123` |
| 👷 Worker | `worker@nagarsetu.test` | `NagarTest@123` |

> [!NOTE]
> These are pre-seeded demo/test credentials in the test database environment. No production secrets, service-role keys, or private database passwords are exposed.

### Recommended Demo Flow

1. **Login as Citizen** (`citizen@nagarsetu.test`).
2. **Report an issue** with a category, description, photo, and location.
3. **Login as Authority/Admin** (`admin@nagarsetu.test`).
4. **View the newly reported issue** in the Authority Dashboard queue.
5. **Assign the issue** to the field Worker (`worker@nagarsetu.test`).
6. **Login as Worker** (`worker@nagarsetu.test`).
7. **Open the assigned issue** in the Worker Dashboard.
8. **Update status** to in-progress upon arrival.
9. **Upload resolution/proof photo** of the completed fix.
10. **Mark the issue as resolved**.
11. **Login as Citizen again**.
12. **View the updated status** and inspect the resolution evidence.
13. **Submit feedback** rating the resolution.

---

## 📝 Issue Reporting

Citizens can submit an issue with:
- **Category**: One of the 7 supported municipal categories
- **Description**: Detailed explanation of the civic grievance
- **Address / Location**: Detected street address or manual location description
- **Photographs**: Visual proof uploaded directly to cloud storage
- **Geographic Coordinates**: Precise latitude and longitude where available

Images are uploaded to dedicated storage buckets in Supabase Storage rather than stored as raw database strings. Tracking IDs (e.g., `GS123456`) are automatically generated by the database upon insertion.

---

## 🤝 Community Engagement

- **Upvotes**: Citizens can upvote community issues to signal urgency. Upvote counts are database-backed in PostgreSQL and updated via database triggers rather than stored in local browser state.
- **Comments**: Citizens and officials can discuss specific issues to clarify details or provide updates.
- **Real-Time Updates**: Status changes, upvotes, and comment counts update in real time across active clients using Supabase Realtime channels.

---

## 🔔 Notifications

A database-backed notification system records lifecycle events in `public.notifications` and dispatches alerts for:
- Issue submitted
- Issue verified
- Issue assigned / reassigned
- Issue moved to in-progress
- Issue resolved
- Issue rejected
- Issue escalated
- Feedback received
- Issue upvoted
- Issue commented
- System notifications

Realtime delivery ensures citizens, administrators, and workers receive updates instantly in their respective notification centers.

---

## 📸 Photo Storage & Processing

- **Citizen Issue Photographs**: Attached during issue reporting to document the problem.
- **Worker Resolution Proof**: Uploaded by workers upon task completion as verifiable evidence before resolving an issue.
- **Supabase Storage**: Stored in isolated storage buckets (`issue-images`).
- **Client-Side Image Validation & Compression**: Canvas compression optimizes payload sizes and validates MIME types before upload.
- **Storage Authorization**: Storage RLS policies ensure that only authenticated users can upload media, reporters own their photos, and workers can upload resolution proof for assigned tasks.

---

## 🛡️ Security

- **Supabase Auth**: Secure JWT-based authentication and session verification.
- **PostgreSQL Row Level Security (RLS)**: Enforced on all tables (`issues`, `upvotes`, `issue_comments`, `notifications`, `user_profiles`, etc.).
- **Role-Based Authorization**: Distinct portals and capabilities for Citizens, Workers, and Municipal Authorities.
- **Geographic / Jurisdiction Authorization**: Municipal administrators and workers are strictly confined to their assigned municipality and ward jurisdictions.
- **Reporter Ownership Checks**: Citizens can only modify or delete their own unverified submissions.
- **Worker Assignment Checks**: Only the assigned field worker or jurisdictional supervisor can transition task statuses and upload completion proof.
- **Protected Issue Lifecycle Transitions**: Valid state machine enforces compliant progressions (`submitted` → `in_progress` → `resolved`), preventing unauthorized skips.
- **Controlled Storage Access**: Restrictive bucket read/write policies protect uploaded evidence.
- **Input Validation with Zod**: Comprehensive schema validation at runtime protects all service entry points.

---

## 📁 Project Structure

```
NagarSetu-Civic/
├── frontend/
│   ├── pages/               # Application routes (Citizen, Worker, Authority)
│   ├── components/          # Reusable UI components & Radix primitives
│   ├── layouts/             # MainLayout, WorkerLayout, & OfficialLayout
│   ├── hooks/               # Custom React hooks (useIssues, useAuth, etc.)
│   ├── contexts/            # React contexts (SupabaseAuth, Location, etc.)
│   ├── services/            # Frontend service adapters
│   └── lib/                 # Supabase client instance & utility helpers
│
├── backend/
│   ├── services/
│   │   ├── auth/            # Official authentication & authority services
│   │   ├── issues/          # Core issue lifecycle & query service
│   │   ├── workers/         # Worker assignment & task management
│   │   ├── notifications/   # Notification event dispatchers
│   │   ├── storage/         # Image compression, upload validation, & storage handling
│   │   ├── ai/              # Vision categorization & analysis
│   │   └── maps/            # Geolocation & mapping utilities
│   ├── validators/          # Zod validation schemas
│   ├── types/               # TypeScript domain models & database contracts
│   └── utils/               # Coordinate math, errors, & formatting
│
├── database/
│   ├── migrations/          # Versioned SQL migrations
│   ├── seeds/               # Seed data & test fixtures
│   └── README.md            # Database schema documentation
│
├── tests/
│   ├── backend/             # Unit, contract, & regression test suites
│   ├── database/            # RLS & schema integrity checks
│   └── e2e/                 # Role-based end-to-end journey tests
│
├── docs/                    # Architecture guides & specifications
├── .env.example             # Environment variables template
├── package.json             # Scripts & dependencies
└── README.md                # Project documentation
```

---

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+ and npm
- Supabase account & project
- Google Maps API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/AbhijeetKushwaha1213/NagarSetu.git
   cd NagarSetu-Civic
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env.local` file in the project root:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   ```

4. **Configure Supabase**
   Ensure your Supabase project is active and apply database migrations located in `database/migrations/`.

5. **Start the development server**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## 🧪 Testing & Verification

Run automated test suites to verify system functionality:

```bash
# Run backend issue tests
npm run test:issues

# Run geographic authorization tests
npm run test:issues:geo

# Run query contract tests
npm run test:issues:get

# Run visibility & categories regression suite
npm run test:issues:visibility

# Run worker assignment tests
npm run test:workers:assign

# Run role mapping & worker UX end-to-end tests
npm run test:product:roles

# Run TypeScript type check
npm run type-check

# Run linter
npm run lint

# Build for production
npm run build
```

---

## 📄 License

This project is licensed under the MIT License.
