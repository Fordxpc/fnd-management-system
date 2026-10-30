# FND Migration Plan

## Phase 1 - Infrastructure ✅
- Neon PostgreSQL
- Drizzle ORM
- Database connection
- Core schema

## Phase 2 - Permission System ✅
Roles:
- developer
- manager
- admin
- smt
- staff

Additional Access:
- isIncharge
- tempDeptAccess
- tempDeptTarget
- rampsheetEditAccess
- rwyLightEditAccess
- birdCountEditAccess
- opsBoardAccess

## Phase 3 - Data Migration

Order:

1. users
2. user_presets
3. staff
4. settings
5. temp_access
6. leave_requests
7. flights
8. holidays
9. bird_counts
10. ramp_inspections
11. roster_entries

## Phase 4 - Better Auth
- Install Better Auth
- Configure Neon adapter
- Create auth tables
- Sync existing users

## Phase 5 - Security
- Backend authorization
- Session validation
- Role validation
- Permission validation

## Phase 6 - Cutover
- Switch app to Neon
- Remove Firebase Auth
- Remove D1 dependency