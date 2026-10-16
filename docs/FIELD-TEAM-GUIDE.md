# Customers, routes and staff

The administrator can register staff at `/admin/team`, or from the company workspace’s Team tab. Use a working recipient email. New recipients receive a secure invitation and choose their own password; existing accounts receive a setup/recovery link. The account must confirm its email before approved access is claimed. Invite records show delivery failures and acceptance status. Disable access to revoke company membership and linked flagship business permissions.

Van salespeople use `/field/e-edge-direct-2u`. Managers search all imported customer outlets, edit addresses and GPS, register new outlets and assign either recurring named routes or dated single-store visits. A recurring route produces today’s assignments when the salesperson opens the workspace. An outlet without a named route needs a manager to allocate a route or one-day visit.

At the assigned store, select **Clock in & start visit** and permit precise location. Successful verification starts the shift and visit together. Failed verification rolls back automatic clock-in. Complete the stock/contact report in Visits before starting another visit or clocking out. A check-in alone never counts as a completed visit.

Legacy stores retain source IDs and saved usable Nigerian coordinates. Missing, zero, invalid or implausibly overseas coordinate pairs are not replaced with invented GPS. They appear as **Location needed**. The salesperson captures a fresh location at the assigned store; a manager reviews its map and approves or rejects it. A proposal does not complete a visit or change a store until approved. Existing saved points remain source data and may still need field correction.

The importer `node scripts/import-field-customers.cjs --expect=3456 --apply` requires both ignored `.data/legacy-customers.json` and `.data/legacy-locations.json`, complete pagination evidence, the private database connection and official CA. It imports operational outlets without creating customer Auth users, sending emails or replacing staff edits on reruns. Keep the source files private; never include them in Git or deployment ZIPs.

Location capture works in the HTTPS field web workspace. Native offline capture and background tracking are not part of this workflow. Store coordinates are shown only to authorized operational staff and assigned salespeople.
