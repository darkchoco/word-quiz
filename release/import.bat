@echo off
chcp 65001 >nul
node --disable-warning=ExperimentalWarning "%~dp0import.mjs" %*
