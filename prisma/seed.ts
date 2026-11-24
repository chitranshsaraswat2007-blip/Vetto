import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import sharp from "sharp";

const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? "Vetto!Dev123";
const DEMO_BRAND_SLUG = "aurelia-coffee";

if (process.env.NODE_ENV === "production") {
  if (process.env.VETTO_ALLOW_DEMO_SEED_IN_PRODUCTION !== "true") {
    throw new Error(
      "Demo seed is disabled in production. Set VETTO_ALLOW_DEMO_SEED_IN_PRODUCTION=true only for an intentional demo deployment.",
    );
  }

  if (!process.env.SEED_PASSWORD || process.env.SEED_PASSWORD.length < 16) {
    throw new Error(
      "Production demo seeding requires a custom SEED_PASSWORD of at least 16 characters.",
    );
  }
}

const prisma = new PrismaClient();

const users: Array<{ email: string; name: string; role: Role }> = [
  { email: "admin@vetto.test", name: "Avery Stone", role: "ADMIN" },
  { email: "manager@vetto.test", name: "Mara Quinn", role: "MANAGER" },
  { email: "supervisor@vetto.test", name: "Soren Hall", role: "SUPERVISOR" },
  { email: "creator@vetto.test", name: "Nina Vale", role: "CREATOR" },
];

async function seedUsers() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const seeded = [];

  for (const user of users) {
    seeded.push(
      await prisma.user.upsert({
        where: { email: user.email },
        update: {
          name: user.name,
          role: user.role,
          isActive: true,
          passwordHash,
          emailVerifiedAt: new Date(),
        },
        create: {
          email: user.email,
          name: user.name,
          role: user.role,
          passwordHash,
          emailVerifiedAt: new Date(),
        },
      }),
    );
  }

  return seeded;
}

function aureliaLogoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="200" viewBox="0 0 640 200">
    <rect width="640" height="200" fill="#3B2A20" rx="12"/>
    <circle cx="92" cy="100" r="44" fill="none" stroke="#C98A5B" stroke-width="7"/>
    <path d="M64 124 L92 64 L120 124 M74 104 H110" fill="none" stroke="#F3E8DA" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="164" y="96" font-family="Georgia, serif" font-size="48" letter-spacing="8" fill="#F3E8DA">AURELIA</text>
    <text x="166" y="130" font-family="Arial, sans-serif" font-size="16" letter-spacing="6" fill="#C98A5B">COFFEE ROASTERS</text>
  </svg>`;
}

function aureliaPosterSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
    <rect width="1080" height="1350" fill="#F3E8DA"/>
    <rect x="0" y="0" width="1080" height="310" fill="#3B2A20"/>
    <rect x="0" y="1180" width="1080" height="170" fill="#C98A5B"/>
    <rect x="796" y="420" width="210" height="210" rx="8" fill="#1E6FFF"/>
    <circle cx="878" cy="886" r="104" fill="#5C6B4A"/>
    <text x="72" y="126" font-family="Georgia, serif" font-size="44" letter-spacing="12" fill="#F3E8DA">AURELIA</text>
    <text x="72" y="170" font-family="Arial, sans-serif" font-size="18" letter-spacing="7" fill="#C98A5B">COFFEE ROASTERS</text>
    <text x="72" y="420" font-family="Georgia, serif" font-size="132" fill="#3B2A20">Winter</text>
    <text x="72" y="550" font-family="Georgia, serif" font-size="132" fill="#3B2A20">Roast</text>
    <text x="72" y="660" font-family="Arial, sans-serif" font-size="38" fill="#3B2A20">The best coffee in the city —</text>
    <text x="72" y="712" font-family="Arial, sans-serif" font-size="38" fill="#3B2A20">scientifically proven.</text>
    <text x="72" y="820" font-family="Arial, sans-serif" font-size="28" fill="#5C6B4A">New seasonal blend. Available now.</text>
    <text x="72" y="1270" font-family="Georgia, serif" font-size="34" fill="#3B2A20">Aurelia Coffee Roasters · Winter 2026</text>
  </svg>`;
}

