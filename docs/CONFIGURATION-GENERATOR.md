# Palworld Server Configuration Generator

PalCenter includes a standalone generator under **Tools → Server Configuration
Generator**. It creates validated `PalWorldSettings.ini` content in the browser
and provides copy and download actions.

> **Current coverage:** The generator supports a curated subset of **24 commonly
> used settings**, not every Palworld setting. The downloaded file is a valid
> standalone partial `OptionSettings` configuration; omitted settings continue
> to use Palworld defaults.

The generator does **not** read, update, restart, or otherwise modify a
connected Palworld server. Password fields and generated content remain in the
current browser tab and are not sent to the PalCenter API or saved in browser
storage. Passwords are redacted in the visual preview by default, but copied
and downloaded configurations contain the configured plaintext credentials.

## Using the generated file

Pocketpair documents these standard locations after the dedicated server has
been started at least once:

- Linux:
  `steamapps/common/PalServer/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini`
- Windows:
  `steamapps\common\PalServer\Pal\Saved\Config\WindowsServer\PalWorldSettings.ini`

Back up the existing file and follow the operating procedure for your Palworld
deployment before replacing it. Editing `DefaultPalWorldSettings.ini` itself
does not apply settings to the server.

## Schema basis and limitations

Schema version 1 was reviewed on 2026-07-25 against Pocketpair's
[Palworld Server Guide](https://docs.palworldgame.com/settings-and-operation/configuration/)
and `DefaultPalWorldSettings.ini` downloaded directly through SteamCMD from
Palworld Dedicated Server app `2394010`, Steam build `24181105` (Palworld 1.0).
The verified template has SHA-256
`4865FA1EB01D07E010B69E6269F955D24AA658E7B66AEA742B81AFB01BA7AC81`.

The initial schema intentionally covers a conservative set of commonly used
settings. Palworld includes additional current, reserved, and deprecated keys
that are not generated. Numeric limits are shown only where documented or
where the value is a valid network port. PalCenter presets are convenience
starting points and are not official Pocketpair recommendations.

Importing an existing file, preserving unknown settings, comparing
configurations, applying settings to connected servers, and automatic rollback
are not included in this version.
