import sharp from 'sharp';
import { mkdir, copyFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const logoPath = join(projectRoot, 'src/assets/images/logo.jpeg');
const androidRes = join(projectRoot, 'android/app/src/main/res');

const iconSizes = {
  'mipmap-mdpi': { icon: 48, foreground: 108 },
  'mipmap-hdpi': { icon: 72, foreground: 162 },
  'mipmap-xhdpi': { icon: 96, foreground: 216 },
  'mipmap-xxhdpi': { icon: 144, foreground: 324 },
  'mipmap-xxxhdpi': { icon: 192, foreground: 432 },
};

async function generateIcons() {
  const logo = sharp(logoPath);
  const metadata = await logo.metadata();
  console.log('Logo dimensions:', metadata.width, 'x', metadata.height);

  // Create a square icon with logo centered on white background
  const squareSize = 1024;
  const logoWidth = Math.floor(squareSize * 0.6); // Logo takes 60% of width
  const logoHeight = Math.floor(logoWidth * (metadata.height / metadata.width));
  console.log('Resized logo:', logoWidth, 'x', logoHeight);

  const resizedLogo = await sharp(logoPath)
    .resize(logoWidth, logoHeight)
    .toBuffer();

  const squareIcon = await sharp({
    create: {
      width: squareSize,
      height: squareSize,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
    .composite([{
      input: resizedLogo,
      gravity: 'center'
    }])
    .png()
    .toBuffer();

  // Generate icons for each density
  for (const [folder, sizes] of Object.entries(iconSizes)) {
    const destFolder = join(androidRes, folder);

    // Regular icon
    await sharp(squareIcon)
      .resize(sizes.icon, sizes.icon)
      .png()
      .toFile(join(destFolder, 'ic_launcher.png'));

    // Round icon (same as regular for now)
    await sharp(squareIcon)
      .resize(sizes.icon, sizes.icon)
      .png()
      .toFile(join(destFolder, 'ic_launcher_round.png'));

    // Foreground for adaptive icon (needs padding - logo in center 50% of space)
    const fgLogoWidth = Math.floor(sizes.foreground * 0.5);
    const fgLogoHeight = Math.floor(fgLogoWidth * 0.4);

    const fgLogo = await sharp(logoPath)
      .resize(fgLogoWidth, fgLogoHeight, { fit: 'inside' })
      .toBuffer();

    await sharp({
      create: {
        width: sizes.foreground,
        height: sizes.foreground,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      }
    })
      .composite([{
        input: fgLogo,
        gravity: 'center'
      }])
      .png()
      .toFile(join(destFolder, 'ic_launcher_foreground.png'));

    console.log(`Generated icons for ${folder}`);
  }

  console.log('All icons generated!');
}

generateIcons().catch(console.error);
