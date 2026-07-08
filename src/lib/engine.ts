// ─────────────────────────────────────────────────────────────
// CINEMAN ENGINE — ported from Prompt Maker v2.0 (under the hood)
// 14 categories / 232 curated options: genres, styles, shot sizes,
// angles, lenses, focus, camera bodies, 50 camera moves, lighting,
// time of day, weather, voice delivery, music, color grading.
// Visibility in the studio main menu is controlled from /engine.
// ─────────────────────────────────────────────────────────────

export type EngineItem = [label: string, prompt: string]

export type EngineCategory = {
  title: string
  hint: string
  items: EngineItem[]
}

export type EngineConfig = {
  // which categories show up as chip pickers in the studio
  visible: Record<string, boolean>
  // append the 8K IMAX master style preset to every prompt
  masterPreset: boolean
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  visible: {
    genre: true, styles: false, shottype: true, angle: false,
    lens: false, focus: false, camtype: false, camera: true,
    light: true, time: true, weather: true, delivery: false,
    music: false, colorgrade: false,
  },
  masterPreset: true,
}

export const ENGINE_CATS: Record<string, EngineCategory> = {
 "genre": {
  "title": "Genre / Mood",
  "hint": "Overall tone, mood & genre.",
  "items": [
   [
    "Drama",
    "Dramatic narrative tone with grounded realism and emotional weight. Tone: sincere, character-driven, emotionally honest. Pacing: measured, allows scenes to breathe. Visual language: naturalistic framing, motivated light, restrained camera. Mood: heartfelt, human, quietly intense"
   ],
   [
    "Thriller",
    "Tense thriller atmosphere with suspenseful pacing and mounting pressure. Tone: paranoid, alert, high-stakes. Pacing: tight, escalating, punctuated by sudden beats. Visual language: shallow focus, tight framing, shadow-heavy compositions. Mood: anxious, coiled, on edge"
   ],
   [
    "Comedy",
    "Light comedic tone, bright and playful with energetic timing. Tone: warm, exaggerated, quick-witted. Pacing: snappy, reactive, comedic beats land fast. Visual language: bright even lighting, open wide framing, saturated color. Mood: fun, buoyant, feel-good"
   ],
   [
    "Romance",
    "Warm romantic mood, intimate and tender between subjects. Tone: soft, affectionate, emotionally open. Pacing: gentle, lingering on glances and gestures. Visual language: soft backlight, shallow depth, warm color palette. Mood: tender, nostalgic, swooning"
   ],
   [
    "Horror",
    "Dark horror atmosphere with dread and unease, inspired by The Babadook and The Ring, high production value. Tone: unsettling, dread-laden, quietly menacing. Pacing: slow-burn tension broken by sudden shocks. Visual language: negative space, low-key lighting, unnatural stillness. Mood: fearful, oppressive, unrelenting dread"
   ],
   [
    "Sci-Fi",
    "Futuristic sci-fi aesthetic with high-tech detail and speculative scale. Tone: clinical, awe-inspiring, forward-looking. Pacing: deliberate builds to reveal scale or technology. Visual language: cool color temperature, geometric production design, clean symmetrical framing. Mood: wonder mixed with unease"
   ],
   [
    "Action",
    "High-octane action energy, kinetic and intense physical momentum. Tone: adrenaline-driven, urgent, propulsive. Pacing: rapid cutting rhythm, bursts of speed and impact. Visual language: dynamic handheld or tracking camera, motion blur, hard contrast. Mood: exhilarating, relentless, high-adrenaline"
   ],
   [
    "Noir",
    "Film-noir mood with deep shadows and moral tension. Tone: cynical, morally ambiguous, world-weary. Pacing: slow, deliberate, dialogue-driven. Visual language: hard chiaroscuro lighting, venetian-blind shadow patterns, deep blacks. Mood: fatalistic, brooding, suspicious"
   ],
   [
    "Documentary",
    "Observational documentary realism, natural and unstaged. Tone: honest, unembellished, present-moment. Pacing: unforced, following real time and behavior. Visual language: handheld camera, available light, candid framing. Mood: authentic, grounded, immersive"
   ],
   [
    "Fantasy",
    "Mythical fantasy tone, otherworldly and grand, folklore with Nordic influence, A24 and Midsommar aesthetic. Tone: mythic, reverent, larger-than-life. Pacing: unhurried, ceremonial, building toward wonder. Visual language: painterly natural light, epic wide compositions, rich production design. Mood: awe-struck, ancient, enchanted"
   ],
   [
    "Western",
    "Rugged western feel, dusty and wide-open frontier atmosphere. Tone: stoic, weathered, morally stark. Pacing: patient, standoff tension building to sudden action. Visual language: wide vistas, harsh sun, dust and grain texture. Mood: lonesome, rugged, sun-baked"
   ],
   [
    "Commercial",
    "Polished commercial spot with premium brand feel and flawless finish. Tone: aspirational, confident, product-first. Pacing: brisk, hook-driven, every second earns its place. Visual language: clean high-key lighting, glossy surfaces, precise framing. Mood: aspirational, premium, desirable"
   ],
   [
    "Poetic",
    "Introspective, poetic, otherworldly calm, fine art cinematic photography, inspired by Wong Kar-Wai and Gregory Crewdson. Tone: contemplative, wistful, quietly symbolic. Pacing: slow, meditative, lingering on stillness. Visual language: soft ambient light, painterly composition, muted palette. Mood: dreamlike, reflective, tender melancholy"
   ],
   [
    "Melancholic",
    "Melancholic, contemplative, sacred mood with quiet emotional gravity. Tone: solemn, tender, unresolved longing. Pacing: slow, patient, weighted silences. Visual language: soft desaturated light, negative space, still framing. Mood: wistful, sorrowful, hushed"
   ],
   [
    "Nightmare",
    "Intense dread, surreal silence, confrontation between innocence and nightmare. Tone: disturbing, dreamlike, psychologically charged. Pacing: uneven, warps between stillness and sudden intrusion. Visual language: distorted framing, unnatural color, deep shadow pockets. Mood: terrifying, disorienting, inescapable"
   ],
   [
    "Catastrophic",
    "Intense, catastrophic, high tension, hyper-realistic cinematic, inspired by Hollywood disaster films. Tone: urgent, overwhelming, life-or-death. Pacing: relentless, chaotic bursts of scale and destruction. Visual language: wide devastation shots intercut with tight survival close-ups, harsh practical light. Mood: terrifying, awe-struck, desperate"
   ],
   [
    "War",
    "Intense, raw, hostile, war thriller, gritty realism, inspired by Children of Men and Sicario. Tone: brutal, unflinching, immediate. Pacing: relentless, chaotic, no safety net. Visual language: handheld long takes, muted desaturated palette, practical smoke and debris. Mood: harrowing, visceral, unforgiving"
   ],
   [
    "Travel",
    "Dreamy naturalism, travel editorial vibe, soft tones and tactile textures in motion. Tone: curious, unhurried, sensory. Pacing: flowing, drifting between moments and places. Visual language: natural light, handheld drift, warm film-like palette. Mood: wanderlust, serene, alive"
   ],
   [
    "Fine art",
    "Ethereal realism, fine art photography, cinematic minimalism. Tone: refined, quiet, precise. Pacing: still, contemplative, composition-first. Visual language: sculptural light, negative space, restrained color. Mood: serene, elevated, meditative"
   ],
   [
    "Fashion beauty",
    "Hyperrealistic fashion editorial, beauty campaign look, cinematic color grade, ultra HD detail. Tone: glamorous, confident, aspirational. Pacing: crisp, pose-driven, controlled movement. Visual language: studio-grade key light, flawless skin detail, bold graphic framing. Mood: striking, polished, desirable"
   ],
   [
    "Sport",
    "Cinematic adventure sports photography, high realism with vivid natural colors. Tone: exhilarating, physical, triumphant. Pacing: fast, propulsive, built around peak moments. Visual language: dynamic tracking, natural light, saturated outdoor color. Mood: energized, adventurous, victorious"
   ]
  ]
 },
 "styles": {
  "title": "Style / Look",
  "hint": "Director look.",
  "items": [
   [
    "Cinematic",
    "Polished cinematic look with high production value and photorealistic detail. Signature: motivated lighting, considered framing, film-grade color science. Composition: balanced rule-of-thirds, clean depth layering. Color: rich, true-to-life with subtle grade. Best for: narrative scenes, commercials, general premium footage"
   ],
   [
    "Tarkovsky",
    "Tarkovsky-inspired slow contemplative tone, muted industrial palette, poetic realism. Signature: long unbroken takes, elemental imagery (water, fire, wind). Composition: deep-focus long lens, figures dwarfed by space. Color: desaturated earth tones, muted greens and browns. Best for: meditative sequences, dream logic, existential mood"
   ],
   [
    "Wes Anderson",
    "Wes Anderson symmetry, pastel palette, centered framing, deadpan whimsy. Signature: perfectly centered subjects, flat planimetric staging. Composition: rigid symmetry, whip-pans between static tableaus. Color: pastel candy palette, warm nostalgic tones. Best for: quirky ensemble scenes, storybook worlds, comedic deadpan"
   ],
   [
    "Roger Deakins",
    "Roger Deakins cinematography, naturalistic motivated light, restrained elegant contrast. Signature: light that feels earned by the environment, minimal artificial fill. Composition: wide considered frames, negative space used deliberately. Color: naturalistic with subtle cool or warm bias. Best for: prestige drama, landscapes, quiet character moments"
   ],
   [
    "Kubrick",
    "Kubrick one-point symmetry, cold precise framing, clinical grandeur. Signature: single-point perspective corridors, unnerving stillness. Composition: perfectly centered, wide-angle depth, geometric precision. Color: cool, clinical, high contrast. Best for: unsettling interiors, institutional spaces, psychological tension"
   ],
   [
    "VHS",
    "Degraded VHS texture, scanlines, low fidelity, nostalgic analog grain. Signature: tape noise, chromatic bleed, tracking distortion. Composition: loose amateur framing, occasional timestamp overlay. Color: shifted saturation, soft blacks, analog color bleed. Best for: found-footage, retro throwback, lo-fi nostalgia"
   ],
   [
    "Dreamy",
    "Dreamy soft-focus haze, gentle bloom, ethereal naturalism. Signature: diffused highlights, floating camera drift. Composition: loose, gently unstable framing, shallow focus falloff. Color: soft pastel wash, low contrast glow. Best for: memory sequences, romance, surreal transitions"
   ],
   [
    "90s film",
    "Warm 90s film stock, soft contrast, light grain, nostalgic palette. Signature: organic film grain, slightly soft optics. Composition: classic coverage, unforced camera movement. Color: warm amber-leaning stock color, gentle highlight roll-off. Best for: period pieces, nostalgic drama, coming-of-age stories"
   ],
   [
    "Teal & orange",
    "Teal and orange blockbuster grade, complementary color contrast. Signature: skin tones pushed warm against cool shadow and background. Composition: standard cinematic coverage built to support the grade. Color: teal shadows, orange highlights, punchy saturation. Best for: action, blockbuster commercials, high-energy sequences"
   ],
   [
    "High-fashion",
    "High-end fashion editorial look, beauty-campaign polish, cinematic color grade. Signature: flawless skin rendering, sculpted studio light. Composition: bold graphic framing, confident negative space. Color: rich controlled palette matched to brand identity. Best for: beauty campaigns, luxury product, editorial portraiture"
   ],
   [
    "Film noir B&W",
    "High-contrast black and white, hard chiaroscuro shadows. Signature: venetian-blind light patterns, deep unlit pockets. Composition: off-center framing, foreground silhouettes. Color: pure monochrome, crushed blacks, hot highlights. Best for: crime drama, morally ambiguous scenes, detective mood"
   ],
   [
    "A24 indie",
    "A24 indie aesthetic, natural muted color, emotional restraint, subtle grain. Signature: unforced naturalistic performance framing, patient camera. Composition: intimate handheld or locked wides, honest proximity. Color: muted natural palette, filmic grain. Best for: character drama, quiet emotional beats, indie realism"
   ],
   [
    "Hyperreal",
    "Hyperrealistic detail, ultra-sharp textures, photoreal lighting. Signature: extreme clarity, every surface texture visible. Composition: precise clean framing that showcases detail. Color: true-to-life with enhanced micro-contrast. Best for: product hero shots, macro detail, premium tech showcases"
   ],
   [
    "Retro DVD 1970",
    "Cinematic DVD screen grab, 1970s film, 35mm film stock, dusty color smear with grain. Signature: heavy organic film grain, soft optical smear on highlights. Composition: loose period-accurate framing. Color: faded warm tones, dusty color bleed, lifted blacks. Best for: throwback aesthetic, retro title sequences, analog nostalgia"
   ]
  ]
 },
 "shottype": {
  "title": "Shot size",
  "hint": "Framing scale.",
  "items": [
   [
    "Extreme wide",
    "extreme wide establishing shot, subject small in vast environment"
   ],
   [
    "Wide",
    "wide establishing shot, full environment visible"
   ],
   [
    "Full shot",
    "full-body shot, subject head to toe in frame"
   ],
   [
    "Medium",
    "medium shot, subject from the waist up"
   ],
   [
    "Medium close-up",
    "medium close-up, chest and head in frame"
   ],
   [
    "Close-up",
    "close-up, face fills the frame"
   ],
   [
    "Extreme close-up",
    "extreme close-up (macro), eyes and key detail centered"
   ],
   [
    "Insert / detail",
    "tight insert detail shot of a single object"
   ],
   [
    "Over-the-shoulder",
    "over-the-shoulder framing, foreground shoulder soft"
   ],
   [
    "POV",
    "first-person POV shot from the subject eyeline"
   ],
   [
    "Two-shot",
    "two-shot, two subjects balanced in frame"
   ]
  ]
 },
 "angle": {
  "title": "Camera angle",
  "hint": "Angle drives drama.",
  "items": [
   [
    "Eye level",
    "eye-level angle, neutral and natural"
   ],
   [
    "Low angle",
    "low-angle shot looking up, subject powerful and dominant"
   ],
   [
    "High angle",
    "high-angle shot looking down, subject small and vulnerable"
   ],
   [
    "Dutch angle",
    "dutch-tilt angle, ~20 degree canted horizon, unease and tension"
   ],
   [
    "Top-down",
    "top-down birds-eye view, flat symmetrical composition"
   ],
   [
    "Worms-eye",
    "extreme worms-eye angle from the ground looking up"
   ],
   [
    "Shoulder level",
    "shoulder-level angle, grounded and intimate"
   ],
   [
    "Ground level",
    "ground-level angle, camera resting on the floor"
   ]
  ]
 },
 "lens": {
  "title": "Lens",
  "hint": "Focal length & character.",
  "items": [
   [
    "16mm ultra-wide",
    "16mm ultra-wide lens. Perspective: extreme wide with visible barrel distortion at edges. Depth: deep focus from foreground to infinity. Character: immersive, expansive, slightly surreal spatial exaggeration. Best for: landscapes, architecture, action POV, claustrophobic interiors"
   ],
   [
    "24mm wide",
    "24mm wide lens. Perspective: expansive with natural-feeling spatial depth. Depth: deep focus with clear foreground-background separation. Character: cinematic storytelling standard, immersive without distortion. Best for: establishing shots, walk-and-talk, environmental portraits"
   ],
   [
    "35mm",
    "35mm lens. Perspective: natural cinematic field of view closest to human perception. Depth: moderate, subject separates from background naturally. Character: the classic film lens, neutral and versatile. Best for: dialogue scenes, documentary, everyday realism"
   ],
   [
    "50mm",
    "50mm lens. Perspective: true-to-eye with no spatial compression or expansion. Depth: moderate shallow, clean background separation. Character: honest, undistorted, the most neutral lens. Best for: interviews, product shots, straight portraits"
   ],
   [
    "85mm portrait",
    "85mm portrait lens. Perspective: gentle telephoto compression flattering facial features. Depth: shallow, creamy bokeh background blur at wide apertures. Character: the beauty lens, classic portrait rendering. Best for: close-up portraits, fashion, beauty, intimate dialogue. 24fps for raw natural texture"
   ],
   [
    "100mm macro",
    "100mm macro lens. Perspective: tight telephoto with 1:1 magnification capability. Depth: extremely shallow, millimeters of focus plane. Character: reveals invisible detail — pores, fibers, droplets, textures. Best for: food, product detail, eyes, jewelry, nature extreme close-ups"
   ],
   [
    "100mm shallow",
    "100mm lens with shallow depth of field. Perspective: compressed telephoto isolating subject completely. Depth: razor-thin focus plane with strong bokeh. Character: dreamy separation, subject floats against blurred world. 24fps for raw natural texture"
   ],
   [
    "135mm telephoto",
    "135mm telephoto lens. Perspective: strong background compression, flattened depth planes. Depth: very shallow, subject pops from background dramatically. Character: cinematic isolation, emotional distance. Best for: emotional close-ups, surveillance, sports, stalker perspective"
   ],
   [
    "Anamorphic",
    "anamorphic lens. Perspective: 2.39:1 widescreen feel with characteristic oval bokeh and horizontal blue lens flares. Depth: unique fall-off with stretched highlights. Character: unmistakably cinematic, Hollywood blockbuster texture. Best for: narrative cinema, music videos, premium commercials"
   ],
   [
    "Vintage anamorphic",
    "Shot on vintage anamorphic lens. Perspective: imperfect optics with warm color cast, subtle aberrations, oval bokeh, and organic horizontal flares. Depth: dreamy with character. Character: nostalgic cinema texture, each lens has unique personality. Best for: period films, emotional storytelling, indie cinema"
   ],
   [
    "Tilt-shift",
    "tilt-shift lens. Perspective: selective plane of focus creating miniature effect or architectural correction. Depth: narrow band of sharp focus at an angle. Character: surreal miniature world or perfectly straight vertical lines. Best for: cityscapes, architectural, diorama effect, time-lapse"
   ],
   [
    "Fisheye",
    "fisheye lens. Perspective: extreme 180-degree spherical distortion bending all straight lines. Depth: everything in focus. Character: immersive, psychedelic, extreme exaggeration. Best for: skateboarding, action sports, VR-style POV, surreal dream sequences"
   ],
   [
    "Macro extreme",
    "Macro lens at extreme close-up magnification. Perspective: fills frame with tiny subjects at life-size reproduction. Depth: ultra shallow, fractions of millimeter in focus. Character: reveals hidden worlds in everyday objects. Best for: insect detail, skin texture, liquid drops, food ingredients"
   ]
  ]
 },
 "focus": {
  "title": "Focus",
  "hint": "Depth of field & focus moves.",
  "items": [
   [
    "Shallow DOF",
    "shallow depth of field, subject razor sharp against a creamy blurred background"
   ],
   [
    "Deep focus",
    "deep focus, foreground to background all sharp and readable"
   ],
   [
    "Rack focus",
    "rack focus shifting from the foreground element to the background subject mid-shot, one deliberate focus pull"
   ],
   [
    "Focus on foreground",
    "focus locked on the foreground element, background melting into soft blur"
   ],
   [
    "Focus on background",
    "focus locked on the background subject, foreground softly out of focus framing the shot"
   ],
   [
    "Soft focus",
    "soft dreamy focus with gentle diffusion over the whole frame"
   ],
   [
    "Macro focus",
    "macro focus plane millimeters deep, extreme detail on the focal point"
   ]
  ]
 },
 "camtype": {
  "title": "Camera body",
  "hint": "Image texture.",
  "items": [
   [
    "ARRI Alexa",
    "shot on ARRI Alexa, clean high-end digital cinema texture"
   ],
   [
    "Alexa Mini LF",
    "shot on ARRI Alexa Mini LF, large-format cinematic texture"
   ],
   [
    "RED",
    "shot on RED, crisp high-resolution digital detail"
   ],
   [
    "Panavision 35mm",
    "Panavision 35mm film stock, organic grain, soft filmic contrast"
   ],
   [
    "DSLR 50mm f1.4",
    "full-frame DSLR with 50mm f/1.4, shallow depth, photoreal tones"
   ],
   [
    "Mirrorless",
    "mirrorless camera, clean modern digital look"
   ],
   [
    "iPhone",
    "smartphone footage, casual handheld realism"
   ],
   [
    "Amateur handheld",
    "amateur handheld camcorder feel, raw and unpolished"
   ],
   [
    "Super 8",
    "Super 8 film, heavy grain, vintage saturated color"
   ],
   [
    "VHS camcorder",
    "VHS camcorder capture, low resolution, analog artifacts"
   ],
   [
    "Drone",
    "aerial drone shot, smooth high-altitude movement"
   ],
   [
    "GoPro",
    "GoPro-style wide-angle action cam, head/chest mount, real-time momentum, wide-angle, speed lines"
   ]
  ]
 },
 "camera": {
  "title": "Camera movement",
  "hint": "Replaceable by @Video ref per shot.",
  "items": [
   [
    "Static",
    "locked-off static shot. Movement: hold one fixed camera position for the full clip. Speed: still and steady. Framing: keep the same angle, height, lens distance and composition. End: finish with the same framing and camera position"
   ],
   [
    "Pan right",
    "pan right. Movement: rotate the camera horizontally from left to right from one fixed point. Speed: smooth constant rotation. Framing: keep the horizon level while new space enters from the right side of the frame. End: settle on a clear final composition"
   ],
   [
    "Pan left",
    "pan left. Movement: rotate the camera horizontally from right to left from one fixed point. Speed: smooth constant rotation. Framing: keep the horizon level while new space enters from the left side of the frame. End: settle on a clear final composition"
   ],
   [
    "Whip pan right",
    "whip pan right. Movement: rotate rapidly from the starting direction toward a new target on the right. Speed: fast snap with brief motion blur during the rotation. Framing: begin on one readable composition and land on a second readable target. End: settle into a sharp final frame"
   ],
   [
    "Whip pan left",
    "whip pan left. Movement: rotate rapidly from the starting direction toward a new target on the left. Speed: fast snap with brief motion blur during the rotation. Framing: begin on one readable composition and land on a second readable target. End: settle into a sharp final frame"
   ],
   [
    "Tilt up",
    "tilt up. Movement: rotate the camera upward from one fixed point. Speed: smooth constant tilt. Framing: keep the vertical subject or architecture centered as the frame travels upward. End: land on the upper target"
   ],
   [
    "Tilt down",
    "tilt down. Movement: rotate the camera downward from one fixed point. Speed: smooth constant tilt. Framing: keep the vertical subject or architecture centered as the frame travels downward. End: land on the lower target"
   ],
   [
    "Slow zoom in",
    "slow zoom in. Movement: slowly increase lens focal length toward a tighter frame. Speed: gradual and even. Framing: keep the main visual target readable as it becomes larger in frame. End: finish on a stable tighter composition"
   ],
   [
    "Slow zoom out",
    "slow zoom out. Movement: slowly decrease lens focal length toward a wider frame. Speed: gradual and even. Framing: keep the main visual target readable as more surrounding space appears. End: finish on a stable wider composition"
   ],
   [
    "Fast zoom in",
    "fast zoom in. Movement: quickly increase lens focal length toward the main visual target. Speed: quick decisive zoom. Framing: keep the target centered or clearly readable during the scale change. End: finish on a stable tighter composition"
   ],
   [
    "Fast zoom out",
    "fast zoom out. Movement: quickly decrease lens focal length away from the main visual target. Speed: quick decisive zoom. Framing: keep the target readable as the surrounding space appears. End: finish on a stable wider composition"
   ],
   [
    "Crash zoom in",
    "crash zoom in. Movement: snap the lens rapidly toward the main visual target. Speed: very fast and punchy. Framing: keep the target readable through the sudden scale change. End: land on a bold tighter composition"
   ],
   [
    "Crash zoom out",
    "crash zoom out. Movement: snap the lens rapidly away from the main visual target. Speed: very fast and punchy. Framing: keep the target readable as the surrounding space appears. End: land on a bold wider composition"
   ],
   [
    "Dolly in",
    "dolly in. Movement: move the camera physically forward in a straight line toward the main subject. Speed: smooth controlled push. Framing: keep camera height, lens direction and subject position consistent while distance closes. End: finish in a tighter composition"
   ],
   [
    "Dolly out",
    "dolly out. Movement: move the camera physically backward in a straight line away from the main subject. Speed: smooth controlled retreat. Framing: keep lens direction and camera height consistent while more environment enters frame. End: finish in a wider composition"
   ],
   [
    "Truck right",
    "truck right. Movement: move the camera physically to the right on a straight horizontal path. Speed: smooth constant lateral travel. Framing: keep the lens facing the same direction while the scene slides across frame. End: finish on a clean lateral composition"
   ],
   [
    "Truck left",
    "truck left. Movement: move the camera physically to the left on a straight horizontal path. Speed: smooth constant lateral travel. Framing: keep the lens facing the same direction while the scene slides across frame. End: finish on a clean lateral composition"
   ],
   [
    "Pedestal up",
    "pedestal up. Movement: move the entire camera vertically upward in a straight line. Speed: smooth constant lift. Framing: keep the lens level and pointed in the same direction during the vertical move. End: finish with the higher framing clearly readable"
   ],
   [
    "Pedestal down",
    "pedestal down. Movement: move the entire camera vertically downward in a straight line. Speed: smooth constant descent. Framing: keep the lens level and pointed in the same direction during the vertical move. End: finish with the lower framing clearly readable"
   ],
   [
    "Slider right",
    "slider right. Movement: slide the camera a small distance to the right. Speed: slow controlled constant motion. Framing: keep foreground, subject and background layers readable as parallax shifts. End: finish on a refined composition with the new right-side angle visible"
   ],
   [
    "Slider left",
    "slider left. Movement: slide the camera a small distance to the left. Speed: slow controlled constant motion. Framing: keep foreground, subject and background layers readable as parallax shifts. End: finish on a refined composition with the new left-side angle visible"
   ],
   [
    "Push past",
    "push past. Movement: move forward past a visible foreground object, edge or opening. Speed: smooth forward glide. Framing: let the foreground pass close to the lens while the space beyond becomes clearer. End: arrive inside or beyond the foreground layer"
   ],
   [
    "Arc right",
    "arc right. Movement: move on a shallow curved path around the main subject toward the right side. Speed: smooth measured curve. Framing: keep distance, height and subject readability consistent while the angle changes. End: finish from a new right-side angle"
   ],
   [
    "Arc left",
    "arc left. Movement: move on a shallow curved path around the main subject toward the left side. Speed: smooth measured curve. Framing: keep distance, height and subject readability consistent while the angle changes. End: finish from a new left-side angle"
   ],
   [
    "Orbit clockwise",
    "clockwise orbit. Movement: circle clockwise around the main subject at a consistent radius. Speed: smooth controlled orbit. Framing: keep the subject centered while the background rotates around them. End: complete the intended arc or full circle with stable framing"
   ],
   [
    "Orbit counterclockwise",
    "counterclockwise orbit. Movement: circle counterclockwise around the main subject at a consistent radius. Speed: smooth controlled orbit. Framing: keep the subject centered while the background rotates around them. End: complete the intended arc or full circle with stable framing"
   ],
   [
    "Tracking shot",
    "tracking shot. Movement: move through the scene with the main subject. Speed: match the subject pace. Framing: keep the subject consistently readable while the environment moves around them. End: maintain a clear moving composition"
   ],
   [
    "Follow shot OTS",
    "follow shot from behind. Movement: move behind the subject along their route at shoulder height. Speed: match the subject pace. Framing: keep the back, shoulder or head as the foreground guide while the route ahead stays readable. End: continue following with the subject leading the frame"
   ],
   [
    "Reverse tracking",
    "reverse tracking shot. Movement: move backward in front of the walking subject. Speed: match the subject forward pace. Framing: keep front-facing face and body framing stable as the background moves behind them. End: hold a clear front-facing moving composition"
   ],
   [
    "Side tracking",
    "side tracking shot. Movement: move parallel beside the subject along their direction of travel. Speed: match the subject motion. Framing: keep the subject in side profile or three-quarter profile at a stable distance. End: continue the parallel movement with clear horizontal motion"
   ],
   [
    "Low tracking",
    "low tracking shot. Movement: move at ground or below-waist height alongside the subject movement path. Speed: match the subject, footsteps or wheels. Framing: keep the low detail readable while the ground plane moves through frame. End: finish with the low perspective clearly maintained"
   ],
   [
    "Vehicle tracking",
    "vehicle tracking shot. Movement: move with the vehicle along its route. Speed: match the vehicle pace. Framing: keep the vehicle stable in frame while the road or environment moves past. End: maintain a clear moving vehicle composition"
   ],
   [
    "Chase shot",
    "chase shot. Movement: follow a moving subject quickly along the action route. Speed: fast, reactive and physically close. Framing: keep the subject visible while allowing energetic reframing. End: stay connected to the subject in motion"
   ],
   [
    "Handheld",
    "handheld shot. Movement: hold the camera at human operator height with natural body movement. Speed: responsive and organic. Framing: keep the subject readable while the frame has subtle sway and micro-adjustments. End: finish with a natural handheld composition"
   ],
   [
    "Handheld raw",
    "Heavy handheld shake, constant reframing, autofocus hunting, lens breathing, exposure pumping. Faded low contrast, washed out, digital noise. No stabilization, no modern grading"
   ],
   [
    "Camcorder",
    "Filmed naturally using modern mirrorless camera. No posing, no scripted acting. Spontaneous and real. Camera language is highest priority"
   ],
   [
    "Vlog camera",
    "Natural handheld, gentle sway, focus breathing, autofocus adjustments, framing imperfections, documentary tracking, premium lifestyle vlog. Panavision 35mm, low saturation, soft contrast, slight grain"
   ],
   [
    "Snorricam",
    "body-mounted Snorricam. Movement: keep the camera fixed relative to the subject torso or face while the subject moves. Speed: match the subject body motion. Framing: keep the subject close, centered and facing the camera as the background moves around them. End: finish with the subject still locked in frame"
   ],
   [
    "Crane up",
    "crane up. Movement: travel smoothly upward through open space. Speed: slow controlled vertical lift. Framing: keep the subject or location readable as the camera rises. End: finish with the higher scale clearly visible"
   ],
   [
    "Crane down",
    "crane down. Movement: travel smoothly downward through open space. Speed: slow controlled vertical descent. Framing: keep the subject or location readable as the camera descends. End: finish with the lower subject or destination clearly visible"
   ],
   [
    "Drone push in",
    "drone push in. Movement: fly smoothly forward through open space toward the subject or destination. Speed: controlled aerial glide. Framing: keep the route and destination readable as the camera approaches. End: arrive at a closer aerial composition"
   ],
   [
    "Drone pull back",
    "drone pull back. Movement: fly smoothly backward away from the subject or destination. Speed: controlled aerial retreat. Framing: keep the subject readable as more landscape appears. End: finish on a wider aerial composition"
   ],
   [
    "FPV drone",
    "Extremely fast FPV movement, strong blur on sides, center of frame draws the eye inward"
   ],
   [
    "Helicopter",
    "helicopter-style aerial shot. Movement: move from high altitude along a broad gradual flight path. Speed: steady controlled aerial motion. Framing: keep the landscape or distant moving subject readable at wide scale. End: finish on a stable high-altitude composition"
   ],
   [
    "First-person POV",
    "first-person view. Movement: move forward at human eye height from the character perspective. Speed: natural walking or reaching pace. Framing: use visible hands, arms or body edges as the viewer physical reference. End: arrive at the next point of action from the same point of view"
   ],
   [
    "Tilt-shift miniature",
    "tilt-shift miniature view. Movement: hold or glide from a high angled view over the scene. Speed: small precise movement. Framing: keep a narrow band of sharp focus across the key subject area with soft blur above and below. End: finish with the miniature-scale view intact"
   ],
   [
    "Infinite zoom",
    "infinite zoom. Movement: zoom continuously inward toward the exact center target. Speed: smooth accelerating zoom. Framing: keep the circular target centered as it expands. End: finish when the next visual world fills the frame"
   ],
   [
    "Earth zoom out",
    "earth zoom out. Movement: pull upward from the starting point through street, city, landscape and planet scale. Speed: rapid expanding zoom out. Framing: keep the original location centered as scale grows. End: finish on a planet-scale view with the starting point still implied at center"
   ],
   [
    "Time-lapse",
    "locked-camera time-lapse. Movement: hold one fixed camera position while time moves rapidly forward. Speed: fast time compression with a stable camera. Framing: keep the same composition and horizon as motion passes through the frame. End: finish from the same camera angle with visible passage of time"
   ],
   [
    "Pass-through",
    "pass-through movement. Movement: move forward toward a visible object, surface or barrier and continue into the space beyond. Speed: smooth centered glide. Framing: keep the opening or surface centered as the transition point. End: arrive inside the revealed space beyond"
   ]
  ]
 },
 "light": {
  "title": "Lighting",
  "hint": "Light shapes mood.",
  "items": [
   [
    "Natural",
    "Natural realistic lighting with true-to-life tones. Light source: ambient daylight or practical room light. Shadows: soft and organic. Temperature: neutral. Mood: grounded, honest, documentary-feel authenticity"
   ],
   [
    "Golden hour",
    "Warm golden-hour sunlight with long soft shadows and glowing highlights. Light source: low sun at 15-20 degrees above horizon. Shadows: elongated and warm-toned. Temperature: deep amber-orange. Mood: romantic, nostalgic, cinematic warmth"
   ],
   [
    "Golden hour backlit",
    "Late golden hour with strong backlight, sun positioned directly behind the character creating luminous hair glow, soft lens flares, and rim-lit silhouette edges. Temperature: warm amber. Mood: heroic, ethereal, transcendent"
   ],
   [
    "Soft key",
    "Soft diffused key light with gentle even illumination across the subject. Light source: large softbox or diffused window at 45 degrees. Shadows: minimal and feathered. Temperature: neutral to slightly warm. Mood: flattering, clean, commercial beauty"
   ],
   [
    "Hard contrast",
    "Hard high-contrast directional light creating sharp defined shadows with crisp edge transitions. Light source: focused direct source at steep angle. Shadows: deep black with razor edges. Temperature: neutral cool. Mood: dramatic, intense, noir-inspired tension"
   ],
   [
    "Neon practical",
    "Neon practical lighting with colored glow from visible in-scene sources like signs, tubes, screens. Light source: multiple colored practicals at different angles. Shadows: colored and overlapping. Temperature: mixed cyan, magenta, amber. Mood: urban, cyberpunk, nightlife energy"
   ],
   [
    "Backlit rim",
    "Strong backlight creating a luminous rim glow around the subject with soft lens flare. Light source: single powerful source directly behind subject. Shadows: subject face in shadow or fill. Temperature: varies by source. Mood: mysterious, angelic, revelatory"
   ],
   [
    "Low-key",
    "Low-key moody lighting with deep shadows and single concentrated light source. Light source: one hard directional light at 90 degrees. Shadows: 80% of frame in darkness. Temperature: cool to neutral. Mood: suspenseful, intimate, psychological"
   ],
   [
    "High-key",
    "High-key clean bright lighting with minimal shadow and even fill across the entire scene. Light source: multiple diffused sources from all angles. Shadows: nearly eliminated. Temperature: neutral to cool white. Mood: clean, optimistic, commercial, medical"
   ],
   [
    "Window daylight",
    "Soft natural daylight streaming through a window creating a cool diffused tone with gentle directional quality. Light source: overcast sky through glass. Shadows: soft gradient from window side. Temperature: cool blue-white. Mood: contemplative, peaceful, intimate"
   ],
   [
    "Candlelight",
    "Warm flickering candlelight creating intimate amber glow with dancing shadows. Light source: small open flames at subject level. Shadows: constantly shifting, soft-edged. Temperature: deep warm amber-orange. Mood: romantic, sacred, primal intimacy"
   ],
   [
    "Silhouette",
    "Strong backlight rendering the subject as a dark silhouette against a bright background. Light source: large bright source behind subject, no fill. Shadows: entire subject is shadow. Temperature: varies by background. Mood: mysterious, iconic, symbolic"
   ],
   [
    "Overcast",
    "Flat overcast daylight with soft shadowless tone creating even illumination from all directions. Light source: cloud-diffused sky. Shadows: barely visible. Temperature: cool blue-gray. Mood: melancholic, neutral, understated realism"
   ],
   [
    "Lens flare",
    "Dramatic directional light with cinematic lens flare streaks across the frame. Light source: bright point source at edge of frame hitting the lens. Shadows: hard directional. Temperature: warm gold to cool blue. Mood: epic, nostalgic, J.J. Abrams-inspired spectacle"
   ],
   [
    "Vintage soft",
    "Bathed in soft warm glow of late afternoon light. Fine grains settle subtly across the frame enriching tactile realism with a whisper of nostalgic depth, as if captured on delicate vintage film — evoking presence and poetry"
   ],
   [
    "Blue ambient",
    "Soft diffused blue ambient light with natural glow on skin. Light source: reflected blue sky or cool LED fill. Shadows: soft blue-tinted. Temperature: cool 6500K+. Mood: tranquil, dreamy, introspective, surreal sense of rebirth"
   ],
   [
    "Warm sunlight",
    "Natural warm sunlight with high contrast creating bold highlights on skin and water surfaces. Light source: direct midday sun. Shadows: hard and short. Temperature: warm neutral. Mood: energetic, vital, outdoor intensity"
   ],
   [
    "Dark dramatic",
    "Single directional beam of harsh cold light highlighting sweat and facial texture, strong contrast with pitch-dark surroundings. Light source: one focused spot from above or side. Shadows: everything outside beam is black. Mood: interrogation, revelation, raw vulnerability"
   ],
   [
    "Diffused daylight",
    "Diffused daylight through soft clouds creating no harsh shadows anywhere in frame. Light source: fully overcast sky acting as giant softbox. Shadows: virtually none. Temperature: neutral. Mood: gentle, calm, ethereal flatness"
   ],
   [
    "Harsh daylight",
    "Harsh desert daylight with strong shadows cast by sun high in the sky creating sharp highlights and deep shade on every surface. Light source: direct overhead sun. Shadows: short and very dark. Temperature: hot neutral-warm. Mood: exposed, brutal, unforgiving"
   ],
   [
    "Dual tone neon",
    "Strong dual-tone neon lighting with cool cyan from one side and warm magenta from the other, creating color separation on the subject face and body. Light source: two colored sources at opposing 45-degree angles. Shadows: colored on both sides. Mood: stylized, editorial, music-video aesthetic"
   ]
  ]
 },
 "time": {
  "title": "Time of day",
  "hint": "",
  "items": [
   [
    "Sunrise",
    "at sunrise, soft pink early light"
   ],
   [
    "Morning",
    "in soft morning light"
   ],
   [
    "Midday",
    "under bright midday sun, hard overhead light"
   ],
   [
    "Afternoon",
    "in warm afternoon light"
   ],
   [
    "Golden hour",
    "during golden hour, warm low sun"
   ],
   [
    "Sunset",
    "at sunset, rich orange sky"
   ],
   [
    "Blue hour",
    "at dusk during blue hour, cool ambient tone"
   ],
   [
    "Night",
    "at night, dark with artificial light"
   ],
   [
    "Midnight",
    "deep midnight darkness"
   ],
   [
    "Dawn",
    "at dawn, misty pale light"
   ]
  ]
 },
 "weather": {
  "title": "Weather / Atmosphere",
  "hint": "Weather & particles in the air.",
  "items": [
   [
    "Clear",
    "clear sky, crisp visibility"
   ],
   [
    "Light breeze",
    "a light breeze moving hair and fabric"
   ],
   [
    "Windy",
    "strong wind, hair and clothes blowing"
   ],
   [
    "Snow",
    "gentle falling snow"
   ],
   [
    "Snowstorm",
    "heavy snowstorm, low visibility"
   ],
   [
    "Rain",
    "steady rain, wet reflective surfaces"
   ],
   [
    "Downpour",
    "heavy downpour, water streaming"
   ],
   [
    "Thunderstorm",
    "thunderstorm with lightning flashes"
   ],
   [
    "Fog",
    "thick fog and mist, diffused depth"
   ],
   [
    "Heat haze",
    "shimmering heat haze in the air"
   ],
   [
    "Overcast",
    "overcast cloudy sky"
   ],
   [
    "Drizzle",
    "light drizzle, fine mist"
   ],
   [
    "Dust in light",
    "fine dust particles drifting through visible light beams"
   ],
   [
    "Steam",
    "steam rising and curling slowly, catching the light"
   ],
   [
    "God rays",
    "volumetric god rays breaking through, dust visible inside the beams"
   ],
   [
    "Volumetric fog",
    "low volumetric fog hugging the ground, light shafts cutting through"
   ],
   [
    "Floating particles",
    "tiny particles floating weightlessly through the air, catching highlights"
   ],
   [
    "Embers",
    "glowing embers and sparks drifting upward on warm air currents"
   ],
   [
    "Falling leaves",
    "autumn leaves falling and tumbling slowly through the frame"
   ]
  ]
 },
 "delivery": {
  "title": "Voice delivery",
  "hint": "Attaches to a character with voice.",
  "items": [
   [
    "Confident",
    "spoken in a confident, assured tone"
   ],
   [
    "Calm",
    "spoken calmly and softly"
   ],
   [
    "Hesitant",
    "spoken hesitantly, with uncertainty"
   ],
   [
    "Joyful",
    "spoken joyfully, with warmth"
   ],
   [
    "Whispering",
    "whispered, barely audible"
   ],
   [
    "Commanding",
    "commanding, authoritative delivery"
   ],
   [
    "Breathless",
    "breathless, urgent delivery"
   ],
   [
    "Intimate",
    "intimate, close and tender"
   ],
   [
    "Sarcastic",
    "dry sarcastic tone"
   ],
   [
    "Trembling",
    "trembling, emotional voice"
   ],
   [
    "Seductive",
    "low seductive tone"
   ],
   [
    "Urgent",
    "fast urgent delivery"
   ],
   [
    "Angry",
    "angry, raised voice"
   ],
   [
    "Deadpan",
    "flat deadpan delivery"
   ]
  ]
 },
 "music": {
  "title": "Music mood",
  "hint": "Intent only — final track in Premiere.",
  "items": [
   [
    "Uplifting",
    "uplifting inspiring score"
   ],
   [
    "Tense",
    "tense suspenseful score"
   ],
   [
    "Emotional",
    "emotional moving score"
   ],
   [
    "Driving",
    "driving rhythmic score"
   ],
   [
    "Minimal",
    "minimal sparse score"
   ],
   [
    "Cinematic swell",
    "building cinematic orchestral swell"
   ],
   [
    "Playful",
    "playful upbeat score"
   ],
   [
    "Dark ambient",
    "dark ambient drone"
   ],
   [
    "Epic orchestral",
    "epic orchestral score"
   ],
   [
    "Lo-fi",
    "mellow lo-fi beat"
   ],
   [
    "Suspense pulse",
    "pulsing suspense rhythm"
   ],
   [
    "Triumphant",
    "triumphant rising score"
   ]
  ]
 },
 "colorgrade": {
  "title": "Color grading",
  "hint": "Color treatment.",
  "items": [
   [
    "Earthy natural",
    "Earthy natural tones with muted greens, warm browns, and soft skin rendering. Saturation: moderate, favoring warm earth tones. Contrast: low to medium. Highlights: creamy warm. Shadows: olive-brown. Mood: organic, grounded, documentary warmth"
   ],
   [
    "Low contrast desat",
    "Cinematic reduced saturation and contrast creating a washed, faded aesthetic. Saturation: pulled 30-40% below normal. Contrast: flat, lifted blacks. Highlights: milky soft. Shadows: gray-blue never true black. Mood: contemplative, art-house, European cinema"
   ],
   [
    "Warm vintage",
    "Warm tones inspired by 1990s film stock with slight grain and soft contrast. Saturation: moderate warm push on reds and oranges. Contrast: low with lifted shadows. Highlights: amber-tinted. Shadows: warm brown. Mood: nostalgic, intimate, Kodak film memory"
   ],
   [
    "High contrast bold",
    "High contrast with ultra-sharp detail and bold color grading emphasizing orange and gold tones. Saturation: pushed on warm colors, pulled on cool. Contrast: aggressive with deep blacks. Highlights: blazing white-gold. Shadows: crushed black. Mood: powerful, premium, luxury commercial"
   ],
   [
    "Cool desaturated",
    "Cool desaturated palette with industrial grays and muted blue tones throughout. Saturation: heavily reduced, cold bias. Contrast: medium. Highlights: steel blue-white. Shadows: blue-gray. Mood: clinical, dystopian, Fincher-esque corporate tension"
   ],
   [
    "Neon vivid",
    "Vivid neon color grade with high saturation on accent colors against deep rich blacks. Saturation: extreme on neons, normal on neutrals. Contrast: very high. Highlights: electric color. Shadows: crushed to pure black. Mood: nightlife, cyberpunk, music video energy"
   ],
   [
    "Teal and orange",
    "Classic Hollywood teal-and-orange complementary grade. Saturation: pushed on both teal shadows and orange highlights. Contrast: high. Highlights: warm orange skin tones. Shadows: cool teal-blue. Mood: blockbuster cinema, action, thriller"
   ],
   [
    "Bleach bypass",
    "Bleach bypass silver-retained look with desaturated color and metallic contrast. Saturation: reduced 50%. Contrast: extreme with silvery midtones. Highlights: harsh metallic. Shadows: deep and heavy. Mood: war, gritty realism, Saving Private Ryan aesthetic"
   ],
   [
    "Cross process",
    "Cross-processed color shift with unexpected color casts and shifted tones. Saturation: moderate with wrong-color bias. Contrast: medium-high. Highlights: shifted green or magenta. Shadows: shifted opposite. Mood: experimental, fashion editorial, lo-fi artistic"
   ],
   [
    "Monochrome",
    "Black and white monochrome with full tonal range from pure white to deep black. Saturation: zero. Contrast: adjustable from soft to extreme. Highlights: clean white. Shadows: rich black. Mood: timeless, dramatic, fine art, classic cinema"
   ]
  ]
 }
}

