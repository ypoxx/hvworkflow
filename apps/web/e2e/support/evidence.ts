/**
 * Slice 031b: where the screenshots of the shared e2e files go. `in-process` writes into `docs/evidence/` as always;
 * the `http` project writes into the test output directory, because both projects run the same files and would
 * otherwise overwrite each other's images. Only named paths are ever staged, never `git add -A`.
 */
import { test } from './http-guard';

export const evidence = (name: string): string =>
  test.info().project.name === 'http'
    ? `${test.info().outputDir}/${name}`
    : `${test.info().project.testDir}/../../../docs/evidence/${name}`;
