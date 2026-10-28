# Delete button for videos, Oct 28 2026

Ken asked Wright directly. He chose: a Delete in both programs, and **delete for good** (his call; it overrides the usual "_discontinued, never delete" rule for these review videos only).

## What changed
- **Motion References** (https://claude.ai/artifact/U9YiTAL4juKxjLgvNeKEe8): each video card has a red "Delete video" link at the bottom. It asks "Delete this video for good?" in the page, then removes the take's record and its video file (the file only if no other take uses it). The original clip in the GitHub repo (factory-design/runway/<id>/) is not touched.
- **Studio Checklist**: the Runway videos step has a red "Delete videos" button that opens Motion References showing only that character's videos, ready to delete. (Two programs can't reach into each other's storage, so the delete itself happens in Motion References.)
- Also fixed: Motion References `#<character>` links now filter even if the first data load comes in early.

## Checked
Made a test take "wright-test-delete" (no video), deleted it with the button in my tab, confirmed with ArtifactData that it is gone. No real video was deleted. Checked the Checklist button opens Motion References on Thunderwing Gyronaut.

## For Spring
If Ken deletes a take, don't re-add it unless he asks. Update the Studio Checklist runway step note if the count changes.
