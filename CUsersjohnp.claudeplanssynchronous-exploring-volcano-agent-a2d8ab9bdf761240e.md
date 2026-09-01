# Implementation Plan: Author Submission and Dashboard

This plan outlines the addition of an author submission flow, an author dashboard, and view tracking for approved works.

## 1. Backend Logic (`src/server.ts`)

### Interface Updates
- **`User` Interface**: Define a `User` interface with `id`, `username`, `email`, `password`, and `role` ('author' | 'admin' | 'user').
- **`PendingText` Interface**: Add `authorId: number` and `threeDObject?: string`.
- **`Recommendation` Interface**: Add `authorId: number`, `threeDObject?: string`, and `views: number`.

### Database Updates
- Update the `Database` interface to include `users: User[]`.
- Initialize `db.users` as an empty array in the `db` object.

### Endpoint Implementations
- **`POST /api/register`**: 
    - Receive `username`, `email`, `password`.
    - Create a new user with `role: 'author'`.
    - Push to `db.users`.
    - Return the created user and a mock token.
- **`POST /api/login`**:
    - Validate `username` and `password` against `db.users`.
    - Return user object (including `role`) and a mock token.
- **`POST /api/upload-text`**:
    - Update to accept `authorId` and `threeDObject`.
    - Save these in the `PendingText` object.
- **`POST /api/approve-text`**:
    - When moving `PendingText` to `Recommendation`, preserve `authorId` and `threeDObject`.
    - Initialize `views: 0`.
- **`GET /api/author/work`**:
    - Authenticate request (via token/header).
    - Find all `pendingTexts` where `authorId === currentUserId`.
    - Find all `recommendations` where `authorId === currentUserId`.
    - Return a combined list of works with their status ('pending' or 'approved') and `views`.
- **`POST /api/recommendations/:id/view`**:
    - Find the recommendation by `id`.
    - Increment the `views` count.
    - Return the updated recommendation.

## 2. Author Authentication & User Model (`src/app/services/auth.service.ts`)

### User Model
- Update the `User` interface in `auth.service.ts` to include the `role` field.

### Service Enhancements
- **`uploadText(data: any)`**: New method to call `/api/upload-text`.
- **`getAuthorWorks()`**: New method to call `/api/author/work`.
- **`incrementView(id: number)`**: New method to call `/api/recommendations/:id/view`.

## 3. Submission Page (`SubmitWorkComponent`)

### Component Design
- Create `SubmitWorkComponent` as a standalone component.
- **Form Fields**:
    - `Author`: Read-only field populated from the current user's profile.
    - `Text Content`: `textarea` for the work.
    - `3D Object`: `input` field for a link to a 3D model (or file upload simulation).
- **Logic**:
    - On submit, validate fields.
    - Call `authService.uploadText()`.
    - Show a success message and navigate back to the dashboard.

## 4. Author Dashboard (`DashboardComponent`)

### Logic Updates
- In `ngOnInit`, check if `this.user.role === 'author'`.
- If author:
    - Call `authService.getAuthorWorks()`.
    - Store the results in a new `authorWorks` array.

### UI Updates (`dashboard.html`)
- Add a conditional section for authors:
    - **"Submit New Work" Button**: Link to `/submit-work`.
    - **My Submissions Table**:
        - Columns: Title/Text, Status (Pending/Approved), Views (if Approved).
- Ensure the dashboard remains functional for non-author users.

## 5. View Tracking implementation

### Trigger Mechanism
- Identify the component displaying recommendations (e.g., `HomeComponent` or `DashboardComponent`).
- Add a click event handler to the recommendation card/link.
- Call `authService.incrementView(recId)` when a user clicks to read the work.

## 6. Routing (`src/app/app.routes.ts`)

- Add the new route: `{ path: 'submit-work', component: SubmitWorkComponent, canActivate: [authGuard] }`.

---

## Implementation Sequence

1. **Backend**: Update interfaces $\rightarrow$ Update `db` $\rightarrow$ Implement endpoints.
2. **Auth Service**: Update `User` model $\rightarrow$ Add new API methods.
3. **Submission Page**: Create component $\rightarrow$ Implement form $\rightarrow$ Link to API.
4. **Dashboard**: Update logic $\rightarrow$ Update HTML $\rightarrow$ Add "Submit" link.
5. **View Tracking**: Add click handler $\rightarrow$ Link to API.
6. **Routing**: Add `/submit-work` route.