export const CAM_GROUPS: Record<string, string[]> = {
 "Pan / Tilt": [
  "Static",
  "Pan right",
  "Pan left",
  "Whip pan right",
  "Whip pan left",
  "Tilt up",
  "Tilt down"
 ],
 "Zoom": [
  "Slow zoom in",
  "Slow zoom out",
  "Fast zoom in",
  "Fast zoom out",
  "Crash zoom in",
  "Crash zoom out"
 ],
 "Dolly / Slider": [
  "Dolly in",
  "Dolly out",
  "Truck right",
  "Truck left",
  "Pedestal up",
  "Pedestal down",
  "Slider right",
  "Slider left",
  "Push past",
  "Arc right",
  "Arc left"
 ],
 "Orbit / Tracking": [
  "Orbit clockwise",
  "Orbit counterclockwise",
  "Tracking shot",
  "Follow shot OTS",
  "Reverse tracking",
  "Side tracking",
  "Low tracking",
  "Vehicle tracking",
  "Chase shot"
 ],
 "Handheld / Human": [
  "Handheld",
  "Handheld raw",
  "Camcorder",
  "Vlog camera",
  "Snorricam",
  "First-person POV"
 ],
 "Crane / Aerial": [
  "Crane up",
  "Crane down",
  "Drone push in",
  "Drone pull back",
  "FPV drone",
  "Helicopter"
 ],
 "Specials": [
  "Tilt-shift miniature",
  "Infinite zoom",
  "Earth zoom out",
  "Time-lapse",
  "Pass-through"
 ]
}

