---
title: "MyRideSG and the shoebox of receipts that set the price"
description: "The MyRideSG story: keeping a Singapore rider's service history out of a shoebox and a workshop's regulars from resetting to zero."
project: MyRideSG
role: "Founding engineer (partners app and website)"
stack: [Astro, TypeScript, Tailwind CSS, Sanity, Next.js, React, Supabase]
publishedAt: 2026-10-28
live: https://myridesg.com
draft: false
---

## Paperwork is the second bike

Somewhere in Singapore a rider is selling a bike, and the buyer squints at a blurry WhatsApp photo of a carbon-copy receipt, trying to make out a date. That photo is the entire service history, and it is why the price is about to drop.

Owning one here means running a small admin office alongside it. The Certificate of Entitlement runs on a five or ten year clock. Road tax renews every year. Insurance has its own renewal date. The bike wants oil, tyres and brake pads on intervals that live in somebody's head, usually a workshop's. The records that prove any of this happened sit in a shoebox of paper invoices and in a WhatsApp chat as photos. What rides on that shoebox is real money: a provable history moves the resale price, a renewal that slips costs more than the renewal, and running costs nobody adds up stay invisible.

Workshops carry their half of the same problem. A good shop knows its regulars, but the relationship lives on a paper loyalty card behind the counter. The card gets lost, the stamp count resets to zero, and the shop starts over with a rider it had already won.

MyRideSG is a motorcycle ownership app for Singapore riders: service history, fuel logs, running costs, and countdowns for COE, road tax and insurance. For a rider that means selling with proof instead of photos, renewals that announce themselves, and an honest number for what the bike costs to run. On the shop side, the team is building a partners app so workshops can run loyalty and prepaid packages without paper, and keep the regulars they already earned. This is the story of my half of that work.

## What I own

MyRideSG has a small founding team. I own two things end to end: the marketing website at myridesg.com, and the partners app, the tool partner workshops will use.

The rider mobile app is not mine. My partner leads it, and my partner built most of the shared backend it runs on: the monorepo structure, the Supabase schema, the ledgers and triggers underneath the product. I read that code often enough to say it plainly: it is the best made part of MyRideSG, and the rider app's pace is built on it. I stay close to that work with product input, feedback and code review.

The website and the partners app are mine in the full sense: I decide the scope, build them, deploy them, and live with the consequences. The partners app builds on the shared monorepo and the Supabase project the team runs, so some of what follows is me building on the team's foundations rather than pouring my own.

## How the team works

Three habits hold the place together.

Interviews before code. The workshops that already pledged to partner get interviewed before we write the tool they asked for. What makes the first version comes out of those conversations, and anything nobody asked for waits. The scope stays deliberately small: a tool that fits how a counter already works, not a platform a shop has to grow into.

Specs before migrations. No database migration gets written until a design spec is signed off. Packages, staff accounts and analytics are specs waiting in that queue right now.

One owner per surface, reviews across. My partner owns the rider app, I own the website and the partners app, and all of it gets read by more than its owner. One owner keeps decisions fast; reviews across keep the quality even.

## The website

The website started in August 2026 as a blank Astro project. Today it is a fully static site that markets the app and hosts the SEO content: feature pages aimed at people looking for the app, guides for people researching a problem, a COE calculator, and an FAQ that doubles as structured data.

### No runtime, no islands

Two decisions shape everything. First, every page prerenders and nothing fetches while the site is serving, so data is pulled at build time or not at all. Second, there is no React on the site. React was installed early on, and the integration was emitting about 190 KB of client runtime into the build that no page referenced. It came out within days. Accordions and the mobile menu are `<details>` elements, the theme toggle is a dozen lines of inline script, and the phone mockups are rendered markup instead of image captures. The site ships browser JavaScript only where a browser genuinely needs it, which at the moment is almost nowhere.

### Content workflow

Guides live in Sanity. At build time the site pulls them through the Sanity client and renders Portable Text to HTML. Nothing talks to Sanity from the browser, so a CMS outage cannot take the site down. The build is deliberate about failure modes: with no credentials set it succeeds and renders an empty guides index, so a fresh clone or a preview deploy works without credentials, and with an invalid token it fails hard, so a broken credential cannot publish an empty section while looking green.

