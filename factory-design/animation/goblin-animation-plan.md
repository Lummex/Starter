# Goblin animation plan (Oct 26)

Made overnight by Claude with the Blender worker. Every goblin keeps his original Meshy clips; new clips are **added** with names starting `OH_`.

## Shared reactions (every goblin gets these)
Designed once on Snotskull Grunt, then copied to every goblin (they all share the same Meshy skeleton).

- **OH_Hit** (once; events: -): Takes a normal hit: head and chest snap back, one stagger step, shakes it off and returns to idle.
- **OH_React_Knockback** (once; events: -): Shoved hard: arms fly up, upper body thrown backwards, skids (the game slides him back 1-2 spaces - he must not travel himself), windmills his arms and catches his balance.
- **OH_React_Bonk** (once; events: -): Bonked on the head by a thrown skull: head snaps down, eyes-crossed dizzy wobble in a circle, shakes head and recovers.
- **OH_React_Bowled** (once; events: down, up): Hit by a giant bowling ball like a bowling pin: legs swept, falls flat on his back ('down' event when he hits the ground), lies dazed a moment, then gets up holding his head ('up' event when standing) and returns to idle.
- **OH_React_Backstab** (once; events: hit): Stabbed in the back: arches forward with a jolt ('hit' at the jolt), stiff arms, then reaches back over his shoulder trying to pull out the dagger, finally yanks it free and staggers back to idle.
- **OH_React_Lifted** (loops; events: -): Lifted into the air by magic (the game raises and moves him; he must stay in place): legs dangle and kick, arms flail, struggles. Loops seamlessly while he floats.

## Signature moves

### Bare Knuckle Lunatic (`goblin-bomber`)
Brawler who thinks every problem is a fistfight. Always bouncing, always throwing punches. Holds: nothing (fists always closed).

