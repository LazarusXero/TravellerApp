import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const files = [
    'items_ammunition.json',
    'items_armor.json',
    'items_equipment.json',
    'items_weapons.json',
  ];

  console.log('Clearing Item table...');
  await prisma.item.deleteMany();
  console.log('Item table cleared.');

  let totalInserted = 0;

  for (const file of files) {
    const filePath = path.join(__dirname, '../../../temp', file);

    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      continue;
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const items = JSON.parse(raw);

    console.log(`\nProcessing ${file}: ${items.length} items`);

    let inserted = 0;
    let failed = 0;

    // Insert in batches of 100
    for (let i = 0; i < items.length; i += 100) {
      const batch = items.slice(i, i + 100);
      try {
        const result = await prisma.item.createMany({ data: batch });
        inserted += result.count;
      } catch (err) {
        console.error(`Batch error at index ${i}:`, err);
        // Fall back to row-by-row for this batch to identify the bad row
        for (const item of batch) {
          try {
            await prisma.item.create({ data: item });
            inserted++;
          } catch (rowErr) {
            console.error(`Failed row: ${item.name}`, rowErr);
            failed++;
          }
        }
      }
    }

    console.log(`  Inserted: ${inserted}, Failed: ${failed}`);
    totalInserted += inserted;
  }

  console.log(`\nDone. Total items inserted: ${totalInserted}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
