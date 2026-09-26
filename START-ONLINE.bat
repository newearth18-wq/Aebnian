@echo off
chcp 65001 >nul
title MECCHA CHAMELEON - Online Launcher
echo ============================================
echo   MECCHA CHAMELEON - Start Online Server
echo ============================================
echo.
echo [1/2] Starting game server (port 3000)...
start "Game Server" /min cmd /c "cd /d D:\คลังสื่อ\server && node server.js"
timeout /t 3 /nobreak >nul
echo [2/2] Starting Cloudflare tunnel...
echo.
echo  ============================================================
echo   LOOK FOR THE LINK  https://xxxxx.trycloudflare.com  BELOW
echo   ^(inside the box^) - give that link to your students!
echo   Keep BOTH windows open while playing.
echo  ============================================================
echo.
"D:\คลังสื่อ\tools\cloudflared.exe" tunnel --url http://localhost:3000
pause
