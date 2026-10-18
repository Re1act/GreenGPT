This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Copy `.env.local.example` to `.env.local` and fill in the URL and anon key for
your Supabase project. The database must have this repository's migrations and
ingested map data. Restart the development server after changing these values.
Without this configuration, the preview displays the base map with a notice;
facility markers and environmental overlays remain unavailable.

Location search works independently of Supabase. Select a country or territory
and enter a postal code, or switch to city search for places without postal codes.
It uses [Photon](https://github.com/komoot/photon) / OpenStreetMap; coverage is
not exhaustive. The public demo is for moderate traffic with no availability
guarantee. Searches run only on submission and successful results are cached for
24 hours (up to 500 entries per server process), with at most one upstream request
per second per process. Before scaling to multiple server instances or substantial
traffic, configure `PHOTON_SEARCH_URL` for your own Photon service and use shared
caching/rate limiting. No API key is needed for the local preview.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
