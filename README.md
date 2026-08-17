# Aura Connect

Build a premium, modern, secure personal social-media platform with a unique personal brand name and a professional UI inspired by the best parts of YouTube, Instagram, TikTok, and Facebook — but with its own original design.

1. Authentication & Accounts

- Sign up / Login with Google.
- Sign up / Login with Apple.
- Secure authentication and session management.
- Every user must have their own private account.
- Users can change their profile information and password/security settings.
- No user can access another user's private account or private data.

2. Super Admin System

Create a powerful Super Admin dashboard.

ONLY the account:
qaistiger2.0@gmail.com

must receive Super Admin privileges after successful authentication.

The Super Admin should have A-to-Z management controls, including:

- Total users
- Active/inactive users
- User search
- View/manage user profiles
- Suspend or remove accounts when necessary
- Manage reported content
- Review uploaded photos/videos for policy violations
- Remove inappropriate or prohibited content
- Manage reports
- View platform activity/statistics
- Manage usernames
- Manage public content
- Manage platform settings
- Security and moderation controls
- Error/issue monitoring
- Complete admin dashboard with professional analytics

Do NOT hard-code or expose admin credentials in frontend code. Use secure server-side role-based access control.

3. Privacy System

Privacy is extremely important.

Every uploaded photo and video must have:

1. PUBLIC

- Anyone can see it according to the user's profile/content settings.

2. ONLY ME

- Only the owner can normally see it.
- Super Admin may access private content ONLY for legitimate moderation, safety, legal, or security purposes through a protected admin moderation system.

Private content must never appear in:

- Public search
- Other users' feeds
- Public profiles
- Recommendations
- Explore pages

Users must never be able to access another user's private content.

4. Photo & Video Upload

Users can:

- Upload photos
- Upload videos
- Add captions
- Delete their own uploads
- Choose Public or Only Me before publishing
- Manage their uploaded content from their profile

Add secure file validation, size limits, supported-format validation, malware/security scanning where available, and protection against unauthorized file access.

5. Profiles

Every user gets a professional profile containing:

- Profile picture
- Cover/profile section where appropriate
- Unique username
- Display name
- Bio
- Public posts
- Followers
- Following
- Profile statistics

Users can edit their own profile.

6. Unique Username System

Every username must be globally unique.

Once a username is registered:

- No other user can use the same username.
- Username availability must be checked in real time.
- Prevent duplicate usernames through a database-level unique constraint.
- Handle capitalization consistently.
- Provide a professional username availability message.

7. Follow System

Implement:

- Follow
- Unfollow
- Followers list
- Following list
- Follow notifications

Public profile information and public content can be visible to other users according to privacy settings.

Private/Only Me content must remain private.

8. Search

Create a fast global search system for:

- Users
- Unique usernames
- Public posts
- Public videos

Never expose private/Only Me content in public search.

9. Home Feed

Create a modern social-media feed containing:

- Public photos
- Public videos
- User information
- Like
- Comment
- Share where appropriate
- Follow button
- Timestamp
- Report content option

The feed should feel modern and smooth without copying any existing platform's exact UI.

10. Content Safety & Moderation

Because users can upload photos and videos, implement a strong moderation/reporting system.

Users should have:

- Report User
- Report Photo
- Report Video
- Report Comment

The system should detect/flag potentially inappropriate or prohibited content where technically possible and send it to the Admin moderation dashboard.

Admin can review reported content and take appropriate action.

Do not automatically expose private content to normal users.

11. Secure Data Architecture

Security must be built into the architecture from the beginning.

Use:

- Secure authentication
- Role-Based Access Control (RBAC)
- Database security rules/policies
- Server-side authorization
- Secure file storage
- Private storage paths for Only Me content
- Encryption in transit
- Proper access-control checks
- Rate limiting
- Input validation
- XSS/CSRF protection where applicable
- Secure API endpoints
- Audit logs for important admin actions
- Backups and data recovery strategy

A user can access only their own private data.

Admin access must be separately authorized and logged.

12. Admin Dashboard Design

Create a professional Super Admin dashboard with:

- Overview
- Users
- Profiles
- Posts
- Videos
- Reports
- Moderation
- Suspended users
- Deleted content
- Analytics
- Security
- System status
- Error logs
- Settings

Show useful statistics such as:

- Total users
- New users
- Active users
- Total posts
- Total videos
- Reports
- Pending moderation
- Suspended accounts

13. UI/UX

Design must be:

- Premium
- Modern
- Fast
- Responsive
- Mobile-first
- Desktop compatible
- Tablet compatible

Color theme:

- Blue
- Black
- Purple
- Yellow

Use these colors professionally with a clean dark/light interface rather than making the UI overly colorful.

Create a polished navigation system, modern cards, smooth animations, clean typography, professional icons, responsive layouts, loading states, empty states, error states, and confirmation dialogs.

14. Platform Experience

The overall experience should combine:

- YouTube-style video experience
- Instagram-style profiles/media
- TikTok-style short-video experience
- Facebook-style social features

However, create an ORIGINAL brand identity and ORIGINAL UI. Do not copy copyrighted designs, logos, or exact layouts.

15. Data Persistence

User data must remain saved securely.

If a user logs out and logs back in:

- Their profile remains intact.
- Their followers/following remain intact.
- Their posts remain intact.
- Their photos/videos remain intact.
- Their privacy settings remain intact.

Admin actions must not accidentally delete unrelated user data.

Use proper database relationships, backups, validation, and transactional operations to prevent accidental data loss.

16. Error Handling

Create professional error handling for:

- Failed login
- Failed upload
- Invalid file
- Network failure
- Database failure
- Unauthorized access
- Missing content
- Server errors

Never expose sensitive technical information to normal users.

17. Final Requirement

Build this as a production-quality social platform with a scalable architecture.

Prioritize:
SECURITY → PRIVACY → MODERATION → DATA SAFETY → PERFORMANCE → UI/UX.

The final website should look premium, professional, trustworthy, modern, and unique — not like a basic template.

Before implementation, design the complete architecture, database schema, authentication flow, authorization rules, storage rules, admin permissions, moderation workflow, and responsive UI structure. Then implement each module carefully and test all privacy and security boundaries.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9f40b0dd-e001-434b-9367-04e5aab35439).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
