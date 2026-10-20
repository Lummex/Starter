# Round 8b — queued, NOT sent yet

When the owner says "send it" for 8b, this section goes to the top of `factory-design/design/oreheart-phase-1b-brief.md` (above Round 8a, which is then marked "(done)"). Items keep their round 8 numbers (3–14) so they match the owner's change list. Text agreed with the owner on 2026-10-19.

## Round 8b — owner playtest of round 7 (Commander, cards, hand, deck builder, Choose Your Commander, text palette) — read this first

Round 8a is done; keep everything from it (painted arena board, view controls, crystal mine) and from round 7 unless an item below replaces it. Rules are unchanged. If Meshy fails (item 3), keep the current model, finish the round and explain in the report.

### 3. Commander facing and look-back emotes
- **Bug:** the player's Commander (Grubnak) faces the player (toward the camera). He must face the **opponent** (up the board) by default. The enemy Commander faces our side as now.
- **Turning:** smooth whole-body turns of about 0.4–0.6 s, never snapping; he always returns to facing the opponent.
- **Looks back at the player** when he is "talking to" them: at the start of the player's turn, when the player has nothing playable and should press Done, and briefly at random every 20–40 s while idle.
- **Impatience:** on the player's turn, after about 20 s with no player action, he turns to the player and acts frustrated (crossed arms, foot or scepter tapping, shrug), repeating more annoyed about every 15 s until the player acts; any action ends it and he turns back.
- **Faces forward** when acting against the opponent: casting spells, his creatures attacking, laughing or pointing when an enemy creature falls, taking hits.
- **Animations:** use the saved set. Add one or two impatience/look-around clips **once** from Meshy's animation library on the already-rigged Grubnak (owner approves this small Meshy use); update the saved GLB and `models.json`; never regenerate the model. If nothing fits, build it from existing clips (surprised + point at the player + head shake). Make the behavior data-driven so every future Commander uses it.

### 4. Card glow direction
The glow is inverted: today the hard, bright edge is on the outside and it fades inward toward the card. Flip it: the brightest, crisp edge sits right at the card's border and fades **outward** to nothing. Applies to the playable-card halo in the hand and the popped-out card's rim. Keep round 7's thickness, opacity and colors.

### 5. Hand hover zone
Bug: grabbing a creature on the board raises the hand, because the hover trigger is a wide strip reaching far up the screen. Replace it with a box drawn tightly around the hand cards (only their visible tucked part at rest) that grows and shrinks with the number of cards and the fan width; while the hand is raised it covers the raised cards, and leaving it tucks the hand back. The hand never rises while dragging a creature or board piece or while panning the view, including when the pointer passes over the hand.

### 6. Popped-out card
(a) Smoother: eased scale and fade of about 150–200 ms, no jump or flicker when moving between neighboring cards; the pop-out glides from card to card. (b) **20% smaller** than round 7 (about 68–72% of the screen height instead of 85–90%). Still on the very top layer, never off-screen.

### 7. Creature stat badges
The bars under each creature are too big and dominating. Replace them with a compact row of small **painted icons** (sword = Attack, heart = Health, and the same style for Movement and any other stat shown today) with the **number drawn on top of each icon** (bold white, thin black outline, centered). Paint the icons with the image API in the same rich style as the round 6a ruby hearts, transparent background, original designs. About half the current footprint, still clearly readable at 844 × 390 and when zoomed out (never smaller than readable; they scale with the view zoom otherwise). Damaged Health red-orange, buffed values green. Hovering or tapping a creature may show a slightly larger version. Keep them on top of everything on the battlefield.

### 8. Deck builder: drag cards into the deck list (regression)
Dragging a card from the collection onto the deck list no longer works. Restore it: press and drag a card (shown at the 3-per-row size while dragging) and drop it on the list to add one copy, with the same limits as "+". A click without moving (under about 6 px) still opens the close-up (item 14); moving starts a drag. Mouse and touch.

### 9. Deck builder: no layout shift when adding cards
Double-clicking a card to add it makes the deck list panel "pop out" like the old 6a "+" bug: the frame shifts, the panel widens and pushes the card grid over, making the cards smaller. Adding a card by any method (double-click, drag, "+") must never change the size or position of the panel, the grid or the cards. Fix the root cause for every path: fixed panel width, scrollbar space reserved or overlay scrollbars (e.g. `scrollbar-gutter: stable`) so a list that grows past its height doesn't change widths, fixed-width count and name columns, no width animation on new rows.

