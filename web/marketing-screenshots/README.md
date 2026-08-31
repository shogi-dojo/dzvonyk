# Marketing screenshots

These images are generated from a deterministic, fictional school dataset.
The school name and every teacher identity are synthetic and are not sourced
from a real school, staff directory, or imported user file.

The data shape is calibrated from anonymized aggregate statistics of reference
`.roz` files: 25 classes, 31 teachers, 20 subjects, and 659 placed hours. The
fictional team contains 24 women and 7 men; every teacher has 15–28 weekly
hours, lessons extend through period nine, and 59 timetable cells contain
paired first/second-group lessons. No school name, teacher identity, or exact
source timetable is copied from the reference files.

Regenerate all screenshots from `web/`:

```sh
npm run e2e:marketing-screenshots
```

The Playwright scenario imports a generated `.roz` file, opens the same screens
as a user, verifies that the timetable is dense, and writes PNG files here.
When `cwebp` is available, matching WebP files are generated as well.

The temporary `.roz` fixture is written to `web/test-results/` and is not meant
for distribution. Update the reusable dataset in
`src/test/fixtures/marketingSchool.ts` when a different data mix is needed.
