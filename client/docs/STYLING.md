# Design System & Styling Guide

Complete design system documentation for Life Admin App frontend.

## Overview

**Approach:** Utility-first CSS with TailwindCSS + shadcn/ui component library

**Philosophy:**
- Consistent visual language across the app
- Responsive mobile-first design
- Accessible color contrasts (WCAG AA)
- Fast development without custom CSS

## Color Palette

### Brand Colors

All colors use OKLCH color space for better perceptual uniformity.

#### Primary Blue
- **Value:** `oklch(0.55 0.22 250)`
- **RGB:** `#4f46e5` (approximate)
- **Use:** Primary actions, links, active states
- **Example:** Submit button, active navigation item

#### Accent Teal
- **Value:** `oklch(0.60 0.15 190)`
- **RGB:** `#14b8a6` (approximate)
- **Use:** Highlights, success states, secondary actions
- **Example:** Badge backgrounds, accent borders

#### Success Green
- **Value:** `oklch(0.65 0.18 145)`
- **RGB:** `#22c55e` (approximate)
- **Use:** Confirmations, success messages
- **Example:** Success alerts, checkmarks

#### Warning Orange
- **Value:** `oklch(0.70 0.20 70)`
- **RGB:** `#f97316` (approximate)
- **Use:** Renewals, attention-needed states
- **Example:** "Renewing soon" badges, warning alerts

#### Destructive Red
- **Value:** `oklch(0.58 0.24 27)`
- **RGB:** `#ef4444` (approximate)
- **Use:** Delete actions, errors, dangerous operations
- **Example:** Delete button, error messages

### Neutral Colors

**Text:**
- Dark: `#1f2937` (gray-800)
- Medium: `#6b7280` (gray-500)
- Light: `#d1d5db` (gray-300)

**Backgrounds:**
- White: `#ffffff`
- Light gray: `#f9fafb` (gray-50)
- Medium gray: `#f3f4f6` (gray-100)
- Dark: `#111827` (gray-900)

### Color Combinations (Accessible)

| Use Case | Background | Text | Accent |
|----------|-----------|------|--------|
| Primary button | Primary Blue | White | - |
| Secondary button | Light gray | Primary Blue | - |
| Success alert | Light Green | Dark green text | Green checkmark |
| Warning alert | Light Orange | Dark orange text | Orange icon |
| Error alert | Light Red | Dark red text | Red X icon |
| Card | White | Gray-900 | Primary Blue border |

## Typography

### Font

**Font Family:** Inter

**Available weights:**
- 400 - Regular (body text)
- 500 - Medium (labels, small headings)
- 600 - Semibold (subheadings, strong text)
- 700 - Bold (headings)

### Font Sizes & Usage

| Element | Size | Weight | Line Height | Use |
|---------|------|--------|-------------|-----|
| **H1** | 2.25rem (36px) | 700 | 2.5rem (40px) | Page titles |
| **H2** | 1.875rem (30px) | 700 | 2.25rem (36px) | Section headers |
| **H3** | 1.5rem (24px) | 600 | 1.875rem (30px) | Subsection headers |
| **Body** | 1rem (16px) | 400 | 1.5rem (24px) | Paragraphs, UI text |
| **Small** | 0.875rem (14px) | 400 | 1.25rem (20px) | Secondary text, captions |
| **Label** | 0.875rem (14px) | 500 | 1rem (16px) | Form labels, badges |
| **Code** | 0.875rem (14px) | 400 | 1.25rem (20px) | Code blocks (monospace) |

### Line Heights

- Headings: 1.1 (tight for visual hierarchy)
- Body text: 1.5 (comfortable reading)
- Code: 1.5 (easier to scan)

### Letter Spacing

- Normal: 0 (default)
- Headings: -0.02em (slightly tighter)
- Buttons: 0.025em (slightly looser for readability)

## Responsive Design

### Breakpoints (TailwindCSS)

**Mobile-first approach:** Start with mobile styles, add complexity at larger screens

| Breakpoint | Width | Use |
|-----------|-------|-----|
| (none) | <640px | Mobile |
| `sm` | ≥640px | Small tablets |
| `md` | ≥768px | Tablets & large phones |
| `lg` | ≥1024px | Small desktops |
| `xl` | ≥1280px | Desktops |
| `2xl` | ≥1536px | Large desktops |

### Responsive Patterns

#### Single Column to Multi-Column Grid

```html
<!-- Mobile: 1 column, Tablet: 2 cols, Desktop: 3 cols -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <Card />
  <Card />
  <Card />
</div>
```

#### Hidden/Visible by Breakpoint

