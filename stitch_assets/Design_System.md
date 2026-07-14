# Design System: Organic Core ERP

## Style Guidelines

## Brand & Style
The design system is engineered for efficiency and trust, tailored for an organic-products enterprise. It merges the grounded, tactile nature of organic business with the high-performance precision of modern SaaS platforms like Linear or Notion. 

The brand personality is **Earthy, Professional, and Clean**. It avoids the clinical coldness of traditional enterprise software by using a warm primary accent, while maintaining a rigorous, systematic layout to handle complex supply chain and inventory data. The visual style follows a **Corporate / Modern** aesthetic with subtle **Minimalist** influences—relying on generous whitespace, crisp typography, and a clear functional hierarchy.

## Layout & Spacing
The layout uses a **fixed-fluid hybrid grid**. 

- **Navigation:** A fixed-width left sidebar (240px) in near-black navy.
- **Main Canvas:** A fluid content area with a maximum width of 1600px for desktop to prevent line lengths from becoming unreadable on ultra-wide monitors.
- **Density:** This design system utilizes a 4px baseline grid. For ERP screens, use "Compact" spacing (8px) between related input fields and "Wide" spacing (24px) between distinct card sections.
- **Breakpoints:**
  - Mobile (<768px): Sidebar collapses to a drawer; 16px horizontal margins.
  - Tablet (768px - 1024px): 24px margins; 2-column card layouts.
  - Desktop (>1024px): 32px margins; multi-column dashboard widgets.

## Elevation & Depth
Depth is communicated through **Tonal Layers** and **Soft Ambient Shadows** rather than heavy borders.

