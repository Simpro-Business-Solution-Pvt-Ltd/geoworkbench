# Field PWA

The Field PWA is the no-app-store mobile path for GeoWorkbench. It runs from the browser and can be installed on iPhone, iPad, Android, or desktop as a lightweight field capture app.

Open:

```text
https://geowb.simproapps.in/field
```

## Purpose

- Select an existing borehole for field updates.
- Create a new site borehole draft with collar and depth metadata.
- Capture lithology interval information.
- Capture runtime parameters whose final template is still being refined.
- Upload Excel, LAS, geophysical PDF, corebox images, and site photos.
- Capture a corebox or site photo directly from the phone camera.
- Sync the submission to the central GeoWorkbench backend.

## Install On iPhone Or iPad

1. Open Safari.
2. Go to `https://geowb.simproapps.in/field`.
3. Sign in.
4. Tap Share.
5. Tap Add to Home Screen.
6. Open Reliance GeoWorkbench Field from the home screen.

## Install On Android

1. Open Chrome.
2. Go to `https://geowb.simproapps.in/field`.
3. Sign in.
4. Use the browser menu and choose Install app or Add to Home screen.

## Notes For UAT

- Flutter remains the preferred native field app for deeper offline, camera, and push notification workflows.
- The PWA is the immediate fallback when users cannot install an APK or app-store build.
- Field submissions are stored in the same backend workflow as the Flutter app.
- File uploads are associated with the selected borehole and are available to the central web import/workbench flow.
