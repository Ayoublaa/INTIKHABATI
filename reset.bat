@echo off
title INTIKHABATI — Reset Complet
color 0B
cls

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║      INTIKHABATI — Reset Complet             ║
echo  ║      انتخاباتي — Plateforme Vote Blockchain  ║
echo  ╚══════════════════════════════════════════════╝
echo.

set HARDHAT=C:\Users\Windows\Desktop\civicchain\hardhat2
set BACKEND=C:\Users\Windows\Desktop\civicchain\backend
set FRONTEND=C:\Users\Windows\Desktop\civicchain\frontend

:: ── Etape 1 : Reset MongoDB ───────────────────────────────────
echo [1/4] Reset MongoDB + Seed...
cd %BACKEND%
node seed.js
if %errorlevel% neq 0 (
    echo ERREUR : seed.js a echoue. MongoDB est-il lance ?
    pause
    exit /b
)
echo.

:: ── Etape 2 : Lancer Hardhat node ────────────────────────────
echo [2/4] Lancement Hardhat blockchain...
start "HARDHAT NODE" cmd /k "cd %HARDHAT% && npx hardhat node"
timeout /t 4 /nobreak >nul
echo  OK - Hardhat demarre dans un nouveau terminal
echo.

:: ── Etape 3 : Deployer le contrat ────────────────────────────
echo [3/4] Deploiement du smart contract...
cd %HARDHAT%
npx hardhat run scripts/deploy.js --network localhost
if %errorlevel% neq 0 (
    echo ERREUR : Deploiement echoue. Hardhat node est-il lance ?
    pause
    exit /b
)
echo.

:: ── Etape 4 : Lancer Backend ─────────────────────────────────
echo [4/4] Lancement du backend API...
start "BACKEND API :3001" cmd /k "cd %BACKEND% && npm run dev"
timeout /t 3 /nobreak >nul
echo  OK - Backend demarre dans un nouveau terminal
echo.

:: ── Etape 5 : Lancer Frontend ────────────────────────────────
echo [5/5] Lancement du frontend React...
start "FRONTEND :3000" cmd /k "cd %FRONTEND% && npm start"
echo  OK - Frontend demarre dans un nouveau terminal
echo.

echo  ╔══════════════════════════════════════════════╗
echo  ║  ✅ INTIKHABATI est pret !                   ║
echo  ║                                              ║
echo  ║  🌐 Frontend  → http://localhost:3000        ║
echo  ║  🔧 Backend   → http://localhost:3001        ║
echo  ║  ⛓  Hardhat  → http://localhost:8545        ║
echo  ║                                              ║
echo  ║  ⚠  IMPORTANT : Mets a jour CONTRACT_ADDRESS ║
echo  ║     dans backend/.env avec la nouvelle       ║
echo  ║     adresse affichee ci-dessus !             ║
echo  ╚══════════════════════════════════════════════╝
echo.

pause