- **Level 0 (Background):** Light Slate (#f1f5f9) - The foundation.
- **Level 1 (Cards/Surface):** Pure White (#ffffff) - Used for the primary content containers. Features a 1px border (#e2e8f0) and a very soft shadow: `0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)`.
- **Level 2 (Dropdowns/Modals):** Floating elements that require higher focus. They use a more pronounced shadow to lift them off the Level 1 surface.
- **Interactive States:** On hover, cards may subtly lift or darken their border color to provide tactile feedback.

## Components
- **Buttons:** Primary buttons use the Deep Brown (#5a2d0c) with white text. Secondary buttons use a transparent background with a Slate-200 border.
- **Inputs:** High-density fields with a 1px Slate-300 border that shifts to Deep Brown on focus. Labels are `label-md` (uppercase) positioned strictly above the field.
- **Data Tables:** The workhorse of the system.
  - Header: Light Slate background, bold `body-sm` text.
  - Rows: 48px height, subtle 1px bottom border. 
  - Alternating "Zebra" striping is avoided in favor of hover-state highlighting.
- **Status Badges:** Small, pill-shaped components using 10% opacity of the status color for the background and 100% opacity for the text (e.g., Success: #22c55e at 10% bg).
- **Cards:** White background, 10px rounded corners, used to group related metrics or form sections.
- **Breadcrumbs:** Used extensively at the top of the Page Background level to ensure the user never loses their place in deep nesting (e.g., Inventory > Raw Materials > Organic Wheat).

## Theme Configuration

```json
{
  "colorMode": "LIGHT",
  "font": "HANKEN_GROTESK",
  "roundness": "ROUND_EIGHT",
  "customColor": "#5a2d0c",
  "headlineFont": "HANKEN_GROTESK",
  "bodyFont": "INTER",
  "labelFont": "JETBRAINS_MONO",
  "namedColors": {
    "background": "#fff8f5",
    "error": "#ba1a1a",
    "error_container": "#ffdad6",
    "inverse_on_surface": "#fbeee9",
    "inverse_primary": "#feb78b",
    "inverse_surface": "#362f2c",
    "on_background": "#201a17",
    "on_error": "#ffffff",
    "on_error_container": "#93000a",
    "on_primary": "#ffffff",
    "on_primary_container": "#d6946b",
    "on_primary_fixed": "#321300",
    "on_primary_fixed_variant": "#6b3a19",
    "on_secondary": "#ffffff",
    "on_secondary_container": "#5c647a",
    "on_secondary_fixed": "#131b2e",
    "on_secondary_fixed_variant": "#3f465c",
    "on_surface": "#201a17",
    "on_surface_variant": "#52443c",
    "on_tertiary": "#ffffff",
    "on_tertiary_container": "#7aa9c4",
    "on_tertiary_fixed": "#001e2c",
    "on_tertiary_fixed_variant": "#174c63",
    "outline": "#84746b",
    "outline_variant": "#d7c3b8",
    "primary": "#3e1900",
    "primary_container": "#5a2d0c",
    "primary_fixed": "#ffdbc8",
    "primary_fixed_dim": "#feb78b",
    "secondary": "#565e74",
    "secondary_container": "#dae2fd",
    "secondary_fixed": "#dae2fd",
    "secondary_fixed_dim": "#bec6e0",
    "surface": "#fff8f5",
    "surface_bright": "#fff8f5",
    "surface_container": "#f8ebe6",
    "surface_container_high": "#f2e6e0",
    "surface_container_highest": "#ece0db",
    "surface_container_low": "#fef1ec",
    "surface_container_lowest": "#ffffff",
    "surface_dim": "#e4d8d2",
    "surface_tint": "#87512e",
    "surface_variant": "#ece0db",
    "tertiary": "#002737",
    "tertiary_container": "#003e55",
    "tertiary_fixed": "#c3e8ff",
    "tertiary_fixed_dim": "#9ecde9"
  },
  "designMd": "---\nname: Organic Core ERP\ncolors:\n  surface: '#fff8f5'\n  surface-dim: '#e4d8d2'\n  surface-bright: '#fff8f5'\n  surface-container-lowest: '#ffffff'\n  surface-container-low: '#fef1ec'\n  surface-container: '#f8ebe6'\n  surface-container-high: '#f2e6e0'\n  surface-container-highest: '#ece0db'\n  on-surface: '#201a17'\n  on-surface-variant: '#52443c'\n  inverse-surface: '#362f2c'\n  inverse-on-surface: '#fbeee9'\n  outline: '#84746b'\n  outline-variant: '#d7c3b8'\n  surface-tint: '#87512e'\n  primary: '#3e1900'\n  on-primary: '#ffffff'\n  primary-container: '#5a2d0c'\n  on-primary-container: '#d6946b'\n  inverse-primary: '#feb78b'\n  secondary: '#565e74'\n  on-secondary: '#ffffff'\n  secondary-container: '#dae2fd'\n  on-secondary-container: '#5c647a'\n  tertiary: '#002737'\n  on-tertiary: '#ffffff'\n  tertiary-container: '#003e55'\n  on-tertiary-container: '#7aa9c4'\n  error: '#ba1a1a'\n  on-error: '#ffffff'\n  error-container: '#ffdad6'\n  on-error-container: '#93000a'\n  primary-fixed: '#ffdbc8'\n  primary-fixed-dim: '#feb78b'\n  on-primary-fixed: '#321300'\n  on-primary-fixed-variant: '#6b3a19'\n  secondary-fixed: '#dae2fd'\n  secondary-fixed-dim: '#bec6e0'\n  on-secondary-fixed: '#131b2e'\n  on-secondary-fixed-variant: '#3f465c'\n  tertiary-fixed: '#c3e8ff'\n  tertiary-fixed-dim: '#9ecde9'\n  on-tertiary-fixed: '#001e2c'\n  on-tertiary-fixed-variant: '#174c63'\n  background: '#fff8f5'\n  on-background: '#201a17'\n  surface-variant: '#ece0db'\ntypography:\n  display-lg:\n    fontFamily: Hanken Grotesk\n    fontSize: 32px\n    fontWeight: '700'\n    lineHeight: 40px\n    letterSpacing: -0.02em\n  headline-md:\n    fontFamily: Hanken Grotesk\n    fontSize: 24px\n    fontWeight: '600'\n    lineHeight: 32px\n    letterSpacing: -0.01em\n  headline-sm:\n    fontFamily: Hanken Grotesk\n    fontSize: 18px\n    fontWeight: '600'\n    lineHeight: 24px\n  body-lg:\n    fontFamily: Inter\n    fontSize: 16px\n    fontWeight: '400'\n    lineHeight: 24px\n  body-md:\n    fontFamily: Inter\n    fontSize: 14px\n    fontWeight: '400'\n    lineHeight: 20px\n  body-sm:\n    fontFamily: Inter\n    fontSize: 13px\n    fontWeight: '400'\n    lineHeight: 18px\n  label-md:\n    fontFamily: Inter\n    fontSize: 12px\n    fontWeight: '600'\n    lineHeight: 16px\n    letterSpacing: 0.05em\n  data-mono:\n    fontFamily: JetBrains Mono\n    fontSize: 13px\n    fontWeight: '400'\n    lineHeight: 16px\nrounded:\n  sm: 0.25rem\n  DEFAULT: 0.5rem\n  md: 0.75rem\n  lg: 1rem\n  xl: 1.5rem\n  full: 9999px\nspacing:\n  base: 4px\n  xs: 4px\n  sm: 8px\n  md: 16px\n  lg: 24px\n  xl: 32px\n  container-margin: 32px\n  gutter: 16px\n---\n\n## Brand & Style\nThe design system is engineered for efficiency and trust, tailored for an organic-products enterprise. It merges the grounded, tactile nature of organic business with the high-performance precision of modern SaaS platforms like Linear or Notion. \n\nThe brand personality is **Earthy, Professional, and Clean**. It avoids the clinical coldness of traditional enterprise software by using a warm primary accent, while maintaining a rigorous, systematic layout to handle complex supply chain and inventory data. The visual style follows a **Corporate / Modern** aesthetic with subtle **Minimalist** influences—relying on generous whitespace, crisp typography, and a clear functional hierarchy.\n\n## Colors\nThe palette is rooted in nature but optimized for screen-based productivity. \n\n- **Primary Accent:** A deep, rich brown (#5a2d0c) represents the \"organic\" core. It is used sparingly for primary actions, active states, and brand moments to ensure it doesn't overwhelm the data.\n- **Structural Neutral:** Near-black navy (#0f172a) provides a solid architectural foundation, used primarily for the sidebar and high-level navigation to create a clear \"frame\" for the application.\n- **Surface & Background:** A light slate (#f1f5f9) page background reduces eye strain compared to pure white, while white cards provide a crisp contrast for data entry.\n- **Semantic Logic:** Status colors are vibrant and industry-standard to ensure immediate recognition of inventory levels, shipment statuses, and financial alerts.\n\n## Typography\nTypography is optimized for a **data-dense ERP environment**. \n\n- **Headlines:** Uses **Hanken Grotesk** for a sharp, contemporary look that feels premium and engineered.\n- **Body & UI:** Uses **Inter** for its exceptional legibility at small sizes and high x-height, essential for complex tables and forms.\n- **Data Display:** **JetBrains Mono** is introduced for SKU numbers, quantities, and financial figures to ensure character alignment and high scannability in dense grids.\n- **Hierarchy:** Use `body-sm` (13px) as the default for table content to maximize information density without sacrificing readability.\n\n## Layout & Spacing\nThe layout uses a **fixed-fluid hybrid grid**. \n\n- **Navigation:** A fixed-width left sidebar (240px) in near-black navy.\n- **Main Canvas:** A fluid content area with a maximum width of 1600px for desktop to prevent line lengths from becoming unreadable on ultra-wide monitors.\n- **Density:** This design system utilizes a 4px baseline grid. For ERP screens, use \"Compact\" spacing (8px) between related input fields and \"Wide\" spacing (24px) between distinct card sections.\n- **Breakpoints:**\n  - Mobile (<768px): Sidebar collapses to a drawer; 16px horizontal margins.\n  - Tablet (768px - 1024px): 24px margins; 2-column card layouts.\n  - Desktop (>1024px): 32px margins; multi-column dashboard widgets.\n\n## Elevation & Depth\nDepth is communicated through **Tonal Layers** and **Soft Ambient Shadows** rather than heavy borders.\n\n- **Level 0 (Background):** Light Slate (#f1f5f9) - The foundation.\n- **Level 1 (Cards/Surface):** Pure White (#ffffff) - Used for the primary content containers. Features a 1px border (#e2e8f0) and a very soft shadow: `0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)`.\n- **Level 2 (Dropdowns/Modals):** Floating elements that require higher focus. They use a more pronounced shadow to lift them off the Level 1 surface.\n- **Interactive States:** On hover, cards may subtly lift or darken their border color to provide tactile feedback.\n\n## Shapes\nThe shape language is **Refined and Consistent**. \n\n- **Cards & Containers:** Fixed at 10px (custom `rounded-lg`) to strike a balance between the organic \"softness\" of the brand and the \"structural\" nature of an ERP.\n- **Buttons & Inputs:** Use a 6px radius to appear precise and clickable.\n- **Status Pills:** Use a full \"Pill\" radius (999px) to distinguish them clearly from interactive buttons or static cards.\n\n## Components\n- **Buttons:** Primary buttons use the Deep Brown (#5a2d0c) with white text. Secondary buttons use a transparent background with a Slate-200 border.\n- **Inputs:** High-density fields with a 1px Slate-300 border that shifts to Deep Brown on focus. Labels are `label-md` (uppercase) positioned strictly above the field.\n- **Data Tables:** The workhorse of the system.\n  - Header: Light Slate background, bold `body-sm` text.\n  - Rows: 48px height, subtle 1px bottom border. \n  - Alternating \"Zebra\" striping is avoided in favor of hover-state highlighting.\n- **Status Badges:** Small, pill-shaped components using 10% opacity of the status color for the background and 100% opacity for the text (e.g., Success: #22c55e at 10% bg).\n- **Cards:** White background, 10px rounded corners, used to group related metrics or form sections.\n- **Breadcrumbs:** Used extensively at the top of the Page Background level to ensure the user never loses their place in deep nesting (e.g., Inventory > Raw Materials > Organic Wheat).",
  "colorVariant": "FIDELITY",
  "overridePrimaryColor": "#5a2d0c",
  "overrideSecondaryColor": "#0f172a",
  "spacingScale": 2,
  "typography": {
    "body-lg": {
      "fontFamily": "Inter",
      "fontSize": "16px",
      "fontWeight": "400",
      "lineHeight": "24px"
    },
    "body-md": {
      "fontFamily": "Inter",
      "fontSize": "14px",
      "fontWeight": "400",
      "lineHeight": "20px"
    },
    "body-sm": {
      "fontFamily": "Inter",
      "fontSize": "13px",
      "fontWeight": "400",
      "lineHeight": "18px"
    },
    "data-mono": {
      "fontFamily": "JetBrains Mono",
      "fontSize": "13px",
      "fontWeight": "400",
      "lineHeight": "16px"
    },
    "display-lg": {
      "fontFamily": "Hanken Grotesk",
      "fontSize": "32px",
      "fontWeight": "700",
      "lineHeight": "40px",
      "letterSpacing": "-0.02em"
    },
    "headline-md": {
      "fontFamily": "Hanken Grotesk",
      "fontSize": "24px",
      "fontWeight": "600",
      "lineHeight": "32px",
      "letterSpacing": "-0.01em"
    },
    "headline-sm": {
      "fontFamily": "Hanken Grotesk",
      "fontSize": "18px",
      "fontWeight": "600",
      "lineHeight": "24px"
    },
    "label-md": {
      "fontFamily": "Inter",
      "fontSize": "12px",
      "fontWeight": "600",
      "lineHeight": "16px",
      "letterSpacing": "0.05em"
    }
  },
  "spacing": {
    "base": "4px",
    "container-margin": "32px",
    "gutter": "16px",
    "lg": "24px",
    "md": "16px",
    "sm": "8px",
    "xl": "32px",
    "xs": "4px"
  },
  "headlineFontFamily": "Hanken Grotesk",
  "bodyFontFamily": "Inter",
  "labelFontFamily": "Jetbrains Mono"
}
```