```html
<!-- Hidden on mobile, visible on desktop -->
<nav class="hidden md:flex">Desktop Navigation</nav>

<!-- Visible on mobile, hidden on desktop -->
<nav class="md:hidden">Mobile Navigation</nav>
```

#### Responsive Text Sizes

```html
<!-- Mobile: 1.5rem, Tablet: 1.875rem, Desktop: 2.25rem -->
<h1 class="text-2xl md:text-3xl lg:text-4xl">
  Responsive Heading
</h1>
```

#### Responsive Padding/Margins

```html
<!-- Mobile: 1rem, Tablet: 1.5rem, Desktop: 2rem -->
<div class="p-4 md:p-6 lg:p-8">Content</div>
```

## Component Styles

### Cards

Used for grouping related content.

```typescript
<Card className="bg-white rounded-lg shadow-md p-6">
  <CardHeader className="mb-4">
    <CardTitle>Card Title</CardTitle>
  </CardHeader>
  <CardContent>
    Card content here
  </CardContent>
</Card>
```

**Styles:**
- Background: White
- Border radius: 0.5rem (8px)
- Shadow: Light (md level)
- Padding: 1.5rem (24px)
- Border: 1px solid gray-200 (optional)

### Buttons

#### Primary Button

```html
<button class="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors">
  Primary Button
</button>
```

**Styles:**
- Background: Primary Blue
- Text: White, semibold
- Padding: 0.5rem 1rem (8px 16px)
- Border radius: 0.375rem (6px)
- Hover: Darker blue
- Disabled: Gray-400, not interactive

#### Secondary Button

```html
<button class="border-2 border-blue-500 text-blue-500 px-4 py-2 rounded-md hover:bg-blue-50 transition-colors">
  Secondary Button
</button>
```

**Styles:**
- Border: 2px solid Primary Blue
- Text: Primary Blue, semibold
- Background: Transparent
- Hover: Light blue background
- Disabled: Gray border & text

#### Ghost Button

```html
<button class="text-gray-700 px-4 py-2 rounded-md hover:bg-gray-100 transition-colors">
  Ghost Button
</button>
```

**Styles:**
- Background: Transparent
- Text: Gray-700
- Hover: Light gray background
- Use: Tertiary actions, less emphasis

#### Destructive Button

```html
<button class="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors">
  Delete
</button>
```

**Styles:**
- Background: Destructive Red
- Text: White
- Hover: Darker red
- Use: Dangerous operations (delete, reset)

### Forms

#### Text Input

```html
<input
  type="text"
  class="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:border-blue-500 focus:outline-none"
  placeholder="Enter text"
/>
```

**Styles:**
- Border: 2px solid gray-300
- Focus border: Primary Blue
- Padding: 0.5rem 0.75rem
- Border radius: 0.375rem

#### Select/Dropdown

```html
<select class="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:border-blue-500">
  <option>Option 1</option>
  <option>Option 2</option>
</select>
```

**Styles:** Same as text input

#### Textarea

```html
<textarea class="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:border-blue-500 resize-none"></textarea>
```

**Styles:** Same as text input, allow resize-none

### Forms - Labels & Validation

```html
<div class="mb-4">
  <label class="block text-sm font-medium text-gray-700 mb-2">
    Email Address
  </label>
  <input type="email" class="w-full px-3 py-2 border-2 border-gray-300 rounded-md" />
  <p class="text-sm text-red-500 mt-1">Email is required</p>
</div>
```

**Styles:**
- Label: 0.875rem, medium weight, gray-700
- Error text: 0.875rem, Destructive Red
- Spacing: 0.5rem below label

### Badges

```html
<!-- Primary -->
<span class="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
  New
</span>

<!-- Success -->
<span class="inline-block bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
  Active
</span>

<!-- Warning -->
<span class="inline-block bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded">
  Renewing soon
</span>
```

**Styles:**
- Padding: 0.25rem 0.625rem (4px 10px)
- Border radius: 0.25rem (4px)
- Font size: 0.75rem (12px)
- Font weight: medium

### Tables

```html
<table class="w-full border-collapse">
  <thead class="bg-gray-50">
    <tr>
      <th class="px-4 py-2 text-left font-medium text-gray-700 border-b-2 border-gray-300">
        Column Header
      </th>
    </tr>
  </thead>
  <tbody>
    <tr class="hover:bg-gray-50 border-b border-gray-200">
      <td class="px-4 py-2">Cell content</td>
    </tr>
  </tbody>
</table>
```

**Styles:**
- Header: Gray-50 background, medium font
- Hover: Light gray background
- Borders: Subtle gray separators

### Alerts

#### Success Alert

```html
<div class="bg-green-50 border-l-4 border-green-500 p-4 rounded">
  <p class="text-green-800">Success message</p>
</div>
```

