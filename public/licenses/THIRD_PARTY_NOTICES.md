# Third-party notices

Fieldwatch is proprietary software (see `LICENSE`). It includes the third-party
components below, each under its own licence. This file lives in
`public/licenses/` so it ships with every build at `/licenses/THIRD_PARTY_NOTICES.md`.

## Art

### Tiny Swords — Pixel Frog — CC0 1.0 (old public-domain build only)

Sprites, terrain, decorations, UI panels and FX under `public/assets/**/tinyswords*`.
Source: the older public-domain build of *Tiny Swords* by Pixel Frog
(<https://pixelfrog-assets.itch.io/tiny-swords>), distributed by the author as
`TS_old version_CC0 Licensed`. CC0 1.0 Universal —
<https://creativecommons.org/publicdomain/zero/1.0/>. Attribution is not
required; it is given as a courtesy. Per-file provenance:
`public/assets/CC0-MANIFEST.md` and `public/assets/sprites/CREDITS.md`.

The *current* Tiny Swords download is under a different, non-CC0 licence. No
file from that build is included; `npx tsx scripts/harvest-cc0.ts --check`
verifies this.

## Audio

### Interface Sounds 1.0 — Kenney — CC0 1.0

`public/assets/audio/ui/*.wav`. Source: <https://kenney.nl>. CC0 1.0; licence text
ships alongside the files as `KENNEY-LICENSE.txt`. All other sound effects and
the score are synthesised by this project's own code.

## Fonts

### Crimson Text — The Crimson Text Project Authors — SIL Open Font License 1.1

`src/assets/fonts/crimson-text-{600,700}.woff2` (identical to
`@fontsource/crimson-text` 5.3.0, latin subset). Copyright 2010 The Crimson Text
Project Authors (<https://github.com/googlefonts/Crimson>). Licensed under the
SIL Open Font License, Version 1.1; the full text is `public/licenses/OFL.txt`
and ships with every build at `/licenses/OFL.txt`.

## Software bundled into the build

The following npm packages are compiled into the shipped JavaScript. Each is
under the MIT License, reproduced in full below for each copyright holder.

| Package | Version | Copyright |
|---|---|---|
| `react` | 18.3.1 | Copyright (c) Facebook, Inc. and its affiliates. |
| `react-dom` | 18.3.1 | Copyright (c) Facebook, Inc. and its affiliates. |
| `scheduler` | 0.23.2 | Copyright (c) Facebook, Inc. and its affiliates. |
| `use-sync-external-store` | 1.6.0 | Copyright (c) Meta Platforms, Inc. and affiliates. |
| `zustand` | 4.5.7 | Copyright (c) 2019 Paul Henschel |
| `@capacitor/core` | 8.5.2 | Copyright (c) 2017-present Drifty Co. |
| `@capacitor/preferences` | 8.0.1 | Copyright 2020-present Ionic |
| `@capacitor/status-bar` | 8.0.4 | Copyright 2020-present Ionic |
| `@capacitor/splash-screen` | 8.0.2 | Copyright 2020-present Ionic |

The iOS app also links the native side of the packages above and
`@capacitor/ios` 8.5.2 (Copyright (c) 2017-present Drifty Co.), all MIT.

### MIT License — Facebook, Inc. and its affiliates.

```
MIT License

Copyright (c) Facebook, Inc. and its affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### MIT License — Meta Platforms, Inc. and affiliates.

```
MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### MIT License — 2019 Paul Henschel

```
MIT License

Copyright (c) 2019 Paul Henschel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### MIT License — Drifty Co.

```
MIT License

Copyright (c) 2017-present Drifty Co.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### MIT License — Ionic

```
Copyright 2020-present Ionic
https://ionic.io

MIT License

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
