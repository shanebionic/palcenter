# Administrator teleport UAT

Teleport controls require an authenticated, connected PalCenter Companion that advertises the relevant action. In Connection Settings, choose the administrator's own online character from the **Administrator character** list. PalCenter stores that stable player ID; it never derives the character from the PalCenter account or a display name.

From **Players**, select **Go to player** to move the configured administrator to an online player, or **Bring player to me** to move that player to the configured administrator. Confirm the plain-language summary before each request. The action is unavailable when either configured administrator character or target is offline, the Companion disables it, or permission is denied.

For live UAT, verify the resulting in-game position after each success and confirm that a rejected, timed-out, or uncertain request does not get retried automatically. In particular test mounted, gliding, structured, water-adjacent, dungeon, World Tree, and special-area states. Do not attempt a second action after an uncertain result until the player location is refreshed and verified.

Map-location teleport requires the Companion's verified Palpagos location action. Choose **Send player to map location**, click a Palpagos destination, review the X/Y confirmation, then confirm or cancel. An ordinary map click never teleports anyone. PalCenter sends only the request ID, administrator and target player IDs, `coordinateSpace: palpagos`, X/Y, and `verification: palpagos_map`; it never requests or displays a destination height before teleporting. Companion resolves the final floor and collision-safe placement and PalCenter shows the returned resolved destination after success.

Verify clear rejection messages for no safe floor, ocean or unsafe terrain, collision, an offline player, a player in a special area, unsupported coordinate space, and disabled administrator actions. Do not retry a rejected or uncertain request automatically.