async function seedDemoBrand(adminId: string) {
  const brand = await prisma.brand.upsert({
    where: { slug: DEMO_BRAND_SLUG },
    update: {
      name: "Aurelia Coffee Roasters",
      description:
        "Seeded demo brand used to exercise VETTO extraction, analysis, and review workflows.",
      status: "ACTIVE",
      isDemo: true,
    },
    create: {
      name: "Aurelia Coffee Roasters",
      slug: DEMO_BRAND_SLUG,
      description:
        "Seeded demo brand used to exercise VETTO extraction, analysis, and review workflows.",
      status: "ACTIVE",
      isDemo: true,
      createdById: adminId,
    },
  });

  await prisma.brandProfile.upsert({
    where: { brandId: brand.id },
    update: {
      description:
        "A specialty coffee roaster with a warm, editorial voice and a tactile visual system.",
      personality: ["warm", "considered", "crafted", "quietly confident"],
      tone: "Warm, precise, and understated. Never hyperbolic.",
      visualStyle:
        "Editorial layouts, generous margins, tactile paper textures, serif headlines.",
      imageryStyle:
        "Natural light, close crops of coffee texture, honest product photography.",
      designDirection:
        "Espresso brown and oat neutrals with restrained caramel accents. Avoid saturated primary colors.",
    },
    create: {
      brandId: brand.id,
      description:
        "A specialty coffee roaster with a warm, editorial voice and a tactile visual system.",
      personality: ["warm", "considered", "crafted", "quietly confident"],
      tone: "Warm, precise, and understated. Never hyperbolic.",
      visualStyle:
        "Editorial layouts, generous margins, tactile paper textures, serif headlines.",
      imageryStyle:
        "Natural light, close crops of coffee texture, honest product photography.",
      designDirection:
        "Espresso brown and oat neutrals with restrained caramel accents. Avoid saturated primary colors.",
    },
  });

  await prisma.brandColor.deleteMany({ where: { brandId: brand.id } });
  await prisma.brandColor.createMany({
    data: [
      {
        brandId: brand.id,
        hex: "#3B2A20",
        name: "Espresso",
        usage: "Primary text and deep surfaces",
        isPrimary: true,
      },
      {
        brandId: brand.id,
        hex: "#C98A5B",
        name: "Caramel",
        usage: "Accent and editorial highlights",
      },
      {
        brandId: brand.id,
        hex: "#F3E8DA",
        name: "Oat",
        usage: "Primary background",
      },
      {
        brandId: brand.id,
        hex: "#5C6B4A",
        name: "Olive",
        usage: "Secondary accent",
      },
    ],
  });

  await prisma.brandFont.deleteMany({ where: { brandId: brand.id } });
  await prisma.brandFont.createMany({
    data: [
      {
        brandId: brand.id,
        name: "Fraunces",
        usage: "Display headlines and editorial titles",
        isApproved: true,
      },
      {
        brandId: brand.id,
        name: "Inter",
        usage: "Body copy, labels, and interface text",
        isApproved: true,
      },
    ],
  });

  await prisma.brandRule.deleteMany({ where: { brandId: brand.id } });
  await prisma.brandRule.createMany({
    data: [
      {
        brandId: brand.id,
        name: "No unsubstantiated proof claims",
        category: "CONTENT",
        description:
          "Content must not claim scientific or objective proof without an approved source.",
        ruleType: "FORBIDDEN_PHRASE",
        severity: "HIGH",
        keyword: "scientifically proven",
      },
      {
        brandId: brand.id,
        name: "Offers require a terms disclaimer",
        category: "COMPLIANCE",
        description:
          "Promotional content must include the approved disclaimer 'Terms apply.'",
        ruleType: "REQUIRED_DISCLAIMER",
        severity: "HIGH",
        keyword: "Terms apply.",
      },
      {
        brandId: brand.id,
        name: "Keep the brand name present",
        category: "BRAND_IDENTITY",
        description:
          "The brand name should appear in customer-facing content.",
        ruleType: "REQUIRED_PHRASE",
        severity: "LOW",
        keyword: "Aurelia",
      },
      {
        brandId: brand.id,
        name: "Avoid miracle and cure claims",
        category: "COMPLIANCE",
        description:
          "Do not use guarantee, miracle, or cure language around coffee or health.",
        ruleType: "CLAIM_RESTRICTION",
        severity: "MEDIUM",
        pattern: "\\b(guaranteed|miracle|cures?)\\b",
      },
      {
        brandId: brand.id,
        name: "Maintain the Aurelia tone",
        category: "BRAND_VIBE",
        description:
          "Voice should feel warm, precise, and quietly confident rather than loud or hyped.",
        ruleType: "TONE",
        severity: "LOW",
      },
    ],
  });

  const uploadsRoot = path.resolve(
    process.env.LOCAL_STORAGE_ROOT ?? path.join(process.cwd(), ".uploads"),
  );
  const logoDir = path.join(uploadsRoot, "brands", "demo");
  await mkdir(logoDir, { recursive: true });
  const logoKey = "brands/demo/aurelia-logo.png";
  await writeFile(
    path.join(uploadsRoot, logoKey),
    await sharp(Buffer.from(aureliaLogoSvg())).png().toBuffer(),
  );

  await prisma.brandAsset.deleteMany({ where: { brandId: brand.id } });
  await prisma.brandAsset.create({
    data: {
      brandId: brand.id,
      kind: "LOGO",
      name: "Aurelia primary logo",
      storageKey: logoKey,
      storageProvider: "local",
      mimeType: "image/png",
      variant: "primary, dark background",
      approvalStatus: "APPROVED",
      uploadedById: adminId,
    },
  });

  const demoDir = path.join(process.cwd(), "public", "demo");
  await mkdir(demoDir, { recursive: true });
  await writeFile(
    path.join(demoDir, "aurelia-poster.png"),
    await sharp(Buffer.from(aureliaPosterSvg())).png().toBuffer(),
  );

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: "Aurelia Winter Campaign Brief",
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            children: [
              new TextRun(
                "Aurelia Coffee Roasters is introducing its winter seasonal blend.",
              ),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun(
                "The campaign will run across the newsletter, in-store signage, and the website.",
              ),
            ],
          }),
          new Paragraph({
            text: "Important claims",
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            children: [
              new TextRun(
                "The blend is scientifically proven to improve focus, according to the campaign draft.",
              ),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun(
                "Seasonal stock is limited. Please confirm final offer language with the brand team.",
              ),
            ],
          }),
        ],
      },
    ],
  });
  const aureliaBriefPath = path.join(demoDir, "aurelia-brief.docx");
  try {
    await access(aureliaBriefPath);
  } catch {
    await writeFile(aureliaBriefPath, await Packer.toBuffer(doc));
  }

  return brand;
}

