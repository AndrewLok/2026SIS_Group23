Startup

## First time only

1. Install Node.js and JDK 25.
2. Ensure backend/.env is present
3. In frontend, run `npm install`.

## Backend

```powershell
cd backend
$env:JAVA_HOME = "$env:USERPROFILE\.jdks\jdk-25.0.4.1+1"   # skip if Java 25 is already on your PATH
.\gradlew.bat bootRun
```

Ready when it prints `Started BackendApplication`. Runs on http://127.0.0.1:8080.

## Frontend

In a second terminal:

```powershell
cd frontend
npm run dev:backend
```

Open http://127.0.0.1:5173 - Creating account and signing in should work as intended.

Press Ctrl+C in each terminal to terminate.
