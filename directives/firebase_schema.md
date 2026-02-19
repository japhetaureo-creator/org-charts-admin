# Firebase Database Schema

This document outlines the Firebase Firestore database schema requirements for the Organization Charts Admin Dashboard.

## Collections

### `organizations`
Stores organization-level information.

**Document Structure:**
```javascript
{
  id: "org_123",
  name: "Acme Corp",
  logo: "https://...",
  headcount: 1240,
  totalGroups: 12,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

---

### `departments`
Stores department information for each organization.

**Document Structure:**
```javascript
{
  id: "dept_123",
  organizationId: "org_123",
  name: "Engineering",
  percentage: 45,
  color: "primary",
  headcount: 558,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

---

### `users`
Stores user/employee information.

**Document Structure:**
```javascript
{
  id: "user_123",
  organizationId: "org_123",
  departmentId: "dept_123",
  name: "Sarah Jenkins",
  email: "sarah@acme.com",
  avatar: "https://...",
  role: "Engineering Manager",
  status: "active",
  createdAt: timestamp,
  updatedAt: timestamp
}
```

---

### `activityFeed`
Stores organizational change events.

**Document Structure:**
```javascript
{
  id: "activity_123",
  organizationId: "org_123",
  type: "user_action" | "system",
  userId: "user_123", // optional, for user actions
  action: "updated hierarchy for",
  target: "Engineering",
  message: "Full message text", // for system events
  icon: "account_tree",
  timestamp: timestamp
}
```

---

### `dataSources`
Stores integration/data source configurations.

**Document Structure:**
```javascript
{
  id: "source_123",
  organizationId: "org_123",
  name: "Slack",
  description: "Messaging & Notifications",
  initials: "SL",
  color: "#4A154B",
  status: "live" | "paused" | "error",
  lastSyncAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

---

### `systemHealth`
Stores system health and sync status.

**Document Structure:**
```javascript
{
  id: "health_123",
  organizationId: "org_123",
  syncStatus: "Active" | "Syncing" | "Error",
  syncProgress: 100, // 0-100
  lastSyncAt: timestamp,
  updatedAt: timestamp
}
```

## Indexes Required

1. **activityFeed**: `organizationId` + `timestamp` (descending)
2. **departments**: `organizationId`
3. **users**: `organizationId` + `departmentId`
4. **dataSources**: `organizationId` + `status`

## Security Rules (Placeholder)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Organizations
    match /organizations/{orgId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null; // Add proper admin checks
    }
    
    // Departments
    match /departments/{deptId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null; // Add proper admin checks
    }
    
    // Users
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null; // Add proper admin checks
    }
    
    // Activity Feed
    match /activityFeed/{activityId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if false; // Activity feed is append-only
    }
    
    // Data Sources
    match /dataSources/{sourceId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null; // Add proper admin checks
    }
    
    // System Health
    match /systemHealth/{healthId} {
      allow read: if request.auth != null;
      allow write: if false; // Only backend can update
    }
  }
}
```

## Next Steps

1. Create Firebase project in Firebase Console
2. Enable Firestore Database
3. Set up authentication (Email/Password, Google, etc.)
4. Create the collections and add sample data
5. Configure security rules
6. Update `webapp/firebase-config.js` with project credentials
