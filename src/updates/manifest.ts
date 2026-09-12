import { z } from 'zod';

/** Shape of the `update.json` asset published next to the APK on every Android
 * GitHub Release (see `.github/workflows/build-android.yml`). Fetched from the
 * stable URL `<repo>/releases/latest/download/update.json` — no API auth needed. */
export const UpdateManifestSchema = z.object({
  version: z.string(),
  apkUrl: z.string().url(),
  size: z.number().int().positive(),
  sha256: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/)
    .optional(),
  notes: z.string(),
});

export type UpdateManifest = z.infer<typeof UpdateManifestSchema>;

export const UPDATE_MANIFEST_URL =
  'https://github.com/patterueldev/monopoly-helper/releases/latest/download/update.json';

/** Validates unknown JSON against the manifest schema; null when invalid. */
export function parseManifest(json: unknown): UpdateManifest | null {
  const result = UpdateManifestSchema.safeParse(json);
  return result.success ? result.data : null;
}
