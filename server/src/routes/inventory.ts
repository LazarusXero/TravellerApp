import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// POST /api/inventory/send - send an item to a character's inventory
// Body: { itemId, characterId, quantity, senderCharacterId? }
// senderCharacterId: when present, deducts quantity from that character's inventory first
router.post('/send', async (req, res) => {
  try {
    const itemId = parseInt(req.body.itemId);
    const characterId = parseInt(req.body.characterId);
    const quantity = parseInt(req.body.quantity);
    const senderCharacterId = req.body.senderCharacterId != null
      ? parseInt(req.body.senderCharacterId)
      : null;

    if (isNaN(itemId) || isNaN(characterId) || isNaN(quantity) || quantity < 1) {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }

    // Deduct from sender if this is a player-to-player transfer
    if (senderCharacterId != null) {
      const senderRow = await prisma.inventoryItem.findFirst({
        where: { item_id: itemId, owner_id: senderCharacterId, owner_type: 'character' },
      });

      if (!senderRow || senderRow.quantity < quantity) {
        return res.status(400).json({ error: 'Insufficient quantity in sender inventory' });
      }

      if (senderRow.quantity === quantity) {
        await prisma.inventoryItem.delete({ where: { id: senderRow.id } });
      } else {
        await prisma.inventoryItem.update({
          where: { id: senderRow.id },
          data: { quantity: senderRow.quantity - quantity },
        });
      }
    }

    // Add to recipient
    const existing = await prisma.inventoryItem.findFirst({
      where: { item_id: itemId, owner_id: characterId, owner_type: 'character' },
    });

    let result;
    if (existing) {
      result = await prisma.inventoryItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
        include: { item: true },
      });
    } else {
      result = await prisma.inventoryItem.create({
        data: { owner_type: 'character', owner_id: characterId, item_id: itemId, quantity },
        include: { item: true },
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send item to inventory' });
  }
});

// PATCH /api/inventory/:id - set quantity for an inventory item; deletes row if quantity reaches 0
router.patch('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const quantity = parseInt(req.body.quantity);

    if (isNaN(id) || isNaN(quantity) || quantity < 0) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    if (quantity === 0) {
      await prisma.inventoryItem.delete({ where: { id } });
      return res.json({ deleted: true });
    }

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: { quantity },
      include: { item: true },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update inventory item' });
  }
});

// GET /api/inventory/character/:characterId - get all inventory items for a character
router.get('/character/:characterId', async (req, res) => {
  try {
    const characterId = parseInt(req.params.characterId);
    const items = await prisma.inventoryItem.findMany({
      where: { owner_id: characterId, owner_type: 'character' },
      include: { item: true },
      orderBy: { item: { name: 'asc' } },
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch character inventory' });
  }
});

export default router;