type AdditionalDemoBrand = {
  name: string;
  slug: string;
  description: string;
  profile: {
    description: string;
    personality: string[];
    tone: string;
    visualStyle: string;
    imageryStyle: string;
    designDirection: string;
  };
  colors: Array<{ hex: string; name: string; usage: string; isPrimary?: boolean }>;
  fonts: Array<{ name: string; usage: string }>;
  rules: Array<{
    name: string;
    category: "BRAND_IDENTITY" | "COMPLIANCE" | "CONTENT";
    description: string;
    ruleType: "REQUIRED_PHRASE" | "FORBIDDEN_PHRASE" | "REQUIRED_DISCLAIMER" | "CLAIM_RESTRICTION";
    severity: "HIGH" | "MEDIUM" | "LOW";
    keyword?: string;
    pattern?: string;
  }>;
  logoSvg: string;
  campaignSvg: string;
  briefTitle: string;
  briefParagraphs: string[];
};

const additionalDemoBrands: AdditionalDemoBrand[] = [
  {
    name: "Luma Field Botanicals",
    slug: "luma-field-botanicals",
    description: "A fictional botanical skincare brand for testing product claims and visual guidance.",
    profile: {
      description: "A thoughtful, plant-forward skincare studio with a calm, evidence-aware voice.",
      personality: ["calm", "clear", "botanical", "considered"],
      tone: "Gentle and informative. Avoid medical promises, pressure, and perfection language.",
      visualStyle: "Soft daylight, tactile glass, quiet typography, and generous negative space.",
      imageryStyle: "Editorial botanical still life with leaves, glass jars, and natural window light.",
      designDirection: "Sage, pale clay, and warm cream. Keep contrast readable and accents restrained.",
    },
    colors: [
      { hex: "#34483D", name: "Forest", usage: "Primary text and marks", isPrimary: true },
      { hex: "#A8B69A", name: "Sage", usage: "Secondary accent" },
      { hex: "#F4EFE5", name: "Oat Milk", usage: "Primary background" },
      { hex: "#C98972", name: "Clay", usage: "Warm accent" },
    ],
    fonts: [
      { name: "DM Serif Display", usage: "Display headlines" },
      { name: "Inter", usage: "Body copy and labels" },
    ],
    rules: [
      { name: "Use the brand name", category: "BRAND_IDENTITY", description: "Customer-facing content must identify the brand.", ruleType: "REQUIRED_PHRASE", severity: "LOW", keyword: "Luma Field" },
      { name: "Avoid medical treatment claims", category: "COMPLIANCE", description: "Do not claim to diagnose, treat, cure, or prevent a medical condition.", ruleType: "FORBIDDEN_PHRASE", severity: "HIGH", keyword: "cures eczema" },
      { name: "No unverified clinical proof", category: "COMPLIANCE", description: "Clinical proof claims require approved substantiation.", ruleType: "FORBIDDEN_PHRASE", severity: "HIGH", keyword: "clinically proven" },
      { name: "Include the results disclaimer", category: "COMPLIANCE", description: "Skincare campaign copy must set realistic expectations.", ruleType: "REQUIRED_DISCLAIMER", severity: "MEDIUM", keyword: "Individual results may vary." },
    ],
    logoSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="200" viewBox="0 0 640 200"><rect width="640" height="200" rx="20" fill="#34483D"/><circle cx="94" cy="100" r="43" fill="none" stroke="#A8B69A" stroke-width="5"/><path d="M94 132c-30-13-31-45 0-67 27 23 27 49 0 67Zm0-4V76" fill="none" stroke="#F4EFE5" stroke-width="5" stroke-linecap="round"/><text x="164" y="105" font-family="Georgia,serif" font-size="46" letter-spacing="4" fill="#F4EFE5">LUMA FIELD</text><text x="168" y="139" font-family="Arial,sans-serif" font-size="15" letter-spacing="6" fill="#A8B69A">BOTANICALS</text></svg>`,
    campaignSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><rect width="1080" height="1350" fill="#F4EFE5"/><circle cx="875" cy="285" r="230" fill="#DCE3D4"/><path d="M790 620c60-220 206-252 220-246-10 184-111 284-220 246Zm20 20c-60-165-189-198-205-189 15 148 100 223 205 189Z" fill="#A8B69A"/><rect x="390" y="575" width="300" height="380" rx="42" fill="#E8D9C6"/><rect x="426" y="619" width="228" height="292" rx="20" fill="#E9E3D6" stroke="#D6C8B4" stroke-width="4"/><rect x="470" y="531" width="140" height="55" rx="14" fill="#34483D"/><text x="540" y="747" text-anchor="middle" font-family="Georgia,serif" font-size="36" fill="#34483D">LUMA FIELD</text><text x="540" y="790" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" letter-spacing="3" fill="#687768">BOTANICAL BALM</text><text x="74" y="112" font-family="Arial,sans-serif" font-size="24" letter-spacing="8" fill="#34483D">LUMA FIELD · DAILY RITUALS</text><text x="74" y="1060" font-family="Georgia,serif" font-size="88" fill="#34483D">A softer start</text><text x="74" y="1155" font-family="Georgia,serif" font-size="88" fill="#34483D">for your skin.</text><text x="78" y="1220" font-family="Arial,sans-serif" font-size="28" fill="#687768">A gentle botanical balm for everyday care.</text><rect x="0" y="1295" width="1080" height="55" fill="#A8B69A"/></svg>`,
    briefTitle: "Luma Field Daily Balm Campaign",
    briefParagraphs: [
      "Luma Field Botanicals is preparing an educational launch for its daily botanical balm.",
      "The draft below intentionally includes a claim that needs review and omits the approved results disclaimer, so judges can see the findings workflow.",
      "Draft claim for review: Clinically proven to cure eczema overnight. The final copy should describe the product as a simple daily moisturizing ritual.",
      "Required disclaimer: Individual results may vary.",
    ],
  },
  {
    name: "Trailform Outdoor Co.",
    slug: "trailform-outdoor",
    description: "A fictional outdoor equipment brand for testing product performance claims and campaign assets.",
    profile: {
      description: "A practical outdoor gear company for people who value repairable kit and honest field notes.",
      personality: ["capable", "grounded", "curious", "responsible"],
      tone: "Direct, useful, and optimistic. Never promise that gear is indestructible or risk-free.",
      visualStyle: "Field photography, clear utility labels, topographic details, and sturdy layouts.",
      imageryStyle: "Natural mountain light, honest weather, trail scenes, and used-but-cared-for equipment.",
      designDirection: "Deep pine, sky, and stone with a signal-orange accent used sparingly.",
    },
    colors: [
      { hex: "#203B35", name: "Pine", usage: "Primary text and surfaces", isPrimary: true },
      { hex: "#E2A15C", name: "Signal", usage: "Important highlights" },
      { hex: "#E9E6DC", name: "Stone", usage: "Background" },
      { hex: "#7897A0", name: "Alpine Sky", usage: "Secondary accent" },
    ],
    fonts: [
      { name: "Barlow Condensed", usage: "Campaign headlines and labels" },
      { name: "Inter", usage: "Product details and body copy" },
    ],
    rules: [
      { name: "Name Trailform in every campaign", category: "BRAND_IDENTITY", description: "Make the source brand clear on each customer-facing asset.", ruleType: "REQUIRED_PHRASE", severity: "LOW", keyword: "Trailform" },
      { name: "Avoid absolute weather guarantees", category: "COMPLIANCE", description: "Do not promise that equipment is completely waterproof in every condition.", ruleType: "FORBIDDEN_PHRASE", severity: "HIGH", keyword: "100% waterproof forever" },
      { name: "Keep safety claims evidence-based", category: "COMPLIANCE", description: "Safety and performance claims must be specific and supported by approved test results.", ruleType: "CLAIM_RESTRICTION", severity: "MEDIUM", pattern: "\\b(indestructible|risk[- ]free|guaranteed protection)\\b" },
      { name: "State the care limitation", category: "CONTENT", description: "Water-resistant gear copy must direct customers to the care guide.", ruleType: "REQUIRED_PHRASE", severity: "MEDIUM", keyword: "See the care guide for limits." },
    ],
    logoSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="200" viewBox="0 0 640 200"><rect width="640" height="200" rx="20" fill="#203B35"/><path d="M55 139 98 60l43 79H55Zm24-35h38" fill="none" stroke="#E2A15C" stroke-width="7" stroke-linejoin="round"/><text x="170" y="106" font-family="Arial,sans-serif" font-size="42" font-weight="700" letter-spacing="3" fill="#E9E6DC">TRAILFORM</text><text x="173" y="139" font-family="Arial,sans-serif" font-size="15" letter-spacing="6" fill="#7897A0">OUTDOOR CO.</text></svg>`,
    campaignSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><rect width="1080" height="1350" fill="#E9E6DC"/><path d="M0 745 206 484l145 167 180-310 228 287 137-167 184 204v310H0Z" fill="#7897A0"/><path d="m0 830 212-202 174 164 181-185 172 192 155-142 186 164v520H0Z" fill="#203B35"/><circle cx="850" cy="235" r="82" fill="#E2A15C"/><path d="M72 106h936" stroke="#203B35" stroke-width="3" opacity=".35"/><text x="74" y="165" font-family="Arial,sans-serif" font-size="24" letter-spacing="8" fill="#203B35">TRAILFORM · FIELD NOTES 04</text><text x="74" y="1010" font-family="Arial,sans-serif" font-size="98" font-weight="700" letter-spacing="2" fill="#E9E6DC">TAKE THE</text><text x="74" y="1110" font-family="Arial,sans-serif" font-size="98" font-weight="700" letter-spacing="2" fill="#E9E6DC">LONG WAY.</text><text x="78" y="1182" font-family="Arial,sans-serif" font-size="28" fill="#E9E6DC">Repairable trail layers. Made for the miles ahead.</text><rect x="74" y="1230" width="275" height="62" rx="31" fill="#E2A15C"/><text x="211" y="1270" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="700" letter-spacing="2" fill="#203B35">SEE THE FIELD KIT</text></svg>`,
    briefTitle: "Trailform Alpine Shell Launch Brief",
    briefParagraphs: [
      "Trailform Outdoor Co. is preparing a launch campaign for its Alpine Shell trail jacket.",
      "This sample includes a deliberately overbroad performance claim for the review workflow.",
      "Draft claim for review: Our new shell is 100% waterproof forever and guarantees protection in every storm.",
      "Approved direction: Explain the tested water resistance plainly and direct customers to the product care guide.",
      "Required copy: See the care guide for limits.",
    ],
  },
];

