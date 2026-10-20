# 117 · "What's new" bubble for sellers after an update

**Status:** owner 20 Oct: in **1.0.43** ("A", mock-up `uxDesign/seller/mockups/117-whats-new.html`); building.

## Idea
- After the seller app updates to a new release (`RELEASE_VERSION` changes), show a small, quiet "What's new in 1.0.43" bubble/pill once per device (stored on the device), e.g. near the rail's About or as a notice pill like the existing ones.
- Tapping it opens the release notes (About) with links to the matching Help topics; "Hide" dismisses it until the next release.
- Uses the release notes already written for About (`src/features/seller-about/releaseNotes.ts`); no server change.

## Questions for later
Where it sits on tablet and phone; whether chefs and helpers see it too; whether each note line can link to a Help topic.
