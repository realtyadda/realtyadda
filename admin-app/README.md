# RealtyAdda private approval dashboard

Implementation complete; Google deployment and live acceptance tests still required.

This is a **separate, standalone Apps Script project**, not a replacement for
`apps-script/Code.gs`. It reads and updates the existing RealtyAdda Leads sheet.
The existing public submission/photo/listing service does not need changing.

## One-time installation

1. Sign in to Apps Script as **shekhar.ch90@gmail.com** and create a new project
   named **RealtyAdda Admin**.
2. Paste this folder's `Code.gs` into its Code.gs file.
3. Create an HTML file named **Dashboard** and paste `Dashboard.html` into it.
4. Under Project Settings, enable **Show appsscript.json manifest file**. Replace
   that manifest with this folder's `appsscript.json` and save.
5. Deploy → New deployment → Web app. Set **Execute as: User accessing the web app**
   and **Who has access: Only myself**. Verify both settings before deploying.
   Do not choose anonymous/public access. If Google does not offer this combination,
   stop and review the deployment settings; do not widen access to work around it.
6. Review Google's authorization prompt. The app needs your email identity,
   spreadsheet access to edit listings, and read-only Drive access for photo previews.
   Google scopes are broader than a single sheet/folder; the code uses the fixed
   RealtyAdda sheet and photo IDs attached to its rows. No passwords or tokens go
   in the website, repository or sheet.
7. Open the resulting web-app URL and bookmark it as **RealtyAdda Admin**.
   This URL is the admin login/dashboard; no separate password is required.

## Daily use

Pending is selected initially. Test submissions are hidden by default and cannot
be published. Select a property, review photos and contact details, edit as needed,
then Approve & publish. The confirmation describes what becomes public.
Save changes preserves the current status. Reject hides a listing; Move to pending
withdraws it. Both are reversible. A published listing has a View published property
link. No rows, photos or uploads are deleted by this app.

## Security and preservation

Every callable admin operation checks the active Google account, not just the
script owner's effective identity. Missing identity is denied before any sheet
or Drive read. Helpers end in `_` and cannot be called through google.script.run.
There is no public JSONP/POST admin API. Google HTML Service supplies the RPC
transport; default frame restrictions remain enabled. Seller content is rendered
with textContent, not HTML. Photo reads accept a listing ID and photo index only,
never an arbitrary Drive ID. Writes validate fields and headers, use a lock, and
check a row version to reject stale edits from another dashboard session.
The admin lock serializes this project only: avoid editing the same listing
simultaneously directly in Sheets. The public project only appends new rows.
Columns A:B and R:S are not written; photo columns N:P are preserved.

## Acceptance checks after deployment

- Signed-out and other-account visitors cannot view listings or invoke admin RPCs.
- Owner can list Pending/Published/Rejected, search and review private photos.
- Review and save a genuine listing without changing its status; reload to confirm.
- With owner approval, publish a genuine pending listing and verify Buy/Rent and
  property details. Move it back to Pending and verify public endpoints exclude it.
- Open a listing twice; save one view, then confirm the old view refuses a stale save.
- Confirm existing submission/photo upload still works.

Local security/behavior tests: `node tests/admin.test.cjs`.
Reference: https://developers.google.com/apps-script/guides/web
Identity: https://developers.google.com/apps-script/reference/base/session
RPC: https://developers.google.com/apps-script/guides/html/communication