async function seedAdditionalDemoBrands(adminId: string) {
  const uploadsRoot = path.resolve(
    process.env.LOCAL_STORAGE_ROOT ?? path.join(process.cwd(), ".uploads"),
  );
  const demoDir = path.join(process.cwd(), "public", "demo");
  await mkdir(demoDir, { recursive: true });

  for (const config of additionalDemoBrands) {
    const brand = await prisma.brand.upsert({
      where: { slug: config.slug },
      update: { name: config.name, description: config.description, status: "ACTIVE", isDemo: true },
      create: { name: config.name, slug: config.slug, description: config.description, status: "ACTIVE", isDemo: true, createdById: adminId },
    });

    await prisma.brandProfile.upsert({
      where: { brandId: brand.id },
      update: config.profile,
      create: { brandId: brand.id, ...config.profile },
    });

    await prisma.brandColor.deleteMany({ where: { brandId: brand.id } });
    await prisma.brandColor.createMany({ data: config.colors.map((color) => ({ ...color, brandId: brand.id })) });
    await prisma.brandFont.deleteMany({ where: { brandId: brand.id } });
    await prisma.brandFont.createMany({ data: config.fonts.map((font) => ({ ...font, brandId: brand.id, isApproved: true })) });
    await prisma.brandRule.deleteMany({ where: { brandId: brand.id } });
    await prisma.brandRule.createMany({ data: config.rules.map((rule) => ({ ...rule, brandId: brand.id })) });

    const assetDirectory = path.join(uploadsRoot, "brands", "demo", config.slug);
    await mkdir(assetDirectory, { recursive: true });
    const logoKey = `brands/demo/${config.slug}/logo.png`;
    const campaignKey = `brands/demo/${config.slug}/campaign.png`;
    await writeFile(path.join(uploadsRoot, logoKey), await sharp(Buffer.from(config.logoSvg)).png().toBuffer());
    await writeFile(path.join(uploadsRoot, campaignKey), await sharp(Buffer.from(config.campaignSvg)).png().toBuffer());
    await prisma.brandAsset.deleteMany({ where: { brandId: brand.id } });
    await prisma.brandAsset.createMany({
      data: [
        { brandId: brand.id, kind: "LOGO", name: `${config.name} primary logo`, storageKey: logoKey, storageProvider: "local", mimeType: "image/png", variant: "Primary brand mark", approvalStatus: "APPROVED", uploadedById: adminId },
        { brandId: brand.id, kind: "IMAGERY", name: `${config.name} launch campaign artwork`, storageKey: campaignKey, storageProvider: "local", mimeType: "image/png", variant: "Portrait campaign artwork", approvalStatus: "APPROVED", uploadedById: adminId },
      ],
    });

  }

  await writeAdditionalDemoFiles(demoDir);
}

