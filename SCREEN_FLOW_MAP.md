# Orbital Harmony - Screen Flow & Navigation Map

## APPLICATION ARCHITECTURE

```
┌─────────────────────────────────────────────────────────┐
│                    ORBITAL HARMONY                       │
│              (Main App Shell - App.jsx)                  │
│  • Starfield backdrop (wider viewports)                 │
│  • Screen routing via Zustand store (useAppStore)       │
│  • Lazy-loaded screen components with Suspense          │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │   LOADING SCREEN (Eagerly Loaded) │
        │   (LoadingScreen.jsx)             │
        │                                   │
        │  • "The cosmos is aligning..."    │
        │  • Moon graphic + starfield       │
        │  • Automatic transition           │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │   MODE SELECT SCREEN (Home)            │
        │   (ModeSelectScreen.jsx)              │
        │                                       │
        │   ┌─────────────────────────────────┐ │
        │   │  [Orbitograph] [Cosmic Sig]     │ │
        │   │   Create any 2     Generate     │ │
        │   │   planet pair      from birth   │ │
        │   └─────────────────────────────────┘ │
        │                                       │
        │  🏠 Home Navigation (BottomNav)      │
        └───────────────────────────────────────┘
              │                     │
              ▼ (Mode: orbitograph) ▼ (Mode: cosmic)
    ┌──────────────────┐  ┌──────────────────┐
    │ ORBITOGRAPH      │  │ COSMIC SIGNATURE │
    │ FLOW             │  │ FLOW             │
    └──────────────────┘  └──────────────────┘
            │                      │
            ▼                      ▼
    ┌──────────────────┐  ┌──────────────────┐
    │ PLANET SELECT    │  │ DATE SELECT      │
    │ (Pick 2 planets) │  │ (Birth date)     │
    │                  │  │                  │
    │ Mercury ⊙ Venus  │  │ [Calendar Picker]│
    │ Earth ⊙ Mars     │  │                  │
    │ Jupiter ⊙ Saturn │  │ Month: August ▼  │
    │ ...              │  │ Year:  2026 ▼    │
    │                  │  │                  │
    │ [Generate]       │  │ [Generate]       │
    └──────────────────┘  └──────────────────┘
            │                      │
            │ (Generate Pattern)   │
            │                      │
            └──────────┬───────────┘
                       │
                       ▼
        ┌───────────────────────────────────┐
        │  SIMULATION SCREEN                 │
        │  (SimulationScreen.jsx)           │
        │                                   │
        │  Title: "Mercury × Earth"   [ℹ]   │
        │  ┌─────────────────────────────┐  │
        │  │  3D Orbital Visualization   │  │
        │  │  • Sun at center            │  │
        │  │  • Planets in orbit         │  │
        │  │  • Pattern trails           │  │
        │  │  • Starfield background     │  │
        │  └─────────────────────────────┘  │
        │                                   │
        │  ┌─ SIMULATION SPEED ─────────┐  │
        │  │ ◄────●───────► 1.0×        │  │
        │  └─────────────────────────────┘  │
        │                                   │
        │  ┌─ PATTERN DETAIL ────────────┐  │
        │  │ ◄─────●────► 5             │  │
        │  │ 1 2 3 4 5 6 7 8 9 10       │  │
        │  └─────────────────────────────┘  │
        │                                   │
        │     [▶ Play]  [↶ Reset]          │
        │                                   │
        │  🏠 Home                          │
        └───────────────────────────────────┘
                       │
              (Back button OR Home nav)
                       │
                       ▼
        ┌───────────────────────────────────┐
        │   MODE SELECT SCREEN (Back Home)  │
        └───────────────────────────────────┘
```

---

## SCREEN DETAILS & INTERACTION PATTERNS

### 1. LOADING SCREEN
**File**: `src/screens/LoadingScreen.jsx`

**Purpose**: Initial app load, asset preloading

**Components**:
- Title: "orbital harmony" (orange color)
- Subtitle: "The cosmos is aligning..." (loading message)
- Background: Moon graphic + starfield

**Interaction**:
- Automatic transition to ModeSelectScreen after load complete
- No user interaction required
- Eagerly loaded (not lazy)

**Navigation**:
- → ModeSelectScreen (automatic)

---

