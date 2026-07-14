import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  DEFAULT_PRICE_BOOK,
  computeQuote,
  quoteMatches,
  type PriceBook,
} from '@grillz/pricing-engine';
import type { PriceQuote, PriceQuoteInput } from '@grillz/shared-types';
import { PrismaService } from '../../infra/prisma.module';
import { REDIS, type RedisClient } from '../../infra/redis.module';

const BOOK_CACHE_KEY = 'pricing:book';
const BOOK_TTL_SEC = 120;

/**
 * Server-authoritative pricing. The effective price book is the code default
 * overlaid with live Material/Pattern rows, and its version is derived from
 * the overlay content — any admin price change produces a new version, which
 * invalidates outstanding quotes at order time (see quoteMatches).
 */
@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: RedisClient,
  ) {}

  async getEffectivePriceBook(): Promise<PriceBook> {
    const cached = await this.redis.get(BOOK_CACHE_KEY);
    if (cached) return JSON.parse(cached) as PriceBook;

    const [materials, patterns] = await Promise.all([
      this.prisma.material.findMany({ where: { isActive: true } }),
      this.prisma.pattern.findMany({ where: { isActive: true } }),
    ]);

    const book: PriceBook = structuredClone(DEFAULT_PRICE_BOOK);
    for (const m of materials) {
      book.materials[m.type] = {
        ...book.materials[m.type],
        densityGCm3: m.densityGCm3,
        pricePerGramMinor: m.pricePerGram,
      };
    }
    for (const p of patterns) {
      book.patternLaborFactor[p.kind] = p.laborFactor;
    }

    const digest = createHash('sha256')
      .update(JSON.stringify({ m: book.materials, p: book.patternLaborFactor }))
      .digest('hex')
      .slice(0, 12);
    book.version = `${DEFAULT_PRICE_BOOK.version}+${digest}`;

    await this.redis.set(BOOK_CACHE_KEY, JSON.stringify(book), 'EX', BOOK_TTL_SEC);
    return book;
  }

  async quote(input: PriceQuoteInput): Promise<PriceQuote> {
    const book = await this.getEffectivePriceBook();
    return computeQuote(input, book);
  }

  /** Recomputes a submitted quote against the current book; false = stale/tampered. */
  async verifyQuote(quote: PriceQuote): Promise<boolean> {
    const book = await this.getEffectivePriceBook();
    return quoteMatches(quote, book);
  }

  async bustCache(): Promise<void> {
    await this.redis.del(BOOK_CACHE_KEY);
  }
}