#### Error Alert

```html
<div class="bg-red-50 border-l-4 border-red-500 p-4 rounded">
  <p class="text-red-800">Error message</p>
</div>
```

#### Warning Alert

```html
<div class="bg-orange-50 border-l-4 border-orange-500 p-4 rounded">
  <p class="text-orange-800">Warning message</p>
</div>
```

**Styles:**
- Left border: 4px, matching color
- Background: Tinted 50 shade
- Text: Darker matching color
- Padding: 1rem

### Dialogs/Modals

```html
<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
  <div class="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
    <h2 class="text-xl font-bold mb-4">Dialog Title</h2>
    <p class="text-gray-700 mb-6">Dialog content here</p>
    <div class="flex gap-2 justify-end">
      <button class="px-4 py-2 text-gray-700 border-2 border-gray-300 rounded">Cancel</button>
      <button class="px-4 py-2 bg-blue-500 text-white rounded">Confirm</button>
    </div>
  </div>
</div>
```

**Styles:**
- Overlay: Black with 50% opacity
- Dialog: White background, shadow, rounded corners
- Max width: 32rem (512px)

## Spacing System

**Base unit:** 0.25rem (4px)

| Class | Value | Use |
|-------|-------|-----|
| `p-1` | 0.25rem | Tight spacing |
| `p-2` | 0.5rem | Small spacing |
| `p-4` | 1rem | Standard spacing |
| `p-6` | 1.5rem | Generous spacing |
| `p-8` | 2rem | Large spacing |

**Use spacing consistently:**
- Between sections: `gap-8`
- Between items: `gap-4`
- Inside components: `p-4` or `p-6`
- Between cards: `my-4`

## Shadows & Elevation

| Level | Class | Use |
|-------|-------|-----|
| None | `shadow-none` | Flat design |
| Small | `shadow-sm` | Subtle elevation |
| Medium | `shadow-md` | Cards, dropdowns |
| Large | `shadow-lg` | Modals, popovers |
| Extra Large | `shadow-xl` | Floating panels |

## Animation & Transitions

### Hover Effects

```html
<!-- Smooth color transition -->
<button class="bg-blue-500 hover:bg-blue-600 transition-colors">
  Hover me
</button>

<!-- Smooth all property changes -->
<div class="hover:shadow-lg transition-all duration-200">
  Hover me
</div>
```

**Transition times:**
- Fast: 150ms (quick feedback)
- Standard: 200ms (default)
- Slow: 300ms (important transitions)

### Transform Effects

```html
<!-- Scale on hover -->
<button class="hover:scale-105 transition-transform">
  Scale
</button>

<!-- Translate on hover -->
<div class="hover:-translate-y-1 transition-transform">
  Move up
</div>
```

## Accessibility

### Color Contrast

All text must meet WCAG AA standards (4.5:1 ratio for normal text).

**Examples:**
- ✅ Dark text on white: 12:1 (excellent)
- ✅ Dark text on light gray: 8:1 (excellent)
- ✅ Primary blue text on white: 4.5:1 (minimum for normal text)
- ❌ Light text on light background: 1:1 (not accessible)

### Focus States

```html
<!-- Clear focus indicator -->
<button class="focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
  Accessible button
</button>
```

**Styles:**
- Ring: 2px solid Primary Blue
- Ring offset: 2px white gap
- High contrast, easily visible

### Form Labels

```html
<!-- Always use labels with inputs -->
<label for="email">Email:</label>
<input id="email" type="email" />
```

**Rules:**
- Every input must have a `<label>`
- `for` attribute matches input `id`
- Visible labels (not placeholder-only)

## Dark Mode (Future)

When dark mode is implemented, use these styles:

```typescript
// Light mode
<div class="bg-white text-gray-900">Light</div>

// Dark mode
<div class="dark:bg-gray-900 dark:text-white">Both modes</div>
```

## Customization

### tailwind.config.ts

```typescript
export const config = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#ede9fe',
          500: '#4f46e5',
          600: '#4338ca',
        },
      },
      spacing: {
        '128': '32rem',
      },
    },
  },
}
```

### CSS Variables

For dynamic theming:

```css
:root {
  --color-primary: oklch(0.55 0.22 250);
  --color-primary-dark: oklch(0.48 0.23 250);
}
```

```html
<button style={{ backgroundColor: 'var(--color-primary)' }}>
  Themed
</button>
```

---

**Last Updated:** 2026-06-02  
**Target Audience:** Frontend Developers, Designers  
**Related Docs:** [COMPONENTS.md](COMPONENTS.md), [client/README.md](../../client/README.md)
