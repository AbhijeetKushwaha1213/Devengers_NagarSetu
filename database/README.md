# 🗄️ NagarSetu Database Architecture

This directory contains the database architecture, schema migrations, stored procedures, triggers, Row Level Security (RLS) policies, and development seed data for NagarSetu-Civic.

## Directory Structure

```
database/
├── migrations/       # SQL versioned schema migrations
├── functions/        # PostgreSQL functions and stored procedures
├── triggers/         # Automated triggers (e.g. auth user profile sync)
├── policies/         # Row Level Security (RLS) policies per table
├── seeds/            # Initial test and development data
└── README.md         # Database documentation (this file)
```

## Tables & Enums

### Core Tables
- **`public.profiles`**: User profiles with roles (`citizen`, `official`, `worker`, `admin`), municipality, and ward references.
- **`public.issues`**: Civic issue reports with tracking ID, title, description, address, coordinates in metadata, category, status, upvotes, reporter ID, and assigned worker.
- **`public.upvotes`**: Citizen community validation and upvotes per issue.
- **`public.panchayats`**: Local administrative bodies / municipalities.
- **`public.departments`**: Municipal operational departments (PWD, Sanitation, Water, Electricity).

### Issue Status Enums
- `submitted`: Newly submitted by citizen.
- `verified`: Verified by municipal official.
- `in_progress`: Worker assigned and actively resolving.
- `resolved`: Completed with photo proof.
- `escalated`: Flagged for higher municipal escalation.
- `rejected`: Invalid or duplicate report.

## Row Level Security (RLS)
Every table has Row Level Security enabled:
- **`public.issues`**: Publicly readable. Authenticated citizens can insert their own reports. Only reporters, assigned workers, or authorized officials can update.
- **`public.profiles`**: Authenticated users can view profiles. Users can only update their own profile.
- **`public.upvotes`**: Publicly viewable count. Authenticated citizens can add/remove their own upvote.

## Running Migrations
Migrations are applied via Supabase CLI or the Supabase SQL editor:
```bash
supabase migration list
supabase db push
```
All versioned migrations are maintained in `database/migrations/` and mirrored in `supabase/migrations/` for CLI compatibility.
