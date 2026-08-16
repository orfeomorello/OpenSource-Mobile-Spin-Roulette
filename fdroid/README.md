# F-Droid submission

This directory contains the proposed `fdroiddata` metadata for the official
F-Droid repository. It is a submission recipe, not a private F-Droid repo.

## Before submitting version 1.0.2

1. Commit these changes and push them to the public GitHub repository.
2. Create and push the exact release tag referenced by the recipe:

   ```powershell
   git tag -a v1.0.2 -m "Mobile Roulette 1.0.2"
   git push origin v1.0.2
   ```

3. Confirm that `versionCode` is `3` and `versionName` is `1.0.2` in
   `android/app/build.gradle`. Every later Android release must increment
   `versionCode` and have its own public source tag.
4. Test the recipe with `fdroid lint` and `fdroid build` in an fdroidserver
   environment, or submit a Request For Packaging if that environment is not
   available.
5. Copy `io.mobilespinroulette.app.yml` to the `metadata/` directory of a fork
   of `fdroid/fdroiddata`, replace `commit: v1.0.2` with the tag's full commit
   hash if requested during review, and open a merge request.

## Free-software compliance

- The app source is GPL-3.0-or-later and the Inter font is OFL-1.1.
- The build has no Google Services, Firebase, ads, analytics, billing, or other
  proprietary runtime libraries.
- Files matching `public/audio/andriih-*.mp3` use the non-FOSS Pixabay Content
  License and are intentionally ignored by Git. The F-Droid recipe never
  downloads or packages them.
- `npm ci --ignore-scripts` uses the committed lockfile. The recipe runs the
  TypeScript/Vite build directly so the optional audio download step is not
  invoked while F-Droid builds without network access.
- F-Droid builds an unsigned release APK and signs it with its own key. It will
  therefore not update an installation signed by Google Play or a local key.

Official guidance:

- https://f-droid.org/docs/Submitting_to_F-Droid_Quick_Start_Guide/
- https://f-droid.org/docs/Inclusion_Policy/
- https://gitlab.com/fdroid/fdroiddata
- https://gitlab.com/fdroid/rfp
