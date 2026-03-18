# Admin Service

Universal admin platform with React frontend and Spring Boot backend, featuring AWS Cognito authentication with Token Handler Pattern, RBAC/ACL authorization, and communication management.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + TypeScript + ShadCN UI + Tailwind v4 + Zustand + TanStack Query |
| Backend | Spring Boot 3.3.x + Java 21 + PostgreSQL + Redis |
| Package Manager | pnpm (frontend) |
| Auth | AWS Cognito with Token Handler Pattern (BFF) |

## Project Structure

```
admin-final/
├── backend/               # Spring Boot application
├── frontend/              # React application
│   └── src/
│       ├── core/          # Framework (auth, layout, admin, profile)
│       ├── shared/        # Shared components and utilities
│       ├── modules/       # Business domain modules
│       │   └── communication/  # Email templates, flows, transactions
│       └── pages/         # Page components
│           └── communication/  # Communication pages
├── docs/                  # Documentation
│   ├── PRD.md            # Product requirements
│   ├── TRD.md            # Technical specifications
│   ├── IMP.md            # Implementation plan
│   └── services/
│       └── communication/  # Communication service docs
└── docker-compose.yml     # Development environment
```

## Features

### Core Framework
- User management with RBAC
- Role and permission management
- Audit logging
- User profile management

### Communication Module
- Email template builder (GrapesJS + MJML)
- Visual flow designer (@xyflow/react)
- Transaction tracking
- Communication reports

## Quick Start

```bash
# Start all services
docker-compose up

# Backend compile
docker-compose exec backend ./gradlew compileJava

# Backend tests
docker-compose exec backend ./gradlew test

# Frontend add package
docker-compose exec frontend pnpm add <package>

# Frontend build
docker-compose exec frontend pnpm run build

# Add ShadCN component
docker-compose exec frontend pnpm dlx shadcn@latest add <component>
```

## Service URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8080/us/common/admin |
| Swagger UI | http://localhost:8080/us/common/admin/swagger-ui/index.html |
| Health Check | http://localhost:8080/us/common/admin/actuator/health |

## Environment Setup

1. Copy environment files:
   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

2. Configure variables (see sections below)

3. Start services:
   ```bash
   docker-compose up
   ```

## Database Migration

Flyway auto-migration is disabled. Use the API endpoint:

```bash
curl -X POST http://localhost:8080/us/common/admin/flyway/migrate
```

---

## AWS Cognito Setup

The application uses AWS Cognito for authentication (OAuth2) and user management (Admin APIs).

### Environment Variables

#### Cognito OAuth2 (Authentication)

| Variable | Description |
|----------|-------------|
| `COGNITO_ISSUER_URI` | Cognito issuer URL |
| `COGNITO_USER_POOL_ID` | User Pool ID |
| `COGNITO_CLIENT_ID` | App Client ID |
| `COGNITO_CLIENT_SECRET` | App Client Secret (if configured) |
| `COGNITO_DOMAIN` | Cognito Hosted UI domain |
| `COGNITO_REDIRECT_URI` | OAuth2 callback URL |
| `COGNITO_POST_LOGOUT_REDIRECT_URI` | Post-logout redirect URL |

#### AWS Credentials (User Management)

Required for creating/managing users from the admin panel:

| Variable | Description |
|----------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key |
| `AWS_REGION` | AWS region (e.g., `us-east-1`) |

### Step 1: Create IAM User for User Management

The backend needs IAM credentials to call Cognito Admin APIs (`AdminCreateUser`, `AdminDeleteUser`, etc.).

1. **Go to AWS IAM Console**
   - Navigate to: https://console.aws.amazon.com/iam/

2. **Create a new IAM User**
   - Click **Users** → **Create user**
   - User name: `admin-service-cognito` (or your preferred name)
   - Click **Next**

