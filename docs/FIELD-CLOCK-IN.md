# GPS clock-in

The driver/van-sales overview and Visits section provide **Use my location & clock in**. Select an assigned outlet, enable precise foreground location, and request verification at the outlet. Choose the outlet explicitly; no outlet is selected automatically. The screen shows the measured distance and GPS accuracy, navigation and browser-specific location instructions. A successful request atomically opens the shift and visit. No separate shift-start request or default coordinate is accepted.

For E-Edge Direct 2U, the server uses the company boundary, now 100 metres as approved by the owner, instead of legacy outlet overrides. The distance from the saved store plus the phone's reported GPS uncertainty must fit inside that boundary. Coordinates must be captured within 60 seconds; reported accuracy must be 50 metres or better. The web client waits for an improved reading for up to 30 seconds. A request outside the boundary creates neither shift nor visit. Retries revalidate location and cannot create a duplicate visit.

An active, confirmed field-agent membership, enabled field module, permitted GPS check-in policy, active assigned store, and today's assignment are required. A different salesperson's assignment, stale location or missing approved store location is rejected. The flagship's remote supervisor override is disabled. A completed customer report is required before clock-out or the next visit.

A 300-metre reading is outside a 100-metre boundary. The driver should confirm the selected outlet, navigate to its entrance, enable precise browser location and retry. If the saved position appears wrong while the driver is at the entrance, they can explicitly submit their fresh position for manager review. That creates a pending location request, never attendance or an automatic coordinate change. Existing company-admin/supervisor location review verifies and approves corrections in the Stores section. Company workspace links open the field page before requesting GPS because location permission is restricted to field routes.

## Test outlet

Owner-requested test coordinates are stored privately in a clearly labelled test outlet and are never embedded in the app, APK, source repository or default location. The one-day assignment is separate from the recurring customer route. Test outlets are excluded from the customer directory, daily performance report, CSV and company store/visit totals. They remain visible to the assigned salesperson in the clock-in picker and Visits.

Use **Finish test & clock out** after a test. This records a test outcome without asserting that customer stock was checked or a customer was contacted. It closes a test-only shift; it preserves any existing real shift. Archive the outlet after physical-device acceptance.

## Device acceptance

Use driver APK v1.0.3 or later, or an HTTPS browser with location permission. On Android, allow location while using the app and enable precise location. Confirm an onsite success and an outside-boundary rejection using actual device readings. Controlled database location tests validate server behaviour but do not substitute for this device test.

Browser/WebView GPS is supplied by the device and is not tamper-proof device attestation. There is no background tracking. Precise attendance coordinates follow the existing 90-day retention policy.