- **OH_Idle** (loops; events: -): Shadow boxing (owner's wish): bouncing on his toes, bob and weave, jab-jab-cross combination, then back to bouncing. Loops.
- **OH_Walk** (loops; events: -): In-place walk cycle for moving one board space at a time (the game slides him forward; he must NOT move forward himself, feet step in place like on a treadmill). Two full steps, loops seamlessly. Style: boxer's shuffle, fists up guarding his face, shoulders rolling.
- **OH_Attack** (once; events: hit): Three-punch combo: left jab, left jab, then a huge wind-up right haymaker. The haymaker connects at the 'hit' event.
- **OH_Death** (once; events: shockwave): His death ability: knocked to one knee, raises his right fist high and SLAMS it into the ground (event 'shockwave' at the moment of impact - the game sends the knock-back wave), then collapses forward and stays down (do not return to idle).

### Bowler Brawler (`goblin-scrapper`)
Ex-professional goblin bowler. Cocky, plays to the crowd, loves his ball. Holds: a bowling ball in his right hand (held out in front of him).

- **OH_Idle** (loops; events: -): Spins the bowling ball on one raised finger like a basketball for a moment, then catches it and holds it in front of him again, looking smug. Loops.
- **OH_Walk** (loops; events: -): In-place walk cycle for moving one board space at a time (the game slides him forward; he must NOT move forward himself, feet step in place like on a treadmill). Two full steps, loops seamlessly. Style: confident strut, ball cradled at his hip.
- **OH_Attack** (once; events: hit): Shoulder-check bash: steps in and slams the target with the ball held in both hands. Impact at 'hit'.
- **OH_Special** (once; events: ball_release): Bowling roll (owner's wish): brings the ball back behind him, steps forward low into a classic bowler's lunge, swings the arm forward and releases the ball along the ground in front of him ('ball_release' at the release), follow-through with the arm up, then a little fist pump.

### Backstabbing Thief (`goblin-sneak`)
Sneaky and sinister, hides in shadows before he strikes. Never fights fair. Holds: a dagger in his right hand and a bag at his neck.

- **OH_Idle** (loops; events: -): Hunched and shifty: tests the dagger point with a fingertip, glances left and right, a little twirl of the dagger, then back to a crouched ready stance. Loops.
- **OH_Walk** (loops; events: -): In-place walk cycle for moving one board space at a time (the game slides him forward; he must NOT move forward himself, feet step in place like on a treadmill). Two full steps, loops seamlessly. Style: sneaking tiptoe, crouched low, dagger held close.
- **OH_Attack** (once; events: hit): Backstab: quick sidestep as if slipping behind the target, then a clean double stab forward and down (two stabs, 'hit' at the second), then hops back into his crouch.

### Junk Shaman (`junk-shaman`)
Old, wise goblin spellcaster. Leans on his staff, mutters spells. Holds: a staff in his right hand.

- **OH_Idle** (loops; events: -): Leans on his staff, taps it on the ground twice, mutters (head bobbing), free hand wiggles fingers like stirring magic. Loops.
- **OH_Walk** (loops; events: -): In-place walk cycle for moving one board space at a time (the game slides him forward; he must NOT move forward himself, feet step in place like on a treadmill). Two full steps, loops seamlessly. Style: slow old-man hobble using the staff as a walking stick.
- **OH_Attack** (once; events: hit): Bonks the target with the top of his staff: raise high, bring it down. 'hit' at contact.
- **OH_Special** (once; events: lift_start, lift_end): Levitation spell: raises the staff high overhead with his free hand reaching out, fingers spread ('lift_start' when the arm is fully raised - the game lifts the target), holds while slowly moving the arm sideways as if carrying something heavy through the air, then lowers the staff ('lift_end' - the game sets the target down).

### Skullflinger (`goblin-slinger`)
Throws skulls of fallen enemies. Gleeful and twitchy. His attack (Skull_Throw) is already made and approved. Holds: a skull mace in his right hand.

- **OH_Idle** (loops; events: -): Tosses a skull up a little and catches it in the same hand, looks around eagerly for a target, cackles (shoulders shaking). Loops.
- **OH_Walk** (loops; events: -): In-place walk cycle for moving one board space at a time (the game slides him forward; he must NOT move forward himself, feet step in place like on a treadmill). Two full steps, loops seamlessly. Style: bouncy, eager skip-walk, skull held up by his shoulder.
- **Skull_Throw** (approved Oct 26): his attack; `projectile_release` at 0.63 s.

### Snotskull Grunt (`goblin-grunt`)
Plain and sturdy, not very smart, but can still hurt ya. Holds: a frying pan in his right hand.

- **OH_Idle** (loops; events: -): Dim-witted: picks his nose with the free hand, looks at it, wipes it on his shirt, rests the frying pan on his shoulder. Loops.
- **OH_Walk** (loops; events: -): In-place walk cycle for moving one board space at a time (the game slides him forward; he must NOT move forward himself, feet step in place like on a treadmill). Two full steps, loops seamlessly. Style: heavy, plodding march, pan on his shoulder.
- **OH_Attack** (once; events: hit): Big overhead frying-pan whack: two-handed raise, slam down with a squash on contact ('hit').

### Boneknocker (`goblin-pebbler`)
Plain and sturdy. Just kneecaps! Low, mean swings. Holds: a spiked club in his right hand.

- **OH_Idle** (loops; events: -): Slaps the club into his free palm, grins, rolls his neck. Loops.
- **OH_Walk** (loops; events: -): In-place walk cycle for moving one board space at a time (the game slides him forward; he must NOT move forward himself, feet step in place like on a treadmill). Two full steps, loops seamlessly. Style: swaggering stomp, club dragging low behind him (never through the ground).
- **OH_Attack** (once; events: hit): Kneecapper: crouches and swings the club low and sideways at knee height ('hit' at contact), then straightens up laughing.

### Goblin Chef (`rotgut-grenadier`)
Not very clean, not very nice, cooks horribly. His smack knocks the target back 2 spaces. Holds: a spatula in his right hand.

- **OH_Idle** (loops; events: -): Flips something invisible with the spatula, catches it, sniffs it, makes a disgusted-but-proud face. Loops.
- **OH_Walk** (loops; events: -): In-place walk cycle for moving one board space at a time (the game slides him forward; he must NOT move forward himself, feet step in place like on a treadmill). Two full steps, loops seamlessly. Style: waddling cook's shuffle, belly forward, spatula waving.
- **OH_Attack** (once; events: hit): Smack: huge sideways spatula swat, like hitting a fly, with a big follow-through ('hit' at contact; the game knocks the target back 2 spaces).

### Skullbasher Rusher (`skullbasher-rusher`)
Charge! Moves and attacks in the same turn. All forward momentum. Holds: a mace in his right hand and a shield in his left hand.

- **OH_Idle** (loops; events: -): Bangs the mace on his shield twice, stamps a foot like a bull ready to charge, snorts. Loops.
- **OH_Walk** (loops; events: -): In-place walk cycle for moving one board space at a time (the game slides him forward; he must NOT move forward himself, feet step in place like on a treadmill). Two full steps, loops seamlessly. Style: leaning-forward jog with the shield up in front.
- **OH_Attack** (once; events: hit): Shield bash then mace swing: lunges forward behind the shield (first impact), then swings the mace down ('hit' at the mace impact).

### Shiv Rat (`shiv-rat`)
Small, twitchy, sneaky. Enemies can't strike back. Darts in and out. Holds: a dagger in his right hand and a backpack on his back.

- **OH_Idle** (loops; events: -): Twitchy rat-like movements: quick head turns, sniffing, flicks the dagger, shifts weight foot to foot. Loops.
- **OH_Walk** (loops; events: -): In-place walk cycle for moving one board space at a time (the game slides him forward; he must NOT move forward himself, feet step in place like on a treadmill). Two full steps, loops seamlessly. Style: quick scurry with small fast steps, hunched.
- **OH_Attack** (once; events: hit): Darting shiv: quick lunge in, three fast stabs ('hit' at the last), then a hop back.

## Which game moment plays which clip

| Game moment | Clip | Notes |
|---|---|---|
| Waiting | OH_Idle (fallback: Idle) | loops |
| Moving a space | OH_Walk (fallback: walk clip) | game slides the unit while it plays |
| Attacking | OH_Attack (Skullflinger: Skull_Throw) | damage/visual hit at the `hit` event |
| Ability | OH_Special | e.g. Bowler `ball_release`, Shaman `lift_start`/`lift_end` |
| Hit by a normal attack | OH_Hit | |
| Knocked back (Chef smack, Lunatic shockwave) | OH_React_Knockback | game slides the unit back |
| Hit by the bowling ball | OH_React_Bowled | `down`, `up` events |
| Stabbed by Thief / Shiv Rat | OH_React_Backstab | target turns its back first |
| Lifted by Junk Shaman | OH_React_Lifted | loops while floating |
| Hit by a thrown skull | OH_React_Bonk | |
| Defeated | OH_Death (Lunatic) or the Meshy defeat clip | Lunatic: `shockwave` event |
