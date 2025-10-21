import React from "react";

export default function SafeSplash() {
  return (
    <main className="min-h-screen grid place-items-center bg-background text-foreground">
      <section className="max-w-md text-center space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Preview Safe Mode</h1>
        <p className="text-muted-foreground">
          The app is running in a safe preview to bypass a development React mismatch.
          You can continue editing while we stabilize the runtime.
        </p>
        <p className="text-sm text-muted-foreground">
          Once diagnostics show a single React renderer, we will restore the normal home route.
        </p>
      </section>
    </main>
  );
}
