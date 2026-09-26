/*! coi-serviceworker v0.1.7 - Patched for Robust Fetch Fallback & Isolation Guard */
let coepCredentialless = false;

if (typeof window === 'undefined') {
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

    self.addEventListener("message", (ev) => {
        if (!ev.data) {
            return;
        } else if (ev.data.type === "deregister") {
            self.registration
                .unregister()
                .then(() => self.clients.matchAll())
                .then((clients) => {
                    clients.forEach((client) => client.navigate(client.url));
                });
        } else if (ev.data.type === "coepCredentialless") {
            coepCredentialless = ev.data.value;
        }
    });

    self.addEventListener("fetch", function (event) {
        const r = event.request;
        if (r.cache === "only-if-cached" && r.mode !== "same-origin") {
            return;
        }

        const request = (coepCredentialless && r.mode === "no-cors")
            ? new Request(r, { credentials: "omit" })
            : r;

        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.status === 0) {
                        return response;
                    }

                    const newHeaders = new Headers(response.headers);
                    newHeaders.set(
                        "Cross-Origin-Embedder-Policy",
                        coepCredentialless ? "credentialless" : "require-corp"
                    );
                    newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

                    return new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: newHeaders,
                    });
                })
                .catch((err) => {
                    console.warn("[coi-sw] Fetch failed, falling back to direct network:", err);
                    return fetch(request).catch(() => {
                        return new Response(null, { status: 503, statusText: "Service Unavailable" });
                    });
                })
        );
    });
} else {
    (() => {
        if (window.crossOriginIsolated || !navigator.serviceWorker) {
            return;
        }

        // Prevent infinite reloads if the origin or frame does not allow crossOriginIsolated
        const reloadCount = parseInt(window.sessionStorage.getItem("coi_reload_count") || "0", 10);
        if (reloadCount > 1) {
            console.warn("[coi-sw] Unable to establish crossOriginIsolated after reload. Aborting auto-reload loop.");
            return;
        }

        const currentScript = document.currentScript;
        if (!currentScript || !currentScript.src) {
            return;
        }

        navigator.serviceWorker.register(currentScript.src).then(
            (registration) => {
                registration.addEventListener("updatefound", () => {
                    window.sessionStorage.setItem("coi_reload_count", String(reloadCount + 1));
                    window.location.reload();
                });

                if (registration.active && !navigator.serviceWorker.controller) {
                    window.sessionStorage.setItem("coi_reload_count", String(reloadCount + 1));
                    window.location.reload();
                }
            },
            (err) => {
                console.error("[coi-sw] Registration failed: ", err);
            }
        );
    })();
}