### 2. MODE SELECT SCREEN
**File**: `src/screens/ModeSelectScreen.jsx`
**State**: `useAppStore(state => state.screen) === 'modeSelect'`

**Purpose**: Choose between Orbitograph and Cosmic Signature modes

**Components**:
- Header:
  - Title: "Orbital Harmony"
  - Subtitle: "Discover the hidden patterns of planetary motion."
- Background: 3D solar system visualization (SolarSystemCanvas)
- Two mode buttons:
  - Orbitograph: Create patterns from any 2 planets
  - Cosmic Signature: Generate from birthdate
- Bottom nav: Home icon (no-op, already home)

**Interaction**:
- Click Orbitograph → Set mode to 'orbitograph', navigate to PlanetSelectScreen
- Click Cosmic Signature → Set mode to 'cosmic', navigate to CosmicSignatureScreen

**Navigation**:
- Orbitograph button → PlanetSelectScreen
- Cosmic Signature button → CosmicSignatureScreen

---

### 3. PLANET SELECT SCREEN (Orbitograph)
**File**: `src/screens/PlanetSelectScreen.jsx`
**Condition**: `screen === 'planets' && patternMode === 'orbitograph'`

**Purpose**: Select two planets for orbitograph pattern

**Components**:
- Header:
  - Back button (← arrow)
  - Title: "ORBITOGRAPH"
  - Subtitle: "Choose two planets"
- Content:
  - Two swipe carousel components (PlanetSwipeRow)
  - First carousel: Mercury (default)
  - Second carousel: Earth (default)
  - Each shows 3D planet previews
  - Labels: "MERCURY", "EARTH" (orange text)
- Footer:
  - Home button (left)
  - Generate Pattern button (center, prominent)

**Interaction**:
- Swipe left/right in carousel → Change selected planet
- Tap planet preview → Select that planet
- Back button → Return to ModeSelectScreen
- Home button → Return to ModeSelectScreen
- Generate Pattern → Validate selections, navigate to SimulationScreen

**Navigation**:
- Back/Home → ModeSelectScreen
- Generate → SimulationScreen

---

### 4. COSMIC SIGNATURE DATE PICKER
**File**: `src/screens/CosmicSignatureScreen.jsx`
**Condition**: `screen === 'planets' && patternMode === 'cosmic'`

**Purpose**: Select birth date for cosmic signature pattern

**Components**:
- Header:
  - Back button (← arrow)
  - Title: "COSMIC SIGNATURE"
  - Subtitle: "Enter your birth details"
- Form:
  - Label: "DATE OF BIRTH"
  - Input: "Select your birth date" (text input with calendar icon)
- Calendar Picker:
  - Navigation: Previous month (<), Next month (>)
  - Month selector: "August" (dropdown)
  - Year selector: "2026" (dropdown)
  - Day grid: 7-day week layout
  - Selected date: Highlighted in calendar
  - Disabled dates: Grayed out
- Footer:
  - Home button (left)
  - Generate Pattern button (center, prominent)

**Interaction**:
- Click calendar input → Open date picker (if not already open)
- Click date in calendar → Select date
- Month dropdown → Change month
- Year dropdown → Change year
- Previous/Next arrows → Navigate months
- Back button → Return to ModeSelectScreen
- Home button → Return to ModeSelectScreen
- Generate Pattern → Validate date, navigate to SimulationScreen

**Navigation**:
- Back/Home → ModeSelectScreen
- Generate → SimulationScreen

---

### 5. SIMULATION SCREEN
**File**: `src/screens/SimulationScreen.jsx`
**Condition**: `screen === 'simulation'`

**Purpose**: Display 3D orbital pattern and allow user interaction

**Components**:
- Header:
  - Back button (← arrow) - returns to planet/date selection
  - Pattern name: "Mercury × Earth" OR "John Doe - Aug 15, 1990"
  - Info button (ℹ circle) - Purpose unclear (TO VERIFY)

- Canvas:
  - 3D Three.js canvas showing orbital simulation
  - Sun at center
  - Planets orbiting
  - Pattern trace/trail visible
  - Starfield background

