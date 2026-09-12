# Activate property photo uploads

The website uses the existing Apps Script web-app URL. No new paid service is needed.

1. Open the Apps Script project attached to RealtyAdda Property Leads.
2. Back up the existing Code.gs, then replace it with the complete Code.gs in this folder and save.
3. Select `setup` in the function menu and run it. Google may ask the owner to authorize Drive access so the script can save photos.
4. In Deploy → Manage deployments, edit the existing web-app deployment, choose New version, and deploy. Keep its existing URL, execution identity and audience settings.
5. Reload the Post Property page. The photo selector enables only when the service confirms it is ready.
6. Submit one clearly marked test property with a photo. Verify the saved row, Photo Count, and private Photo Folder before marking the work complete.

## Review and publish

New submissions remain Pending in column Q (Publication Status) of the RealtyAdda Leads tab. Review each property's details and photos before changing Q to Published. Column R contains its public property/gallery link. Changing Q back to Pending prevents subsequent public requests from retrieving that listing. Listings are not automatically added to the static Buy/Rent cards.

Names, mobile numbers, folder links and internal file IDs are excluded from public responses. Photos remain in private Drive folders; the service returns only photos of Published listings.

## Limits

Up to 10 photos per submission. The browser accepts JPG, PNG and WebP up to 12 MB each and converts/resizes each to JPEG at most 250 KB. The service accepts at most 50 submissions per India-calendar day; `RA.dailySubmissions` can be adjusted by the owner. Google account storage and Apps Script quotas still apply.

## Compatibility

Existing text-only submissions remain supported by the new backend. Until it is activated, the website continues text submission against the old backend and offers the business WhatsApp link for photos. The selector stays disabled when photo availability cannot be confirmed. A submission is reported successful only after the service confirms the reference and, when supplied, the photo count.

The prepared setup validates the existing 13 headers before adding columns N:S and does not delete or overwrite lead rows. Do not run it against a differently structured sheet without adapting the code.
