# PalCenter v1.2.1

Release Date: July 27, 2026

## Overview

PalCenter v1.2.1 improves server management, refines the user interface, and introduces a new development release channel for users who want to test upcoming features before they're released to production.

---

## ✨ New Features

### Remove Servers

Administrators can now remove configured servers directly from PalCenter.

Removing a server only removes it from PalCenter—it does **not** stop the server, delete your world, uninstall Docker, or modify any remote server files.

### Development Release Channel

PalCenter now offers an optional **Development** release channel for users who want early access to upcoming features.

Development builds are available from:

`ghcr.io/shanebionic/palcenter:dev`

Production users should continue using:

`ghcr.io/shanebionic/palcenter:latest`

---

## 🚀 Improvements

### Password Protection Status

Improved how PalCenter reports server password protection.

Servers now display one of three states:

- Protected
- Not Protected
- Unknown

When the Palworld REST API does not expose password information, PalCenter now reports **Unknown** instead of making incorrect assumptions.

### Tools

Improved the Tools page experience.

- Entire tool cards are now clickable.
- Cleaner visual styling.
- Improved keyboard accessibility.

### About Page

The About page now clearly identifies whether you're running a **Production Build** or a **Development Build**.

Development builds also display the current commit ID to simplify troubleshooting and bug reporting.

---

## 🐛 Fixes

- Fixed incorrect password-protection reporting.
- Fixed incorrect lock icon display for servers without a join password.
- Improved reliability when removing configured servers.
- Various UI polish and reliability improvements.

---

Thank you to everyone testing development builds and helping improve PalCenter!