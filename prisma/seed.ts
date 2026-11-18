import { mkdir, writeFile } from "node:fs/promises";
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
        },
        create: {
          email: user.email,
          name: user.name,
          role: user.role,
          passwordHash,
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
  await writeFile(
    path.join(demoDir, "aurelia-brief.docx"),
    await Packer.toBuffer(doc),
  );

  return brand;
}

async function main() {
  const seededUsers = await seedUsers();
  const admin = seededUsers.find((user) => user.role === "ADMIN");

  if (!admin) {
    throw new Error("Admin seed user was not created.");
  }

  const brand = await seedDemoBrand(admin.id);

  console.log("");
  console.log("VETTO seed complete");
  console.log(`Brand: ${brand.name} (${brand.slug})`);
  console.log(`Demo assets: public/demo/aurelia-poster.png, public/demo/aurelia-brief.docx`);
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
