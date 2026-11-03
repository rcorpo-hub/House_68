# 68 Boundary Road, Camp Hill

Move the entire model-2 folder to the desired location. On Windows, run
run.bat and leave its window open while using the showroom. Node.js must be
installed. The included dist folder is the runtime and needs no npm install,
internet connection, or files from the original showroom. The local address
is http://127.0.0.1:5188/. Selections are stored in that browser.

To edit and rebuild, run npm ci and npm run build from this folder.

Model source: 68 Boundary Road, Camp Hill, Issue G. Ground and upper plans
A-01-04 and A-01-05, elevations A-02-03 and A-02-04, sections A-02-05.
The model uses the 25.25 m garage-front to alfresco datum, the 3.20 m alfresco,
the 23.14 m upper front-to-rear span including the balcony, the 7.92 m upper
width and the annotated 350 mm garage step, 2.74 m ground plate height, 380 mm
floor zone and 2.59 m upper plate height.

Door and window sizes not scheduled in the PDF, roof ridge and hip positions,
pool dimensions, site levels, screens, and fixture placement are traced
estimates. Furniture, fixtures and catalog finishes are previews. This is a
selection model, not a construction drawing.


## Vercel deployment

Use this folder as the root of its own repository and Vercel project.
Vercel installs with `npm ci`, builds with `npm run build`, and serves `dist`.
Use Node.js 22.12 or later. The app requires no environment variables.
The Windows batch launcher and local preview server are local tools and are
excluded from Git.