3. **Set Permissions**
   - Select **Attach policies directly**
   - Click **Create policy** (opens new tab)
   - Switch to **JSON** tab and paste:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "cognito-idp:AdminCreateUser",
           "cognito-idp:AdminDeleteUser",
           "cognito-idp:AdminEnableUser",
           "cognito-idp:AdminDisableUser",
           "cognito-idp:AdminGetUser",
           "cognito-idp:AdminUpdateUserAttributes"
         ],
         "Resource": "arn:aws:cognito-idp:*:*:userpool/*"
       }
     ]
   }
   ```

   > **Production Note**: Replace `*` with your specific region, account ID, and user pool ID:
   > ```
   > "Resource": "arn:aws:cognito-idp:us-east-1:123456789012:userpool/us-east-1_xxxxxxxx"
   > ```

   - Click **Next** → Name it `CognitoAdminUserManagement` → **Create policy**

4. **Attach the Policy**
   - Go back to the user creation tab
   - Click refresh icon next to the policy list
   - Search for `CognitoAdminUserManagement` and select it
   - Click **Next** → **Create user**

5. **Create Access Keys**
   - Click on the newly created user
   - Go to **Security credentials** tab
   - Scroll to **Access keys** → **Create access key**
   - Select **Application running outside AWS**
   - Click **Next** → **Create access key**
   - **IMPORTANT**: Copy both values immediately (you won't see the secret again):
     - `Access key ID` → `AWS_ACCESS_KEY_ID`
     - `Secret access key` → `AWS_SECRET_ACCESS_KEY`

### Step 2: Get Cognito Configuration

1. **Go to AWS Cognito Console**
   - Navigate to: https://console.aws.amazon.com/cognito/

2. **Select your User Pool**

3. **Get User Pool ID**
   - On the **User pool overview** page
   - Copy **User pool ID** (e.g., `us-east-1_xxxxxxxx`)
   - This is your `COGNITO_USER_POOL_ID`

4. **Get Issuer URI**
   - Format: `https://cognito-idp.{region}.amazonaws.com/{user-pool-id}`
   - Example: `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_xxxxxxxx`
   - This is your `COGNITO_ISSUER_URI`

5. **Get App Client Settings**
   - Go to **App integration** tab
   - Scroll to **App clients and analytics**
   - Click on your app client
   - Copy **Client ID** → `COGNITO_CLIENT_ID`
   - Copy **Client secret** (if enabled) → `COGNITO_CLIENT_SECRET`

6. **Get Cognito Domain**
   - Go to **App integration** tab
   - Scroll to **Domain**
   - Copy the domain URL → `COGNITO_DOMAIN`
   - Example: `https://your-domain.auth.us-east-1.amazoncognito.com`

### Step 3: Configure Backend

Add the following to `backend/.env`:

```bash
# AWS Credentials (for user management)
AWS_ACCESS_KEY_ID=AKIA...your-access-key...
AWS_SECRET_ACCESS_KEY=...your-secret-key...
AWS_REGION=us-east-1

# Cognito OAuth2 (for authentication)
COGNITO_ISSUER_URI=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_xxxxxxxx
COGNITO_USER_POOL_ID=us-east-1_xxxxxxxx
COGNITO_CLIENT_ID=your-client-id
COGNITO_CLIENT_SECRET=your-client-secret
COGNITO_DOMAIN=https://your-domain.auth.us-east-1.amazoncognito.com
COGNITO_REDIRECT_URI=http://localhost:3000/api/v1/auth/callback
COGNITO_POST_LOGOUT_REDIRECT_URI=http://localhost:3000/
```

### Step 4: Restart Backend

```bash
docker-compose restart backend
```

### Verify Setup

Check the logs:

```bash
docker-compose logs backend --tail=50
```

You should see:
```
CognitoUserManagementProvider initialized for user pool: us-east-1_xxxxxxxx
```

---

## Troubleshooting

### "Failed to create user in identity provider"

**Cause**: Missing or invalid AWS credentials.

**Solution**:
1. Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are set in `backend/.env`
2. Verify the IAM user has the `CognitoAdminUserManagement` policy attached
3. Restart backend: `docker-compose restart backend`

### "User not authorized to perform: cognito-idp:AdminCreateUser"

**Cause**: IAM policy doesn't include required permissions.

**Solution**: Update the IAM policy to include all required actions (see Step 1).

### "The security token included in the request is invalid"

**Cause**: AWS credentials are incorrect or expired.

**Solution**:
1. Generate new access keys in IAM console
2. Update `backend/.env` with new values
3. Restart backend

---

## Documentation

- [PRD.md](docs/PRD.md) - Product requirements
- [TRD.md](docs/TRD.md) - Technical architecture
- [IMP.md](docs/IMP.md) - Implementation progress
- [Communication Service](docs/services/communication/) - Communication module docs
