## Brand & Style
The design system embodies "Quiet Luxury" for professional environments, blending the authority of a traditional institution with the efficiency of modern enterprise software. The aesthetic targets high-end service industries, executive management, and artisanal manufacturing.

The style is a sophisticated mix of **Minimalism** and **Tactile/Skeuomorphic** elements. It avoids the clinical coldness of standard SaaS by utilizing a warm, organic palette and soft embossed edges that mimic high-quality stationery or leather-bound archives. The emotional response should be one of stability, exclusivity, and focused calm.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy on desktop (12 columns) and a **Fluid Grid** on mobile (4 columns). 

*   **Rhythm:** We utilize a 4px baseline grid. All padding and margins should be multiples of 8px to maintain a rhythmic, spacious feel.
*   **ERP Density:** While traditional ERPs are dense, this design system prioritizes whitespace. Data rows should have a minimum height of 48px to accommodate touch and provide visual breathing room.
*   **Responsive Reflow:** On mobile devices, complex data tables must transition into "Card-Stack" views. Sidebars collapse into a bottom-anchored "Gold" navigation bar or a full-screen espresso-toned overlay.

## Elevation & Depth
Depth is conveyed through **Tonal Layers** and **Soft Embossing** rather than high-elevation shadows.

*   **Surfaces:** The background Ivory (#F5EFE6) is the base. Elevated cards use a slightly lighter cream with a 1px Antique Gold (#C9A25D) hairline border at 30% opacity.
*   **Shadows:** Use "Warm Shadows"—soft, diffused blurs with a slight brown tint (#2B1D14 at 5-10% opacity) instead of neutral gray.
*   **Embossing:** Interactive elements like primary buttons or input fields use a subtle inner shadow on the top-left and a light highlight on the bottom-right to create a soft "pressed" or "raised" leather effect.

## Components
*   **Buttons:** Primary buttons are Espresso (#2B1D14) with Gold (#C9A25D) text. Secondary buttons are Ivory with a 1px Gold border. All buttons must maintain a 44px minimum height.
*   **Input Fields:** Use a subtle "inset" shadow to suggest depth. The background should be slightly darker than the page background to define the clickable area. Labels are always "Label-Caps" style.
*   **Cards:** The primary vehicle for data. Cards feature a 1px Gold hairline border and a very soft warm shadow.
*   **Chips/Badges:** Small, `rounded-lg` elements. Use Sage Green (#8FA383) for "Active" or "Complete" statuses, with text in the Primary Espresso color for legibility.
*   **Botanical Accents:** Subtle watermark-style botanical illustrations (e.g., olive branches or grain) can be used in the background of empty states or login screens at 5% opacity to reinforce the "Aurum" brand heritage.
*   **Data Tables:** Rows use alternating "Zebra" stripes of Ivory and a 2% darker cream. Headers are Espresso with Gold text to provide a clear anchor for the eye.