# Anvil-online report, Nov 7: Friends, the Exit button, and the launch prep

**Final pre-launch preview (pvp-nov2 f60ce6a7):** https://oreheart-8-apkqb5lb0-lummex.vercel.app
**TEST deploy #44 (42333557740):** green, every SQL suite including the new Friends suite (42 checks). Nothing live.
**Launch checklist:** studio/launch-checklist.md (copy in factory-design/studio/launch-checklist.md).

## Friends (Ken: "a friends list and so you can save in quick play your friends")
- 20261107000001_friends.sql: a friend code per player; friendships (pending/accepted), blocks, friend_invites (60 s). RLS on all three; players may only SELECT their own invite rows (Realtime pop-up). Doors: friends_overview (also a heartbeat), friend_request (name or code; a block looks like "no such player"; 20 per hour; friends_max), friend_respond, friend_remove, friend_block/unblock, friend_invite (friends only, own open room, 10 per 10 min), friend_invite_respond/cancel. claim_room refuses a blocked player. Admin: admin_friends, admin_remove_friendship (reason, audited). Settings friends_max (100), friend_invites_enabled.
- Game: Friends screen (code, friends online first with rank charm and status, Add, requests in/out, Accept/Decline/Block, Remove, Blocked, Challenge as friend match or practice); entry points on the Dashboard top bar (badge), the Lobby, the Profile (shows the code); the 60 s challenge pop-up; "Add friend" on the Match End. No free text.
- Mock server: tools/friends-mock.mjs, same rules in memory; the mock room claim honours blocks.

## Exit (Ken: "exit button on the dashboard")
Dashboard top bar next to the gear: Exit Oreheart / Sign out / Stay. Installed app closes; a browser tab shows the goodbye screen ("You can close this tab now") with Back to Oreheart. A running online match is given up first (the box says so).

## Launch prep
- Production hides every TEST marker (net.serverKind from server_info); the Stripe webhook takes only LIVE events on the production database and only test events on TEST.
- pvp-nov2 has every factory/issue-8 commit (merged up to c24b5b02). Size 295.6 / 300 MB.
- Recommendation: the real-money shop OFF at launch (one back-counter switch to turn on later).

## Checks
SQL suites green on TEST; browser AC698 (two accounts, add/accept/online/challenge/match), AC698b (Match End add, block), AC699 (Exit); unit tests all pass (the netgame test that failed since Nov 6 is fixed); AC646 expects 11 cards.
Pre-existing, not from this job: AC611 (older signed-in menu 28 px too tall at 1280x720, mock pages only; proven on the commit before), AC635 (expects "Back to menu", replaced by the D Match End Nov 6).