export const FACE_EMO: EngineItem[] = [
 [
  "😊",
  "breaks into a genuine warm smile"
 ],
 [
  "😄",
  "laughs openly, eyes crinkling"
 ],
 [
  "😢",
  "eyes glisten, fighting back tears"
 ],
 [
  "😭",
  "tears roll down the cheeks, breath shaking"
 ],
 [
  "😡",
  "jaw tightens, nostrils flare with contained rage"
 ],
 [
  "😱",
  "eyes widen in terror, breath catches"
 ],
 [
  "😨",
  "a flicker of fear crosses the face"
 ],
 [
  "😏",
  "a subtle smirk at the corner of the mouth"
 ],
 [
  "🤔",
  "brow furrows in thought, eyes narrowing slightly"
 ],
 [
  "😐",
  "face goes perfectly still, unreadable deadpan"
 ],
 [
  "🥱",
  "blinks slowly, eyes heavy with exhaustion"
 ],
 [
  "😌",
  "shoulders drop, face softens with relief"
 ],
 [
  "🫨",
  "trembling slightly, barely holding composure"
 ],
 [
  "😍",
  "eyes light up with adoration"
 ],
 [
  "🤨",
  "one eyebrow raises in doubt"
 ],
 [
  "😤",
  "inhales sharply, determination hardening in the eyes"
 ]
]