- Controls Panel:
  - Simulation Speed slider:
    - Label: "SIMULATION SPEED"
    - Value display: "1.0×"
    - Range: 0.1× - 4.0× (estimated)
    - Orange slider handle for visibility
  
  - Pattern Detail slider:
    - Label: "PATTERN DETAIL"
    - Value display: "5"
    - Scale indicator: 1-10
    - Selected value highlighted
  
  - Playback buttons:
    - Play button (▶ icon, circular)
    - Reset button (↶ icon, circular)

- Footer:
  - Home button (left)

**Interaction**:
- Drag Simulation Speed slider → Change animation speed in real-time
- Drag Pattern Detail slider → Change pattern complexity/trace detail
- Click Play → Start/pause animation
- Click Reset → Reset pattern to beginning
- Back button → Return to planet/date selection
- Home button → Return to ModeSelectScreen
- Info button → ??? (TO IMPLEMENT - show pattern details panel)

**Navigation**:
- Back → PlanetSelectScreen OR CosmicSignatureScreen (based on mode)
- Home → ModeSelectScreen
- Info → ??? (Potential modal/panel)

---

### 6. RESULT SCREEN (If Exists)
**File**: `src/screens/ResultScreen.jsx`
**Status**: Listed in lazy imports but navigation flow unclear

**Purpose**: Show pattern results/stats (TO VERIFY)

**Navigation**:
- Access mechanism: Unknown (currently)
- From Simulation: Unclear
- Back destination: Unknown

---

### 7. PATTERN DETAILS SCREEN (If Exists)
**File**: `src/screens/PatternDetailsScreen.jsx`
**Status**: Listed in lazy imports but navigation flow unclear

**Purpose**: Show detailed pattern information (TO VERIFY)

**Navigation**:
- Access mechanism: Unknown (likely from Info button on Simulation)
- Expected: Info button → PatternDetailsScreen
- Back destination: SimulationScreen

---

### 8. KNOWLEDGE CARD SCREEN (If Exists)
**File**: `src/screens/KnowledgeCardScreen.jsx`
**Status**: Listed in lazy imports but navigation flow unclear

**Purpose**: Educational content (TO VERIFY)

**Navigation**:
- Access mechanism: Unknown (educational flow?)

---

## CONFIRMED NAVIGATION PATHS

### Path 1: ORBITOGRAPH (2-Planet Mode)
```
ModeSelectScreen
  ↓ (click Orbitograph)
PlanetSelectScreen
  ↓ (click Generate Pattern)
SimulationScreen
  ↓ (click Back or Home)
ModeSelectScreen
```

### Path 2: COSMIC SIGNATURE (Birthdate Mode)
```
ModeSelectScreen
  ↓ (click Cosmic Signature)
CosmicSignatureScreen
  ↓ (click Generate Pattern)
SimulationScreen
  ↓ (click Back or Home)
ModeSelectScreen
```

### Path 3: HOME NAVIGATION (Any Screen)
```
[Any Screen with Home Button]
  ↓ (click Home)
ModeSelectScreen
```

---

## UNCONFIRMED NAVIGATION PATHS

### Potential Path: PATTERN DETAILS (Info Button)
```
SimulationScreen
  ↓ (click Info button - UNCLEAR)
PatternDetailsScreen OR Modal ??? (NOT IMPLEMENTED?)
  ↓ (close)
SimulationScreen
```

### Potential Path: PATTERN RESULT/REVEAL (Post-Simulation)
```
SimulationScreen
  ↓ (finish animation OR action?)
ResultScreen OR RevealScreen ??? (UNCLEAR)
```

---

## PERSISTENT UI ELEMENTS

### Bottom Navigation (BottomNav.jsx)
- **Appears on**: Every screen except LoadingScreen
- **Contains**:
  - Home icon button (always navigates to ModeSelectScreen)
  - Potentially other navigation options
- **Styling**: Glass-morphism effect, circular buttons
- **Accessibility**: Icon-only (needs aria-label per audit)

### Header (ScreenHeader)
- **Appears on**: Every screen except LoadingScreen
- **Contains**:
  - Back button (if applicable)
  - Screen title
  - Screen subtitle
  - Optional right-side button (Info on Simulation)

---

## STATE MANAGEMENT FLOW

