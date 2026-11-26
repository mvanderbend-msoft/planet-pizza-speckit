---
applyTo: "frontend/**/*.{ts,tsx}"
description: Frontend (React + Vite + TS) conventions
---

# Frontend instructions

## Structure

```
src/
  api/          Typed fetch client + formatPrice. One module: client.ts
  components/   Reusable presentational components (Layout, ProductCard)
  context/      React Context providers (CartContext)
  pages/        Route components — one file per route
  App.tsx       Route table only
  main.tsx      Providers (BrowserRouter, CartProvider) + render
```

Add new routes by creating a file in `pages/` and registering it in `App.tsx`
inside the `<Layout />` route — never at the root.

## Data fetching

- Use the typed `api` helper from `src/api/client.ts`. Do not call `fetch`
  directly from components or use axios / react-query / swr.
- Pattern inside components: `useState` + `useEffect` for the request,
  separate loading and error states, narrow the response type at the call site.
- Money is always `*_cents` (number) from the API. Render with `formatPrice`.

## State

- Cart state is global via `CartContext` (`useCart()` hook). Persisted to
  `localStorage` under the key in that file. Don't duplicate cart state elsewhere.
- Local UI state goes in `useState` inside the component. Don't reach for Redux,
  Zustand, Jotai, etc.

## Routing

- React Router v6 only — `<Routes>`, `<Route>`, `<Outlet>`, `useNavigate`,
  `useParams`. No `<Switch>`, no data-router `createBrowserRouter` (yet).
- Use `<Navigate replace />` for redirects, e.g. cart-empty guard on checkout.

## Images

- Product images live in `frontend/public/images/` as SVG.
- Always include an `onError` fallback to `/images/placeholder.svg` on `<img>`
  tags that render `product.image_url`.
- See `.github/instructions/svg-assets.instructions.md` for SVG conventions.

## Types

- Mirror API responses in `src/api/client.ts` with `snake_case` properties.
  Do not invent camelCase aliases.
- Prefer `type` over `interface` for object shapes (existing convention).

## What not to do

- Don't add CSS Modules, styled-components, emotion, or inline `style=` props.
  Tailwind only.
- Don't fetch on the server / add SSR / migrate to Next.js.
- Don't add a test framework.
- Don't add icon libraries — we use emoji + inline SVG.