### 10. Choose Your Commander: uniform deck entries and colors
- Deck entries (e.g. Goblin Warband, Goblin Arcane Horde, Goblin Horde) come out different sizes with different borders and shift around. Make every entry identical in size, border thickness and layout; all names the same font size; long names shrink to fit or wrap the same way and never resize the box. Selecting one glows; nothing changes size or moves.
- Colors (item 13 palette): deck names and titles bright gold #FFD700 bold; "100 cards" and other secondary info brown-gold; actions ("Remove", "Copy to my decks", etc.) brown-gold that glows bright gold on hover (Remove turns warning orange-red on hover). Commander name and section headings bright gold; the Commander's description text brown-gold #D4A94F, not yellow.

### 11. Choose Your Commander: picking a Commander
- The three Commander cards (Grubnak, the Archmage, Thane Borgo) sit closer together, but their glows and faded edges must not overlap or blend.
- Hover: the hovered card smoothly grows and the other two shrink slightly (about 200 ms, eased); nothing else moves.
- Click: the other two fade out and disappear; the chosen card **enlarges and drops back to become a big backdrop** (dimmed, soft glow) in the center of the screen, and his **3D model pops up in front of it** (quick rise and scale-up with a small bounce, then idle with an occasional laugh or point). The card stays behind him while he is selected. Then only his decks populate underneath, laid out as today and uniform per item 10. Commanders without a 3D model yet (the Archmage, Thane Borgo) keep the enlarged card centered alone.
- A **Change Commander** action under him, Esc, or clicking him again brings all three back to the row.

### 12. Choose Your Commander: layout
- **Fight!** moves to the bottom-right corner, the same spot as Done on the match screen (bright gold, bold, glows on hover).
- Rearrange the other actions into a clean, balanced layout around the centered Commander (for example Back in a corner, Change Commander under him, deck actions with the deck list), all plain text actions in the palette colors.
- **Remove** the "View Grubnak in 3D" button and viewer from this screen and from the deck builder's menu (item 14 replaces it).

### 13. Text palette change, everywhere
Body, description and list text on every menu and screen changes from white to **brown-gold** (#D4A94F on dark backgrounds; #B8862B for small or secondary text). Titles, headings, names and main actions stay bright gold #FFD700. White stays only for numbers on icons (crystals, hearts, the new stat badges) and for text printed on card faces. Change the shared palette variables once (the round 6a theme file), not per screen. Check contrast at 844 × 390. This replaces the round 6a "white body text" rule.

### 14. Deck builder close-up with 3D viewer
Clicking a card in the deck builder opens the full-height close-up (round 6a) with the **card on the left** and a **3D model viewer on the right**, side by side and centered as a pair on a dim overlay. The viewer works like round 7's: drag to rotate, scroll or pinch to zoom, plain-text buttons to play each animation, soft lighting. It appears for any card that has a 3D model (today Grubnak's Commander card; creatures later); cards without one show the close-up centered alone as now. Dismiss by clicking the card, clicking outside both, or Esc; dragging or clicking inside the viewer never closes it. No scrollbars; both fit the screen with small margins. No viewer anywhere else in the deck builder.


**Tests:** keep all checks passing (update those this round intentionally changes). Add: player Commander faces the opponent by default and turns back after a look-back; impatience starts after about 20 s idle and stops on an action; glow brightest at the card edge and fading outward; hand does not rise while dragging a creature over it or while panning the view, and its hover box fits the cards for 1, 4 and 8 cards; pop-out about 70% of screen height; stat badges smaller than before and readable at 844 × 390; dragging a card into the deck list adds one copy and a plain click opens the close-up; panel, grid and first card bounding boxes unchanged after adding cards by double-click, drag and "+" until the list scrolls; Commander deck entries all the same size; choosing a Commander hides the other two and shows only his decks; Fight! in the bottom-right; no 3D viewer button on the Commander screen or deck builder menu; close-up shows the viewer for Grubnak and dismisses correctly; body text uses the brown-gold variable. Report screenshots at 1920 × 1080 and 844 × 390: the Commander screen before and after choosing Grubnak, the deck builder close-up with the viewer, and a creature with its new stat badges. Include Meshy credits spent.
