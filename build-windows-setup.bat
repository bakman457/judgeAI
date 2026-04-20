@echo off
REM Judge AI Windows EXE Setup Builder
REM Run this script to create a Windows installer

echo ========================================
echo   Judge AI Windows Setup Builder
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js 22 from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo.

REM Check if pnpm is installed
where pnpm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Installing pnpm...
    npm install -g pnpm
)

echo pnpm version:
pnpm --version
echo.

REM Clean previous builds
echo [1/8] Cleaning previous builds...
if exist "dist\exe" rmdir /s /q "dist\exe"
if exist "release" rmdir /s /q "release"
mkdir "dist\exe"
mkdir "release"
echo Done.
echo.

REM Install dependencies
echo [2/8] Installing dependencies...
call pnpm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo Done.
echo.

REM Build frontend
echo [3/8] Building frontend (Vite)...
call pnpm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Frontend build failed
    pause
    exit /b 1
)
echo Done.
echo.

REM Build CJS server
echo [4/8] Building server (ESBuild CJS)...
call pnpm run build:cjs
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Server build failed
    pause
    exit /b 1
)
echo Done.
echo.

REM Bundle with pkg
echo [5/8] Creating standalone executable (pkg)...
call pnpm exec pkg dist/index.cjs --out-path dist/exe --targets node22-win-x64
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: pkg bundling failed
    pause
    exit /b 1
)
echo Done.
echo.

REM Copy assets
echo [6/8] Copying public assets...
xcopy /E /I /Y dist\public dist\exe\public
echo Done.
echo.

REM Copy Electron wrapper
echo [7/8] Preparing Electron wrapper...
copy /Y electron\main.cjs dist\exe\electron.cjs
copy /Y package.json dist\exe\package.json
if not exist "dist\exe\.env" (
    echo DATABASE_URL=mysql://root:root@localhost:3306/judge_ai > dist\exe\.env
    echo JWT_SECRET=desktop-local-secret-min-32-chars-long!! >> dist\exe\.env
    echo OWNER_OPEN_ID=desktop-local-user >> dist\exe\.env
    echo NODE_ENV=production >> dist\exe\.env
    echo PORT=3000 >> dist\exe\.env
    echo Created default .env file
)
echo Done.
echo.

REM Create portable distribution
echo [8/8] Creating portable distribution...
set "ZIP_NAME=Judge-AI-1.0.1-win-x64"
mkdir "release\%ZIP_NAME%"
xcopy /E /I /Y dist\exe "release\%ZIP_NAME%\Judge AI"

REM Create README
(
    echo JUDGE AI - Windows Installation
    echo =================================
    echo.
    echo System Requirements:
    echo - Windows 10/11 ^(^64-bit^)
    echo - 4GB RAM minimum ^(^8GB recommended^)
    echo - MariaDB 10.11 or later
    echo.
    echo Installation Steps:
    echo 1. Extract the "Judge AI" folder to your desired location
    echo 2. Ensure MariaDB is installed and running
    echo 3. Run "Judge AI.exe" to start the application
    echo 4. The application will open in a desktop window at http://localhost:3000
    echo.
    echo Default Configuration:
    echo - Database: mysql://root:root@localhost:3306/judge_ai
    echo - Port: 3000
    echo - Admin User: desktop-local-user
    echo.
    echo To change settings, edit the .env file in the installation directory.
    echo.
    echo Troubleshooting:
    echo - If the app doesn't start, check that MariaDB is running
    echo - Ensure port 3000 is not in use by another application
    echo - Check the console output for error messages
    echo.
    echo License: MIT
) > "release\%ZIP_NAME%\README.txt"

echo Done.
echo.

echo ========================================
echo   Build Complete!
echo ========================================
echo.
echo Output files:
dir /b release
echo.
echo The portable distribution is ready in the release folder.
echo.
echo Next Steps:
echo 1. Test on a clean Windows machine
echo 2. Verify MariaDB connection
echo 3. Test all major features
echo.
pause
