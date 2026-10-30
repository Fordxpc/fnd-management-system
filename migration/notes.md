# Notes

Current Production

- Firebase Auth
- Cloudflare D1

Target

- Better Auth
- Neon PostgreSQL

Important Findings

- Permissions stored mainly in staff table
- users table stores role and department
- temp_access provides temporary department permissions
- user_presets stores pending users
- Backend authorization requires review before production migration