Everything else that smells like content, bike data, FAQ items, store links, is typed TypeScript in the repo. A typo fails the type check instead of shipping.

### SEO

Early on, an audit read every page of the site as an orphan sitting behind a critical redirect. Internal links had been written without trailing slashes while the canonical address of every page had one, so every crawl paid a redirect round trip and the canonical URL itself had no inbound links. I fixed the links, generated redirects for the old address shapes, and made the dev server refuse the slashless form so it cannot regress quietly.

Structured data is one connected JSON-LD graph per page: the organisation, the website, the app as a MobileApplication, then each page as a WebPage pointing back at the website with its breadcrumbs and FAQ. Shared helpers build those entities so a page cannot define its own app or attach an invented rating. There are no ratings in the schema on purpose: without real aggregate review data Google will not show the rich result anyway, and inventing reviews is false advertising. A validator script walks the built HTML and rejects unresolved references, wrong types and duplicated blocks before anything ships.

Titles and descriptions are budgeted in bytes rather than characters, because bytes are what search engines actually truncate on. The sitemap carries lastmod on every entry, and feature pages and guides stay on separate search intents so the two do not compete for the same keyword.

### Performance and headers

All stylesheets are inlined into the documents that use them, which removes the render-blocking fetch and fits the content security policy: Astro hashes every inline script and style into a per-page meta policy, so the site has no external script files at all. Images go through astro:assets and ship as WebP, and the few fonts used above the fold are preloaded so the hero does not shift when they swap in. HSTS and frame-ancestors live in a headers file, since a meta CSP cannot carry them.

### Deploy

The site builds to plain files and serves from anywhere. It is hosted on both Netlify and Cloudflare right now, the same repo shipping to Netlify and to Cloudflare Workers as static assets behind a minimal wrangler config. The DNS swap to Cloudflare is pending; once it lands, Netlify comes down. A Dockerfile gives testers a container preview. Static output keeps the risky part of a release in the build, and the build fails loudly.

The lesson I keep relearning from this site is that constraints compound. Static output forced build-time data, build-time data forced a CMS decision, the CMS decision shaped the failure modes, and the CSP shaped how every script gets written.

## The partners app

The partners app is the shop-facing half of MyRideSG: loyalty cards and prepaid service packages a workshop can run from a phone at the counter. It is being built right now, and the build order is unusual on purpose.

### Extend the workshop, don't replace it

One principle came out of those shop interviews early: the app should extend a workshop's existing software, not replace it. A workshop already has a system for jobs, invoices and customers. The partners app sits next to that system and covers what it does not, loyalty and prepaid packages. Nothing in the design asks a shop to migrate anything.

### An event log, not a balance

The core model decision I made: a loyalty card is not a stored balance. Every touch is an event, appended and never edited. A rider joins the programme, staff give a chop, a reward gets redeemed, and when something goes wrong the fix is a void event that points at the event it cancels. Deletes do not exist; mistakes get voided instead. The card a rider sees is computed from that log, so a voided chop un-happens everywhere at once, and the same arithmetic can be mirrored in SQL.

Prepaid service packages follow the same pattern with the counting reversed: a card counts up toward a reward, a package counts down toward nothing. Same shape, opposite direction, one pattern to reason about instead of two. The packages spec gives them their own tables and freezes the validity window and terms at purchase time.

### What exists and what is ahead

An earlier loyalty counter flow exists in the code today: staff tap a button to give a chop, and the rider scans a short-lived QR at the counter to make it official. It proved the interaction feels right on a phone at a counter, and the interviews are reshaping everything around it. There is no launch date in this write-up because there is not one yet.

## The rider app, from the outside

I do not build the rider app. My partner leads it, and it is in better hands for it. Most of what a rider touches, the app and the backend underneath it, is my partner's work. What I do is stay close enough to be useful: product input while a feature takes shape, feedback on builds, and code review. Owning the shop side gives me a specific seat for this, since I can review how a rider feature lands at a partner counter before it ships.

## What's next

The partners app keeps taking shape out of the shop interviews. The website keeps earning its keep as the front door, with more feature pages and guides and the structured data to match. Past that, the honest answer is whatever the next round of shop conversations says it is.
