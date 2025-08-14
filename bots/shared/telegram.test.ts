import type TelegramBot from 'node-telegram-bot-api';
import { describe, expect, it, jest } from 'bun:test';
import { getAllUpdates } from './telegram';

describe('getAllUpdates', () => {
  const mockBot = {
    getUpdates: jest.fn(),
  };

  it('works without updates', async () => {
    mockBot.getUpdates.mockResolvedValueOnce([]);

    await expect(
      getAllUpdates(mockBot as unknown as TelegramBot),
    ).resolves.toEqual({
      lastUpdateId: 0,
      updates: {},
    });
  });

  it('works with multiple updates', async () => {
    const updates = [
      { update_id: 1, message: { chat: { id: 123 } } },
      { update_id: 2, message: { chat: { id: 456 } } },
      { update_id: 3, message: { chat: { id: 123 } } },
      { update_id: 4, message: { chat: { id: 123 } } },
      { update_id: 5, message: { chat: { id: 456 } } },
    ] as TelegramBot.Update[];

    mockBot.getUpdates.mockResolvedValueOnce(updates.slice(0, 3));
    mockBot.getUpdates.mockResolvedValueOnce(updates.slice(3));
    mockBot.getUpdates.mockResolvedValueOnce([]);

    await expect(
      getAllUpdates(mockBot as unknown as TelegramBot),
    ).resolves.toEqual({
      lastUpdateId: 5,
      updates: {
        '123': [updates[0], updates[2], updates[3]],
        '456': [updates[1], updates[4]],
      },
    });
  });
});
