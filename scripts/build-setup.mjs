#!/usr/bin/env node

/**
 * Judge AI Windows EXE Setup Builder
 * 
 * This script creates a complete Windows installer with:
 * - Bundled server executable (pkg)
 * - Electron desktop wrapper
 * - All static assets
 * - Database migration scripts
 * - Default configuration
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const EXE_DIR = path.join(DIST_DIR, 'exe');
const RELEASE_DIR = path.join(ROOT_DIR, 'release');
const BUILD_DIR = path.join(ROOT_DIR, 'build');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function runCommand(command, options = {}) {
  try {
    const output = execSync(command, {
      stdio: 'pipe',
      encoding: 'utf-8',
      ...options
    });
    if (output.trim()) {
      log(output.trim(), colors.blue);
    }
    return output;
  } catch (error) {
    if (error.stdout) log(error.stdout.toString(), colors.yellow);
    if (error.stderr) log(error.stderr.toString(), colors.red);
    throw error;
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`Created directory: ${dir}`, colors.blue);
  }
}

function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
  log(`Copied: ${path.relative(ROOT_DIR, src)} -> ${path.relative(ROOT_DIR, dest)}`, colors.blue);
}

function copyDir(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

async function main() {
  log('\n========================================', colors.bright);
  log('  Judge AI Windows Setup Builder', colors.bright);
  log('========================================\n', colors.bright);

  // Step 1: Clean previous builds
  log('[1/8] Cleaning previous builds...', colors.yellow);
  if (fs.existsSync(EXE_DIR)) {
    fs.rmSync(EXE_DIR, { recursive: true, force: true });
    log('Cleaned EXE directory', colors.blue);
  }
  if (fs.existsSync(RELEASE_DIR)) {
    fs.rmSync(RELEASE_DIR, { recursive: true, force: true });
    log('Cleaned release directory', colors.blue);
  }
  ensureDir(EXE_DIR);
  ensureDir(RELEASE_DIR);

  // Step 2: Build frontend
  log('\n[2/8] Building frontend (Vite)...', colors.yellow);
  runCommand('pnpm run build', { cwd: ROOT_DIR });

  // Step 3: Build CJS server
  log('\n[3/8] Building server (ESBuild CJS)...', colors.yellow);
  runCommand('pnpm run build:cjs', { cwd: ROOT_DIR });

  // Step 4: Bundle server executable with pkg
  log('\n[4/8] Creating standalone executable (pkg)...', colors.yellow);
  runCommand('pkg dist/index.cjs --out-path dist/exe --targets node22-win-x64', { cwd: ROOT_DIR });

  // Step 5: Copy public assets
  log('\n[5/8] Copying public assets...', colors.yellow);
  copyDir(path.join(DIST_DIR, 'public'), path.join(EXE_DIR, 'public'));

  // Step 6: Copy Electron wrapper and supporting files
  log('\n[6/8] Preparing Electron wrapper...', colors.yellow);
  copyFile(path.join(ROOT_DIR, 'electron', 'main.cjs'), path.join(EXE_DIR, 'electron.cjs'));
  copyFile(path.join(ROOT_DIR, 'package.json'), path.join(EXE_DIR, 'package.json'));
  copyFile(path.join(ROOT_DIR, '.env'), path.join(EXE_DIR, '.env.example'));
  
  // Create default .env if it doesn't exist
  const envPath = path.join(EXE_DIR, '.env');
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, 
`# Judge AI Configuration
DATABASE_URL=mysql://root:root@localhost:3306/judge_ai
JWT_SECRET=desktop-local-secret-min-32-chars-long!!
OWNER_OPEN_ID=desktop-local-user
NODE_ENV=production
PORT=3000
`);
    log('Created default .env file', colors.blue);
  }

  // Copy build resources
  if (fs.existsSync(BUILD_DIR)) {
    copyDir(BUILD_DIR, path.join(EXE_DIR, 'build'));
  }

  // Step 7: Create Electron-based installer
  log('\n[7/8] Building Windows installer (electron-builder)...', colors.yellow);
  
  // Update package.json build configuration
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'));
  pkg.build = {
    ...pkg.build,
    appId: 'com.judgeai.app',
    productName: 'Judge AI',
    files: [
      'dist/exe/**/*',
      'electron/main.cjs'
    ],
    directories: {
      output: 'release',
      buildResources: 'build'
    },
    extraResources: [
      {
        from: 'dist/exe',
        to: 'app',
        filter: ['**/*']
      }
    ],
    win: {
      target: [
        {
          target: 'nsis',
          arch: ['x64']
        }
      ],
      icon: 'build/icon.ico'
    },
    nsis: {
      oneClick: false,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: 'Judge AI',
      installerIcon: 'build/icon.ico',
      uninstallerIcon: 'build/icon.ico',
      installerHeaderIcon: 'build/icon.ico',
      include: 'build/installer.nsh',
      artifactName: '${productName}-${version}-Setup.${ext}'
    }
  };
  
  // Write updated package.json temporarily
  fs.writeFileSync(path.join(ROOT_DIR, 'package.json'), 
    JSON.stringify(pkg, null, 2) + '\n');
  
  try {
    runCommand('electron-builder --win --x64', { cwd: ROOT_DIR });
  } catch (error) {
    log('Electron-builder failed. This is expected if electron-builder is not installed.', colors.yellow);
    log('Creating alternative setup package...', colors.yellow);
    
    // Alternative: Create a simple zip distribution
    const zipName = `Judge-AI-${pkg.version}-win-x64`;
    const zipDir = path.join(RELEASE_DIR, zipName);
    ensureDir(zipDir);
    copyDir(EXE_DIR, path.join(zipDir, 'Judge AI'));
    
    // Create README for distribution
    fs.writeFileSync(path.join(zipDir, 'README.txt'), 
`JUDGE AI - Windows Installation
================================

System Requirements:
- Windows 10/11 (64-bit)
- 4GB RAM minimum (8GB recommended)
- MariaDB 10.11 or later
- Node.js 22 (if running without bundled executable)

Installation Steps:
1. Extract the "Judge AI" folder to your desired location
2. Ensure MariaDB is installed and running
3. Run "Judge AI.exe" to start the application
4. The application will open in a desktop window at http://localhost:3000

Default Configuration:
- Database: mysql://root:root@localhost:3306/judge_ai
- Port: 3000
- Admin User: desktop-local-user

To change settings, edit the .env file in the installation directory.

Troubleshooting:
- If the app doesn't start, check that MariaDB is running
- Ensure port 3000 is not in use by another application
- Check the console output for error messages

License: MIT
`);
    
    log(`Created portable distribution: ${path.join(RELEASE_DIR, zipName)}`, colors.green);
  }
  
  // Restore original package.json
  const originalPkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'));
  delete originalPkg.build;
  fs.writeFileSync(path.join(ROOT_DIR, 'package.json'), 
    JSON.stringify(originalPkg, null, 2) + '\n');

  // Step 8: Summary
  log('\n========================================', colors.bright);
  log('  Build Complete!', colors.bright);
  log('========================================\n', colors.bright);
  
  log('Output files:', colors.green);
  if (fs.existsSync(RELEASE_DIR)) {
    const files = fs.readdirSync(RELEASE_DIR);
    for (const file of files) {
      log(`  - ${path.join(RELEASE_DIR, file)}`, colors.green);
    }
  }
  
  log('\nNext Steps:', colors.yellow);
  log('1. Test the installer on a clean Windows machine', colors.yellow);
  log('2. Verify MariaDB connection and database migrations', colors.yellow);
  log('3. Test all major features after installation', colors.yellow);
  log('4. Sign the installer with a code signing certificate (recommended)', colors.yellow);
  log('');
}

main().catch(error => {
  log(`\nBuild failed: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
