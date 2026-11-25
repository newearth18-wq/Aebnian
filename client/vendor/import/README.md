# Quiz import readers

Vendored for lazy, same-origin loading. No build step or third-party CDN request is required at runtime.

| Reader | Version | Official source | License |
| --- | --- | --- | --- |
| SheetJS CE | 0.20.3 | https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js | Apache-2.0, SHEETJS-LICENSE.txt |
| Mammoth | 1.13.0 | https://www.npmjs.com/package/mammoth/v/1.13.0 (`mammoth.browser.min.js`) | BSD-2-Clause, MAMMOTH-LICENSE.txt |
| PDF.js | 5.6.205 | https://www.npmjs.com/package/pdfjs-dist/v/5.6.205 (`legacy/build/pdf.mjs` and matching worker) | Apache-2.0, PDFJS-LICENSE.txt |

PDF.js evaluation is disabled. Mammoth output is parsed into an inert document for table text extraction and is never inserted into the teacher page as HTML. Raw document contents are treated as data only.
