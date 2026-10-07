# Tehran map and service coverage

Booking uses Leaflet 1.9.4 and the OpenStreetMap street basemap. Drag the map, click a point or use the arrow keys to position the center pin; confirm the origin, then the destination. Both points must be confirmed before requesting a quote or a trip. Either point can be edited afterward. Device location is requested only by the location button; denied, unavailable and outside-Tehran positions have explicit messages.

The default viewport opens near Azadi Square in Tehran. Pan bounds constrain the map to the city's bounding rectangle. **Eligibility uses the actual city polygon**, not that rectangle: both trip endpoints, the driver's reported availability location and the accepting driver's stored location are checked on the server. The frontend uses the same boundary for selection feedback. Nearby cities such as Karaj are outside the service area. Completed historical demo receipts are not rewritten by this change.

The dashed line joins the selected points and represents **straight-line distance**. Street routing, traffic and ETA are not connected. Explicit public-place search is available as described below. The active journey map uses the request's persisted coordinates. The sign-in illustration remains decorative and explicitly labelled as schematic.

## Boundary provenance and attribution

`shared/geo/tehran-area.json` is the Tehran administrative city polygon from [OpenStreetMap relation 6663864](https://www.openstreetmap.org/relation/6663864), retrieved once through the official Nominatim endpoint on 2026-10-07. Its source metadata is included in the GeoJSON. GeoJSON coordinates are longitude/latitude; app coordinates are latitude/longitude. The ring is checked with a boundary-inclusive point-in-polygon test in Python and TypeScript.

Boundary data: **© OpenStreetMap contributors**, available under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). See [OpenStreetMap copyright and attribution](https://www.openstreetmap.org/copyright). This data license does not assign a license to the rest of BAXI's code.

## Tile service and offline behavior

The educational demo uses `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, with visible attribution and a browser Referer permitted by `strict-origin-when-cross-origin`. The deployment CSP allows this image host. Browser HTTP caching follows the tile server's headers. The app's service worker excludes all cross-origin requests, including tiles: it does **not** bulk download, prefetch, package or promise an offline basemap. The [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/) applies. Public production traffic needs a suitable tile provider and capacity agreement; the community service has no service-level guarantee.

Automated Playwright tests intercept tile requests with explicitly labelled synthetic tiles; they never pan or zoom against the public tile server. Their captures go to ignored `artifacts/screenshots`. Repository map screenshots are captured separately from a normal browser session. Map tests cover sequential confirmation, keyboard movement, coordinates sent to pricing, editing, identical endpoints and out-of-city device location. API tests independently reject out-of-city quotes, requests and driver positions, so a modified browser cannot bypass the service area.


## Explicit place search

`GET /api/places?q=…` requires a signed-in passenger or driver. The server calls the Nominatim-compatible provider configured by `BAXI_GEOCODER_URL` (default `https://nominatim.openstreetmap.org`). Compose forwards this variable; changing it and recreating the API switches providers without changing browser code. Search happens only after submitting the form, never on keystrokes or map movement. Queries are restricted to Tehran's viewbox and country; responses are independently filtered through the shared city polygon and labels are shortened to three address components.

The single API process serializes upstream requests, rejects requests arriving within one second of the previous start, identifies BAXI in its User-Agent and caches up to 256 normalized queries for 24 hours. An in-flight query produces an explicit retry message for other users; there is no request queue or automatic retry. Cached queries do not contact the provider. Query errors or empty results retain manual map selection. The provider receives the submitted public-place query and the server's IP, not account identity or the selected trip coordinates. The interface asks users to avoid personal information.

This low-traffic educational use follows the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/), including no autocomplete. Public deployment needs an appropriate provider/self-hosted capacity and privacy review; horizontal scaling would invalidate this process-local limit. Automated tests mock the provider and all tiles. A normal browser search for the public landmark Meydan-e Enghelab was verified separately; no real passenger address was submitted.
