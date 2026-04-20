# Judge AI - Windows Setup Build Guide

This document explains how to create a Windows EXE setup file for the Judge AI application.

## Prerequisites

Before building the installer, ensure you have the following installed:

1. **Node.js 22.x** (LTS version)
   - Download from: https://nodejs.org/
   - Verify: `node --version`

2. **pnpm** (Package manager)
   - Install: `npm install -g pnpm`
   - Verify: `pnpm --version`

3. **Windows 10/11** (64-bit)
   - The build process is optimized for Windows

4. **Git** (optional, for version control)
   - Download from: https://git-scm.com/

## Quick Start (Automated Build)

The easiest way to build the installer is to run the provided batch script:

```batch
build-windows-setup.bat
```

This script will:
1. Install all dependencies
2. Build the frontend (React/Vite)
3. Build the server (ESBuild)
4. Bundle the server executable (pkg)
5. Copy all assets
6. Create a portable distribution

**Output:** `release/Judge-AI-1.0.1-win-x64/`

## Manual Build Steps

If you prefer to run each step manually:

### Step 1: Install Dependencies

```batch
pnpm install
```

### Step 2: Build Frontend

```batch
pnpm run build
```

This compiles the React frontend using Vite and outputs to `dist/public/`.

### Step 3: Build Server (CJS)

```batch
pnpm run build:cjs
```

This bundles the server code into a CommonJS module at `dist/index.cjs`.

### Step 4: Create Standalone Executable

```batch
pkg dist/index.cjs --out-path dist/exe --targets node22-win-x64
```

This creates a standalone `index.exe` that doesn't require Node.js installed.

### Step 5: Copy Assets

```batch
xcopy /E /I /Y dist\public dist\exe\public
copy /Y electron\main.cjs dist\exe\electron.cjs
```

### Step 6: Create Full Installer (Optional)

To create a professional NSIS installer with setup wizard:

```batch
pnpm run build:installer
```

**Note:** This requires `electron-builder` to be installed.

**Output:** `release/Judge AI-1.0.1-Setup.exe`

## Build Script Options

### Option 1: Batch Script (Recommended for Windows)

```batch
build-windows-setup.bat
```

Creates a portable distribution that can be copied and run directly.

### Option 2: Node.js Script (Cross-platform)

```batch
node scripts/build-setup.mjs
```

Creates both portable and installer versions.

### Option 3: Individual npm Scripts

```batch
pnpm run build:exe        # Basic executable only
pnpm run dist:win         # Windows distribution
pnpm run build:installer  # Full NSIS installer
```

## Output Files

After a successful build, you'll find:

| File/Folder | Description |
|-------------|-------------|
| `dist/exe/index.exe` | Standalone server executable |
| `dist/exe/electron.cjs` | Electron desktop wrapper |
| `dist/exe/public/` | Frontend assets |
| `dist/exe/.env` | Configuration file |
| `release/Judge-AI-1.0.1-win-x64/` | Portable distribution |
| `release/Judge AI-1.0.1-Setup.exe` | NSIS installer (if built) |

## Installation Requirements

End users will need:

1. **Windows 10 or later** (64-bit)
2. **MariaDB 10.11+** or **MySQL 8.0+**
   - Download MariaDB: https://mariadb.org/download/
3. **4GB RAM minimum** (8GB recommended)
4. **2GB free disk space**

## Post-Installation Setup

### 1. Initialize Database

After installing MariaDB/MySQL, run the included SQL script:

```sql
CREATE DATABASE IF NOT EXISTS judge_ai;
USE judge_ai;
GRANT ALL PRIVILEGES ON judge_ai.* TO 'root'@'localhost' IDENTIFIED BY 'root';
FLUSH PRIVILEGES;
```

Or run the included `init-db.sql` file.

### 2. Configure Environment

Edit the `.env` file in the installation directory:

```env
DATABASE_URL=mysql://root:root@localhost:3306/judge_ai
JWT_SECRET=desktop-local-secret-min-32-chars-long!!
OWNER_OPEN_ID=desktop-local-user
NODE_ENV=production
PORT=3000
```

### 3. Run Database Migrations

```batch
cd "C:\Program Files\Judge AI"
pnpm run db:push
```

### 4. Start the Application

Double-click `Judge AI.exe` or use the Start Menu shortcut.

The application will open at: http://localhost:3000

## Troubleshooting

### Build Fails with "Cannot find module"

**Solution:** Reinstall dependencies:

```batch
rmdir /s /q node_modules
del pnpm-lock.yaml
pnpm install
```

### pkg Bundling Fails

**Solution:** Ensure all assets are properly referenced:

```batch
pnpm exec pkg dist/index.cjs --out-path dist/exe --targets node22-win-x64 --debug
```

### Installer Build Fails

**Solution:** Install electron-builder globally:

```batch
npm install -g electron-builder
pnpm run build:installer
```

### Application Won't Start

**Check:**
1. MariaDB/MySQL is running: `sc query MariaDB`
2. Port 3000 is not in use: `netstat -ano | findstr :3000`
3. `.env` file exists and is properly configured
4. Database `judge_ai` exists

### Database Connection Errors

**Solution:**
1. Verify database credentials in `.env`
2. Ensure MariaDB is running on port 3306
3. Check firewall settings
4. Try: `mysql -u root -p` to test connection

## Customization

### Change Application Name

Edit `package.json`:

```json
{
  "name": "your-app-name",
  "build": {
    "productName": "Your App Name"
  }
}
```

### Change Default Port

Edit `.env`:

```env
PORT=8080
```

### Add Custom Icons

Replace `build/icon.ico` with your own 256x256 ICO file.

### Modify Installer Behavior

Edit `build/installer.nsh` to customize:
- Installation directory
- Start menu shortcuts
- File associations
- Registry entries

## Code Signing (Recommended for Production)

To sign the installer with a code signing certificate:

1. Obtain a code signing certificate from a trusted CA
2. Add to `electron-builder.config.json`:

```json
{
  "win": {
    "signingHashAlgorithms": ["sha256"],
    "sign": "path/to/sign-script.js"
  }
}
```

## Distribution

### Portable Distribution

Copy the entire `release/Judge-AI-1.0.1-win-x64/` folder to:
- USB drive
- Network share
- Cloud storage

Users can extract and run without installation.

### Installer Distribution

Distribute `release/Judge AI-1.0.1-Setup.exe` via:
- Download link
- Email
- Physical media

### System Requirements for Distribution

Minimum:
- Windows 10 64-bit
- 4GB RAM
- 2GB disk space
- MariaDB/MySQL

Recommended:
- Windows 11 64-bit
- 8GB RAM
- 5GB disk space
- SSD storage

## Security Considerations

1. **Change default JWT_SECRET** in production
2. **Use strong database passwords**
3. **Enable HTTPS** for network deployments
4. **Regular backups** of uploads folder and database
5. **Keep dependencies updated**: `pnpm update`

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review logs in the `logs/` folder
3. Check database logs
4. Verify system requirements

## License

MIT License - See LICENSE file for details.

---

**Build Date:** 2024
**Version:** 1.0.1
**Platform:** Windows x64