async function writeAdditionalDemoFiles(demoDir = path.join(process.cwd(), "public", "demo")) {
  await mkdir(demoDir, { recursive: true });
  for (const config of additionalDemoBrands) {
    await writeFile(path.join(demoDir, `${config.slug}-campaign.png`), await sharp(Buffer.from(config.campaignSvg)).png().toBuffer());
    const brief = new Document({
      sections: [{ children: [
        new Paragraph({ text: config.briefTitle, heading: HeadingLevel.HEADING_1 }),
        ...config.briefParagraphs.map((text) => new Paragraph({ children: [new TextRun(text)] })),
        new Paragraph({ text: "Judge walkthrough", heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ children: [new TextRun("Upload the campaign artwork or this brief under its matching brand. Compare extracted text and visual signals with the active rules, then send the result through Creator, Manager, and Supervisor review.")] }),
      ] }],
    });
    await writeFile(path.join(demoDir, `${config.slug}-brief.docx`), await Packer.toBuffer(brief));
  }
}

async function main() {
  if (process.env.DEMO_FILES_ONLY === "true") {
    await writeAdditionalDemoFiles();
    console.log("Generated additional campaign PNG and brief DOCX files in public/demo.");
    return;
  }

  if (process.env.DEMO_BRANDS_ONLY === "true") {
    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });

    if (!admin) {
      throw new Error("Create or seed an Admin account before running DEMO_BRANDS_ONLY=true.");
    }

    await seedAdditionalDemoBrands(admin.id);
    console.log(`Added demo brands: ${additionalDemoBrands.map((item) => item.name).join(", ")}`);
    console.log("Generated campaign PNG and brief DOCX files in public/demo.");
    return;
  }

  const seededUsers = await seedUsers();
  const admin = seededUsers.find((user) => user.role === "ADMIN");

  if (!admin) {
    throw new Error("Admin seed user was not created.");
  }

  const brand = await seedDemoBrand(admin.id);
  await seedAdditionalDemoBrands(admin.id);

  console.log("");
  console.log("VETTO seed complete");
  console.log(`Brand: ${brand.name} (${brand.slug})`);
  console.log(`Brands: ${brand.name}, ${additionalDemoBrands.map((item) => item.name).join(", ")}`);
  console.log("Demo files: public/demo/aurelia-poster.png, public/demo/aurelia-offer.pdf, public/demo/aurelia-brief.docx, plus campaign PNG and DOCX files for the other demo brands.");
  console.log("");
  console.log("Development accounts");
  for (const user of seededUsers) {
    console.log(`- ${user.role.padEnd(8)} ${user.email}`);
  }
  console.log(`Shared password: ${DEMO_PASSWORD}`);
  console.log("");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