### Zustand Store (useAppStore)
```javascript
// Key state properties
{
  screen: 'modeSelect' | 'planets' | 'simulation' | 'result' | etc,
  patternMode: 'orbitograph' | 'cosmic',
  
  // Orbitograph state
  selectedPlanets: [planet1, planet2],
  
  // Cosmic state
  cosmicDate: Date,
  
  // Simulation state
  simulationSpeed: number (0.1 - 4.0),
  patternDetail: number (1 - 10),
  
  // Methods
  goTo(screen),
  setPatternMode(mode),
  setCosmicDate(date),
  setSelectedPlanets(planets),
  // ... etc
}
```

### Screen Transitions
- User interaction (button click) → Call `goTo('screenName')`
- State updates → Component re-renders with new screen
- ScreenTransition component handles visual transition
- Suspense provides fallback while screen component loads

---

## LAZY LOADING STRATEGY

**Eagerly Loaded**:
- LoadingScreen (always shown on startup)

**Lazy Loaded** (on first navigation):
- PlanetSelectScreen
- CosmicSignatureScreen
- SimulationScreen
- ResultScreen
- PatternDetailsScreen
- KnowledgeCardScreen
- CollectionScreen (if exists)
- SharePatternScreen (if exists)
- ProfileScreen (if exists)
- RevealScreen (if exists)
- SimulationSettingsScreen (if exists)

**Suspense Fallback**: ScreenFallback component (likely loading indicator)

---

## RESPONSIVE BEHAVIOR

### Mobile (320px - 768px)
- Single-column layout
- Full-height screens
- Touch-optimized buttons (48-56px)
- Bottom navigation for easy thumb access
- Carousel for planet selection

### Tablet (768px - 1272px)
- Potentially split layout
- Might show multiple panels side-by-side
- Desktop-style interactions

### Desktop (1272px+)
- Wide layout optimized
- Mouse/keyboard interactions
- Hover states
- Potentially zen mode with sidebar

---

## DESIGN SYSTEM TOKENS

### Colors
- **Background**: Black (#000000)
- **Text Primary**: White (#FFFFFF)
- **Text Secondary**: Gray (#888888)
- **Accent**: Orange (#FF6B35 approximate)
- **Glass Effect**: Semi-transparent with backdrop-filter

### Typography
- **Title (h1)**: Large, white, prominent
- **Subtitle (p)**: Medium, white, 24px margin-bottom
- **Label**: Small, gray, uppercase (DATE OF BIRTH)
- **Body**: Regular weight, readable size

### Spacing
- **Header margin-bottom**: 12px (h1) + 24px (subtitle)
- **Carousel margin-top**: 135-145px (varies by breakpoint)
- **Form margin-top**: 115px (ensures calendar visibility)
- **Button gap**: 16-24px
- **Padding**: 16-24px (standard)

### Interactive Elements
- **Button height**: 44-56px (touch-friendly)
- **Slider handle**: ~24px diameter
- **Border radius**: 24-32px (smooth, modern)
- **Glass border**: 1-2px with opacity

---

## UNRESOLVED QUESTIONS

1. **Info Button**: What does it do?
   - Options: Info modal, Pattern details screen, Panel slide-in, None
   - Status: NEEDS CLARIFICATION

2. **Result Screen**: When/how accessed?
   - Is there a post-simulation result/reveal screen?
   - How are patterns saved/shared?

3. **Collection Screen**: Purpose and access?
   - Saved patterns library?
   - Social sharing features?

4. **Profile Screen**: Exists but purpose unclear

5. **Knowledge Card Screen**: Educational content?

6. **Additional Screens**: SimulationSettingsScreen, RevealScreen, SharePatternScreen - purposes not clearly defined

---

## RECOMMENDATIONS FOR CLARIFICATION

1. **Implement Info Button**
   - Show pattern statistics and orbital mechanics
   - Display resonance patterns and cosmic signatures
   - Link to educational content

2. **Define Result/Reveal Flow**
   - Add screen after SimulationScreen showing:
     - Generated pattern stats
     - Save/share options
     - Related patterns

3. **Document Hidden Screens**
   - What triggers navigation to unconfirmed screens?
   - ProfileScreen - user account?
   - CollectionScreen - saved patterns?

4. **Clarify Accessibility Paths**
   - Keyboard navigation flow
   - Screen reader descriptions for 3D content
   - Focus management between screens

---

**Last Updated**: 2026-08-08  
**Status**: Screen flow verified, some screens unconfirmed  
**Action Needed**: Clarify unconfirmed screens and info button behavior
