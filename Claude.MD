# FontBoard — Google Fonts Explorer & Collection Builder

A full-stack app where users browse and search Google Fonts, save favorites to personal collections, and add notes on where they'd use each font. Built with Next.js + Tailwind, Clerk for auth, Supabase for data, Google Fonts API for browsing.

## Core Loop

User searches/browses fonts → previews them with custom sample text → saves favorites to their account → organizes into collections with notes → views their saved fonts anytime.

## External API

**Google Fonts API** (free, requires API key)
- Endpoint: `https://www.googleapis.com/webfonts/v1/webfonts?key=API_KEY`
- Returns: list of all Google Fonts with family name, variants, category, subsets
- Fonts can be loaded for preview via `https://fonts.googleapis.com/css2?family=FONT_NAME`
- Filter by category: serif, sans-serif, display, handwriting, monospace
- Sort by: trending, popularity, date added, alphabetical

## Auth

**Clerk** handles all authentication:
- Sign up, log in, log out
- Pre-built components: `<SignIn />`, `<SignUp />`, `<UserButton />`
- Middleware protects routes that require auth
- Provides `userId` to scope all Supabase queries

## Database

**Supabase** (Postgres) with the following tables:

```sql
-- User's saved fonts
CREATE TABLE saved_fonts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,           -- from Clerk
  font_family TEXT NOT NULL,       -- e.g. "Inter", "Playfair Display"
  font_category TEXT,              -- serif, sans-serif, display, etc.
  note TEXT,                       -- user's note: "good for headings", "pair with Inter"
  collection TEXT DEFAULT 'default', -- which collection it belongs to
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User's collections
CREATE TABLE collections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,           -- from Clerk
  name TEXT NOT NULL,              -- e.g. "Portfolio Project", "Wedding Invite"
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security: users can only see/edit their own data
ALTER TABLE saved_fonts ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own saved fonts"
  ON saved_fonts FOR ALL
  USING (user_id = current_setting('request.jwt.claims')::json->>'sub');

CREATE POLICY "Users can manage their own collections"
  ON collections FOR ALL
  USING (user_id = current_setting('request.jwt.claims')::json->>'sub');
```

## Pages

### `/` — Home / Browse Fonts
- Search bar to filter fonts by name
- Category filter buttons: All, Serif, Sans-Serif, Display, Handwriting, Monospace
- Sort dropdown: Popular, Newest, Alphabetical
- Grid/list of font cards, each showing:
  - Font name rendered in that font
  - Category badge
  - Sample text preview (customizable — user can type their own preview text)
  - "Save" button (heart icon or bookmark)
- Custom preview text input at top: type anything and ALL font cards update to show that text
- No auth required to browse — saving requires sign in

### `/font/[family]` — Font Detail
- Large preview of the font at multiple sizes (h1, h2, body, caption)
- All available weights/styles displayed
- Full character set preview
- Font metadata: designer, category, subsets, variants
- Save button + add note + assign to collection
- If already saved: show existing note, allow edit

### `/library` — My Saved Fonts (auth required)
- All fonts the user has saved
- Filter by collection
- Each saved font shows: name (rendered in that font), note, collection tag, date saved
- Edit note, change collection, or remove
- Link to font detail page

### `/collections` — My Collections (auth required)
- List of user's collections with font count per collection
- Create new collection (name + optional description)
- Click collection to see all fonts in it
- Delete collection (fonts go back to "default")

## Shared Layout

- Top nav bar with: app title "FontBoard", Browse link, Library link (if signed in), Collections link (if signed in)
- Clerk UserButton in top right (shows sign in/up if not authenticated, avatar dropdown if authenticated)
- Clean, minimal layout with max-width container

## API Routes

### `GET /api/fonts`
- Proxies to Google Fonts API
- Returns formatted font list
- Handles search/filter/sort server-side to keep API key secure

### `POST /api/saved-fonts`
- Saves a font to user's Supabase record
- Requires auth (Clerk userId)
- Body: { fontFamily, fontCategory, note?, collection? }

### `GET /api/saved-fonts`
- Returns user's saved fonts from Supabase
- Requires auth

### `DELETE /api/saved-fonts/[id]`
- Removes a saved font
- Requires auth

### `POST /api/collections`
- Creates a new collection
- Requires auth

### `GET /api/collections`
- Returns user's collections
- Requires auth

## Style Direction

Minimal and typographic — let the fonts be the visual star. White or very light background, clean sans-serif UI type (Inter or system font), generous whitespace. Subtle borders and shadows. The app should feel like a professional design tool, not a toy. Think Google Fonts' own site but cleaner and more personal.

Accent color: a single muted blue or indigo for interactive elements.

## Tech Stack

- Next.js (App Router)
- Tailwind CSS
- Clerk (auth)
- Supabase (database)
- Google Fonts API (external data)
- Deployed to Vercel

## Environment Variables

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_FONTS_API_KEY=
```

## Build Order

1. Scaffold Next.js + Tailwind
2. Set up Supabase project, configure MCP, create tables
3. Set up Clerk, add auth components, protect routes
4. Connect Clerk + Supabase
5. Build browse page with Google Fonts API
6. Build font detail page
7. Build save functionality (Supabase writes)
8. Build library page (Supabase reads)
9. Build collections
10. Polish and deploy
