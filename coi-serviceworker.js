self.addEventListener("fetch", function (event) {
    const r = event.request;
    if (r.cache === "only-if-cached" && r.mode !== "same-origin") {
        return;
    }

    event.respondWith(
        fetch(r).then((response) => {
            if (response.status === 0) {
                return response;
            }

            const newHeaders = new Headers(response.headers);
            newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
            newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders,
            });
        }).catch(() => fetch(r)) // <-- fallback so failed intercepted requests don't brick the page
    );
});