export const VOICE_EMO: Record<string, string> = {
 "Confident": "😎",
 "Calm": "😌",
 "Hesitant": "😬",
 "Joyful": "😄",
 "Whispering": "🤫",
 "Commanding": "🫡",
 "Breathless": "😮‍💨",
 "Intimate": "🥰",
 "Sarcastic": "🙄",
 "Trembling": "🫨",
 "Seductive": "😏",
 "Urgent": "⚡",
 "Angry": "😡",
 "Deadpan": "😑"
}

export const PHYS: Record<string, string> = {
 "Rain": "rain",
 "Downpour": "rain",
 "Thunderstorm": "rain",
 "Drizzle": "rain",
 "Snow": "snow",
 "Snowstorm": "snow",
 "Windy": "wind and fabric",
 "Fog": "fog",
 "Heat haze": "heat distortion"
}

export const GEN_ASPECTS: string[] = ["16:9","9:16","1:1","4:3","3:4","21:9"]

export const MASTER_PRESET: string = "Style: 8K IMAX photorealism, captured in-camera on physical cine glass. Lighting: natural light only — contre-jour backlight, camera on the shadow side, atmospheric haze throughout; key light from sky and windows. Color: 60:30:10 dominant / secondary / accent palette. Camera: physical cine lens, 180° shutter motion blur. Skin: pore-level realism — vellus hair, asymmetric moles, capillary flush, pore shadows matching the on-set light. Acting: Hollywood-grade — micro-pauses before reactions, precise eye-lines, living eyes with catch-lights, chest rising with breath. Physics: gravity and inertia respected — every object has real weight, grounded with correct contact shadows. Composition: rule of thirds and golden ratio; every person in motion from frame one. Continuity: characters, props and environment stay identical across every cut, locked identity. Technical: smooth 24fps motion, 8K detail, rock-steady image. Audio: environmental diegetic SFX only."
